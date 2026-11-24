import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Job } from "@shorebound/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { openDb, type Db } from "./db.js";
import { putSetting } from "./db.js";
import { upsertJobs } from "./jobs.js";

const dataDir = fileURLToPath(new URL("../../../data", import.meta.url));
let dir: string;
let db: Db;
const now = new Date("2026-11-22T12:00:00Z");

const job = (id: string, over: Partial<Job> = {}): Job => ({
  id,
  sourceId: "t",
  sourceJobId: id,
  url: "https://x/" + id,
  title: "Engineer " + id,
  company: "Acme",
  country: "DE",
  postedAt: new Date("2026-11-21T12:00:00Z"),
  description: "d",
  sponsorship: { status: "visa_source" },
  relocation: { status: "none" },
  ...over,
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shorebound-api-"));
  db = openDb(join(dir, "app.db"));
  upsertJobs(
    db,
    [
      job("new-de"),
      job("old-de", { postedAt: new Date("2026-11-01T12:00:00Z") }),
      job("neg-de", { sponsorship: { status: "negative" } }),
      job("reloc-gb", { country: "GB", relocation: { status: "offered" } }),
      job("us", { country: "US", title: "Staff Engineer" }),
    ],
    now,
  );
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const make = () => buildApp({ db, appData: dir, dataDir });
// Feed tests that are not about matching use a profile and "Broad" strictness so every job shows.
const makeWithProfile = async () => {
  const app = make();
  await app.inject({
    method: "PUT",
    url: "/api/profile",
    payload: { skills: ["node.js"], yearsExperience: 7, seniority: "senior", families: ["backend"], title: null },
  });
  await app.inject({ method: "PUT", url: "/api/settings", payload: { search: { minMatch: 0, onlyMatching: false } } });
  return app;
};

describe("api", () => {
  it("catalog lists available and coming-soon countries", async () => {
    const r = (await make().inject("/api/catalog")).json();
    const de = r.countries.find((c: { code: string }) => c.code === "DE");
    expect(de.status).toBe("available");
    expect(r.countries.some((c: { status: string }) => c.status === "coming_soon")).toBe(true);
  });

  it("feed: newest first, hides negatives and old jobs, filters by country", async () => {
    const app = await makeWithProfile();
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
    const r = (
      await (await makeWithProfile()).inject("/api/jobs?countries=DE&sinceDays=30&excludeNegative=false")
    ).json().jobs;
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
    const app = buildApp({
      db,
      appData: dir,
      dataDir,
      refresh: async () => {
        await gate;
        return { startedAt: "x", sources: [] };
      },
    });
    const first = app.inject({ method: "POST", url: "/api/refresh" });
    await new Promise((r) => setTimeout(r, 20));
    expect((await app.inject({ method: "POST", url: "/api/refresh" })).statusCode).toBe(409);
    release();
    expect((await first).statusCode).toBe(200);
  });

  it("a bodyless POST works with any content type (e.g. form-encoded from other clients)", async () => {
    const app = buildApp({ db, appData: dir, dataDir, refresh: async () => ({ startedAt: "x", sources: [] }) });
    const r = await app.inject({
      method: "POST",
      url: "/api/refresh",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("no profile → no feed (needsProfile), even when jobs exist", async () => {
    const r = (await make().inject("/api/jobs?countries=DE&sinceDays=30")).json();
    expect(r.needsProfile).toBe(true);
    expect(r.jobs).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("removing the resume also removes the profile and hides the feed again", async () => {
    const app = make();
    await app.inject({
      method: "PUT",
      url: "/api/resume",
      headers: { "content-type": "application/octet-stream", "x-filename": "cv.txt" },
      payload: Buffer.from("Senior Software Engineer. 7+ years of experience. TypeScript Node.js React"),
    });
    expect((await app.inject("/api/profile")).json().profile).not.toBeNull();
    await app.inject({ method: "DELETE", url: "/api/resume" });
    expect((await app.inject("/api/profile")).json().profile).toBeNull();
    expect((await app.inject("/api/jobs?countries=DE&sinceDays=30")).json().needsProfile).toBe(true);
  });

  it("a rule-derived profile from an older extractor is re-read from the stored resume", async () => {
    const app = make();
    await app.inject({
      method: "PUT",
      url: "/api/resume",
      headers: { "content-type": "application/octet-stream", "x-filename": "cv.txt" },
      payload: Buffer.from(
        "Senior Software Engineer. 7+ years of experience. TypeScript Node.js React Next.js HTML CSS AWS Docker Jenkins",
      ),
    });
    putSetting(db, "profile", {
      skills: ["java"],
      yearsExperience: 1,
      seniority: "junior",
      families: ["devops", "mobile"],
      title: null,
      source: "rules",
      version: 1,
    });
    const p = (await app.inject("/api/profile")).json().profile;
    expect(p.seniority).toBe("senior");
    expect(p.families).not.toContain("devops");
    expect(p.version).toBeGreaterThanOrEqual(2);
  });

  it("a profile the user edited is never overwritten by re-reading the resume", async () => {
    const app = make();
    await app.inject({
      method: "PUT",
      url: "/api/resume",
      headers: { "content-type": "application/octet-stream", "x-filename": "cv.txt" },
      payload: Buffer.from("Senior Software Engineer. 7+ years. TypeScript"),
    });
    await app.inject({
      method: "PUT",
      url: "/api/profile",
      payload: { skills: ["go"], yearsExperience: 3, seniority: "mid", families: ["backend"], title: null },
    });
    const p = (await app.inject("/api/profile")).json().profile;
    expect(p.source).toBe("user");
    expect(p.skills).toEqual(["go"]);
  });

  it("setting includePossible=false hides weaker-signal jobs from the feed", async () => {
    const app = await makeWithProfile();
    upsertJobs(db, [job("poss", { sponsorship: { status: "possible" }, country: "SG" })], now);
    const ids = async () =>
      (await app.inject("/api/jobs?countries=SG&sinceDays=30")).json().jobs.map((j: { id: string }) => j.id);
    expect(await ids()).toContain("poss");
    await app.inject({
      method: "PUT",
      url: "/api/settings",
      payload: { sponsorship: { excludeNegative: true, relocation: "bonus", includePossible: false } },
    });
    expect(await ids()).not.toContain("poss");
  });

  it("strictness: a higher minMatch hides weaker jobs", async () => {
    const app = make();
    await app.inject({
      method: "PUT",
      url: "/api/profile",
      payload: {
        skills: ["typescript", "node.js", "react"],
        yearsExperience: 7,
        seniority: "senior",
        families: ["fullstack", "frontend", "backend"],
        title: null,
      },
    });
    upsertJobs(
      db,
      [
        job("strong", {
          title: "Senior Full Stack Engineer",
          description: "TypeScript, React, Node.js. 5+ years of experience.",
        }),
        job("weak", { title: "Software Engineer", description: "Work on internal tools." }),
      ],
      now,
    );
    const ids = async (minMatch: number) => {
      await app.inject({ method: "PUT", url: "/api/settings", payload: { search: { minMatch, onlyMatching: true } } });
      return (await app.inject("/api/jobs?countries=DE&sinceDays=30")).json().jobs.map((j: { id: string }) => j.id);
    };
    expect(await ids(40)).toContain("weak");
    expect(await ids(70)).not.toContain("weak");
    expect(await ids(70)).toContain("strong");
  });

  it("resume upload, read and delete", async () => {
    const app = make();
    const put = await app.inject({
      method: "PUT",
      url: "/api/resume",
      headers: { "content-type": "application/octet-stream", "x-filename": encodeURIComponent("My CV.pdf") },
      payload: Buffer.from([1, 2, 3]),
    });
    expect(put.json().resume.originalName).toBe("My CV.pdf");
    expect((await app.inject("/api/resume")).json().resume.bytes).toBe(3);
    await app.inject({ method: "DELETE", url: "/api/resume" });
    expect((await app.inject("/api/resume")).json().resume).toBeNull();
    const bad = await app.inject({
      method: "PUT",
      url: "/api/resume",
      headers: { "content-type": "application/octet-stream", "x-filename": "a.exe" },
      payload: Buffer.from([1]),
    });
    expect(bad.statusCode).toBe(400);
  });

  it("resume upload builds a profile that filters and scores the feed", async () => {
    upsertJobs(
      db,
      [
        job("be", {
          title: "Senior Backend Engineer",
          company: "Beta",
          description: "Node.js, TypeScript, AWS. 5+ years of experience.",
        }),
        job("ta", { title: "Talent Acquisition Specialist", company: "Gamma", description: "Recruiting" }),
      ],
      now,
    );
    const app = make();
    const resume =
      "Senior Software Engineer with 7+ years of experience. Skills: TypeScript, Node.js, NestJS, React, Next.js, HTML, CSS, AWS, Docker, MySQL.";
    const put = (
      await app.inject({
        method: "PUT",
        url: "/api/resume",
        headers: { "content-type": "application/octet-stream", "x-filename": "cv.txt" },
        payload: Buffer.from(resume),
      })
    ).json();
    expect(put.profile.yearsExperience).toBe(7);
    expect(put.profile.skills).toContain("node.js");

    const feed = (await app.inject("/api/jobs?countries=DE&sinceDays=30")).json();
    const ids = feed.jobs.map((j: { id: string }) => j.id);
    expect(ids).toContain("be");
    expect(ids).not.toContain("ta");
    expect(feed.hidden.notMatching).toBeGreaterThan(0);
    const be = feed.jobs.find((j: { id: string }) => j.id === "be");
    expect(be.match.score).toBeGreaterThanOrEqual(80);
    expect(be.confidence.coverage).toBe(0.65);
  });

  it("a partial settings update does not reset other saved settings", async () => {
    const app = make();
    await app.inject({ method: "PUT", url: "/api/settings", payload: { countries: ["GB", "DE"] } });
    const after = await app.inject({ method: "PUT", url: "/api/settings", payload: { appearance: { theme: "dark" } } });
    expect(after.json().countries).toEqual(["GB", "DE"]);
    expect((await app.inject("/api/settings")).json().countries).toEqual(["GB", "DE"]);
  });

  it("user can edit the profile; invalid edits are rejected", async () => {
    const app = make();
    const ok = await app.inject({
      method: "PUT",
      url: "/api/profile",
      payload: { skills: ["go"], yearsExperience: 3, seniority: "mid", families: ["backend"], title: null },
    });
    expect(ok.json().profile.source).toBe("user");
    const bad = await app.inject({
      method: "PUT",
      url: "/api/profile",
      payload: { skills: [], yearsExperience: -1, seniority: "guru", families: [], title: null },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("lists the job sources the user can switch off", async () => {
    const ids = (await make().inject("/api/sources")).json().sources.map((x: { id: string }) => x.id);
    expect(ids).toEqual(["arbeitnow", "hackernews", "mycareersfuture", "company-boards"]);
  });

  it("serves the built UI with a single-page fallback, while unknown API paths stay 404", async () => {
    const web = join(dir, "web");
    mkdirSync(web);
    writeFileSync(join(web, "index.html"), "<!doctype html><title>Shorebound</title>");
    const app = buildApp({ db, appData: dir, dataDir, webDir: web });
    expect((await app.inject("/")).body).toContain("Shorebound");
    expect((await app.inject("/settings")).body).toContain("Shorebound");
    expect((await app.inject("/api/nope")).statusCode).toBe(404);
  });
});
