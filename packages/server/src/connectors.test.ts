import { existsSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FetchLike } from "@shorebound/sources";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canadaRegisterLoader,
  combineRegisters,
  irelandRegisterLoader,
  loadSeed,
  ukRegisterLoader,
} from "./connectors.js";

const dataDir = fileURLToPath(new URL("../../../data", import.meta.url));
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shorebound-reg-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const CSV =
  "Organisation Name,Town/City,County,Type & Rating,Route\nAcme UK Limited,London,,Worker (A rating),Skilled Worker\n";
const counting = (fail = false) => {
  const calls: string[] = [];
  const f: FetchLike = async (url) => {
    calls.push(url);
    if (fail) return { ok: false, status: 500, json: async () => ({}), text: async () => "" };
    return url.includes("api/content")
      ? {
          ok: true,
          status: 200,
          json: async () => ({ details: { attachments: [{ url: "https://x/r.csv", content_type: "text/csv" }] } }),
          text: async () => "",
        }
      : { ok: true, status: 200, json: async () => ({}), text: async () => CSV };
  };
  return { f, calls };
};

describe("seed companies", () => {
  it("the real seed file is valid and every register name is non-empty", () => {
    const seed = loadSeed(dataDir);
    expect(seed.length).toBeGreaterThanOrEqual(20);
    for (const c of seed) {
      expect(c.token, c.name).toBeTruthy();
      const names = Object.values(c.register ?? {}).flat();
      expect(names.length, `${c.name} needs at least one verified register name`).toBeGreaterThan(0);
      expect(
        names.every((n) => n.trim() === n && n.length > 1),
        c.name,
      ).toBe(true);
    }
  });
});

describe("UK register cache", () => {
  it("downloads once, then serves from disk for a week", async () => {
    const { f, calls } = counting();
    const load = ukRegisterLoader(dir, f);
    expect((await load()).get("GB")?.has("acme uk limited")).toBe(true);
    await load();
    expect(calls).toHaveLength(2); // content API + CSV, only on the first load
    expect(existsSync(join(dir, "registers", "gb.csv"))).toBe(true);
  });

  it("refreshes a stale cache, but falls back to the old copy if the download fails", async () => {
    await ukRegisterLoader(dir, counting().f)();
    const old = new Date(Date.now() - 10 * 86_400_000);
    utimesSync(join(dir, "registers", "gb.csv"), old, old);
    const failing = counting(true);
    expect((await ukRegisterLoader(dir, failing.f)()).get("GB")?.size).toBe(1);
    expect(failing.calls.length).toBeGreaterThan(0);
  });

  it("throws when there is no cache and the download fails", async () => {
    await expect(ukRegisterLoader(dir, counting(true).f)()).rejects.toThrow(/HTTP 500/);
  });
});

describe("Canada register cache and combined registers", () => {
  const pkg = {
    result: { resources: [{ name: "2026Q2-Employers", format: "XLSX", language: ["en"], url: "https://x/q2.xlsx" }] },
  };
  const rows = [
    ["Province/Territory", "Program Stream", "Employer", "Address", "Occupation"],
    ["ON", "GTS", "Acme Corp", "Toronto", "21231-Software engineers and designers"],
  ];
  const net = (fail = false) => {
    const calls: string[] = [];
    const f: FetchLike = async (url) => {
      calls.push(url);
      if (fail) return { ok: false, status: 503, json: async () => ({}), text: async () => "" };
      return url.includes("package_show")
        ? { ok: true, status: 200, json: async () => pkg, text: async () => "" }
        : {
            ok: true,
            status: 200,
            json: async () => ({}),
            text: async () => "",
            arrayBuffer: async () => new ArrayBuffer(1),
          };
    };
    return { f, calls };
  };
  const read = async () => rows;

  it("downloads once, then uses the cache; falls back to an old cache if the download fails", async () => {
    const a = net();
    expect((await canadaRegisterLoader(dir, a.f, undefined, read)()).get("CA")?.has("acme corp")).toBe(true);
    await canadaRegisterLoader(dir, a.f, undefined, read)();
    expect(a.calls.filter((u) => u.includes("package_show"))).toHaveLength(1);

    const old = new Date(Date.now() - 30 * 86_400_000);
    utimesSync(join(dir, "registers", "ca.json"), old, old);
    expect((await canadaRegisterLoader(dir, net(true).f, undefined, read)()).get("CA")?.size).toBe(1);
  });

  it("combined loader keeps working when one register fails, and says so", async () => {
    const r = await combineRegisters([
      {
        label: "UK",
        load: async () => {
          throw new Error("boom");
        },
      },
      { label: "Canada", load: async () => new Map([["CA", new Set(["acme corp"])]]) },
    ])();
    expect(r.index.get("CA")?.size).toBe(1);
    expect(r.warnings[0]).toMatch(/UK register unavailable \(boom\)/);
  });

  it("throws only when every register fails", async () => {
    await expect(
      combineRegisters([
        {
          label: "UK",
          load: async () => {
            throw new Error("a");
          },
        },
      ])(),
    ).rejects.toThrow(/UK register unavailable/);
  });
});

describe("Ireland register cache", () => {
  const rows = [["Acme Ireland Limited", 1, 1]];
  const ok: FetchLike = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
    arrayBuffer: async () => new ArrayBuffer(1),
  });
  const down: FetchLike = async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => "" });

  it("downloads, caches, and falls back to the cached copy when the site is down", async () => {
    expect(
      (await irelandRegisterLoader(dir, ok, undefined, async () => rows)()).get("IE")?.has("acme ireland limited"),
    ).toBe(true);
    const old = new Date(Date.now() - 30 * 86_400_000);
    utimesSync(join(dir, "registers", "ie.json"), old, old);
    expect((await irelandRegisterLoader(dir, down, undefined, async () => rows)()).get("IE")?.size).toBe(1);
  });

  it("throws when there is no cache and the site is down", async () => {
    await expect(irelandRegisterLoader(dir, down)()).rejects.toThrow(/not found/);
  });
});
