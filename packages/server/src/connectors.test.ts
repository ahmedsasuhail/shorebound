import { existsSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FetchLike } from "@shorebound/sources";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSeed, ukRegisterLoader } from "./connectors.js";

const dataDir = fileURLToPath(new URL("../../../data", import.meta.url));
let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "shorebound-reg-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const CSV = "Organisation Name,Town/City,County,Type & Rating,Route\nAcme UK Limited,London,,Worker (A rating),Skilled Worker\n";
const counting = (fail = false) => {
  const calls: string[] = [];
  const f: FetchLike = async (url) => {
    calls.push(url);
    if (fail) return { ok: false, status: 500, json: async () => ({}), text: async () => "" };
    return url.includes("api/content")
      ? { ok: true, status: 200, json: async () => ({ details: { attachments: [{ url: "https://x/r.csv", content_type: "text/csv" }] } }), text: async () => "" }
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
      expect(c.register?.GB?.length, c.name).toBeGreaterThan(0);
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
