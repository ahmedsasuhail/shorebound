import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Job } from "@shorebound/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { openDb, type Db } from "./db.js";
import { upsertJobs } from "./jobs.js";

const dataDir = fileURLToPath(new URL("../../../data", import.meta.url));
let dir: string;
let db: Db;
const now = new Date("2026-11-22T12:00:00Z");

const job = (id: string, over: Partial<Job> = {}): Job => ({
  id, sourceId: "t", sourceJobId: id, url: "https://x/" + id, title: "Engineer " + id, company: "Acme",
  country: "DE", postedAt: new Date("2026-11-21T12:00:00Z"), description: "d",
  sponsorship: { status: "visa_source" }, relocation: { status: "none" }, ...over,
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shorebound-api-"));
  db = openDb(join(dir, "app.db"));
  upsertJobs(db, [
    job("new-de"),
    job("old-de", { postedAt: new Date("2026-11-01T12:00:00Z") }),
    job("neg-de", { sponsorship: { status: "negative" } }),
    job("reloc-gb", { country: "GB", relocation: { status: "offered" } }),
    job("us", { country: "US", title: "Staff Engineer" }),
  ], now);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const make = () => buildApp({ db, appData: dir, dataDir });

describe("api", () => {
  it("catalog lists available and coming-soon countries", async () => {
    const r = (await make().inject("/api/catalog")).json();
    const de = r.countries.find((c: { code: string }) => c.code === "DE");
    expect(de.status).toBe("available");
    expect(r.countries.some((c: { status: string }) => c.status === "coming_soon")).toBe(true);
  });

  it("feed: newest first, hides negatives and old jobs, filters by country", async () => {
    const app = make();
    const all = (await app.inject("/api/jobs?countries=DE,GB,US&sinceDays=30")).json().jobs as { id: string }[];
    expect(all.map((j) => j.id)).not.toContain("neg-de");
    const week = (await app.inject("/api/jobs?countries=DE&sinceDays=7")).json().jobs as { id: string }[];
    expect(week.map((j) => j.id)).toEqual(["new-de"]);
    const reloc = (await app.inject("/api/jobs?countries=DE,GB&sinceDays=30&relocation=offered")).json().jobs;
    expect(reloc.map((j: { id: string }) => j.id)).toEqual(["reloc-gb"]);
    const search = (await app.inject("/api/jobs?countries=US&sinceDays=30&q=staff")).json().jobs;
    expect(search).toHaveLength(1);
  });

  it("negatives can be shown on request", async () => {
    const r = (await make().inject("/api/jobs?countries=DE&sinceDays=30&excludeNegative=false")).json().jobs;
    expect(r.map((j: { id: string }) => j.id)).toContain("neg-de");
  });

  it("settings round-trip and validation", async () => {
    const app = make();
    const ok = await app.inject({ method: "PUT", url: "/api/settings", payload: { countries: ["GB"] } });
    expect(ok.json().countries).toEqual(["GB"]);
    expect((await app.inject("/api/settings")).json().countries).toEqual(["GB"]);
    const bad = await app.inject({ method: "PUT", url: "/api/settings", payload: { countries: ["GERMANY"] } });
    expect(bad.statusCode).toBe(400);
  });

  it("refresh runs the connector hook and rejects concurrent runs", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const app = buildApp({ db, appData: dir, dataDir, refresh: async () => { await gate; return { startedAt: "x", sources: [] }; } });
    const first = app.inject({ method: "POST", url: "/api/refresh" });
    await new Promise((r) => setTimeout(r, 20));
    expect((await app.inject({ method: "POST", url: "/api/refresh" })).statusCode).toBe(409);
    release();
    expect((await first).statusCode).toBe(200);
  });

  it("resume upload, read and delete", async () => {
    const app = make();
    const put = await app.inject({
      method: "PUT", url: "/api/resume",
      headers: { "content-type": "application/octet-stream", "x-filename": encodeURIComponent("My CV.pdf") },
      payload: Buffer.from([1, 2, 3]),
    });
    expect(put.json().resume.originalName).toBe("My CV.pdf");
    expect((await app.inject("/api/resume")).json().resume.bytes).toBe(3);
    await app.inject({ method: "DELETE", url: "/api/resume" });
    expect((await app.inject("/api/resume")).json().resume).toBeNull();
    const bad = await app.inject({ method: "PUT", url: "/api/resume", headers: { "content-type": "application/octet-stream", "x-filename": "a.exe" }, payload: Buffer.from([1]) });
    expect(bad.statusCode).toBe(400);
  });
});
