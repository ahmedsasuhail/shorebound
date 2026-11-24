import type { JobDTO } from "@shorebound/core";
import { extractProfile } from "@shorebound/core";
import { describe, expect, it } from "vitest";
import { buildFeed, dedupeJobs } from "./feed.js";

const now = new Date("2026-11-22T12:00:00Z");
const mk = (id: string, title: string, company: string, hoursAgo: number, extra: Partial<JobDTO> = {}): JobDTO => ({
  id,
  sourceId: "t",
  sourceJobId: id,
  url: "u",
  title,
  company,
  country: "DE",
  postedAt: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
  firstSeenAt: now.toISOString(),
  description: "Node.js TypeScript AWS. ".repeat(20),
  sponsorship: { status: "visa_source" },
  relocation: { status: "none" },
  ...extra,
});
const profile = extractProfile(
  "Senior Software Engineer, 7+ years of experience. TypeScript Node.js NestJS React Next.js HTML CSS AWS Docker MySQL",
  now,
);
const base = {
  profile,
  easeByCountry: new Map([["DE", 4]]),
  sort: "newest" as const,
  maxPerCompany: 3,
  relocationBonus: true,
  now,
};

describe("buildFeed", () => {
  it("caps jobs per company and reports how many were hidden", () => {
    const rows = [1, 2, 3, 4, 5].map((h) => mk(`a${h}`, "Senior Backend Engineer", "Acme", h));
    const f = buildFeed(rows, base);
    expect(f.jobs).toHaveLength(3);
    expect(f.hidden.companyCap).toBe(2);
  });

  it("keeps newest-first by default and can sort by match", () => {
    const rows = [mk("grad", "Graduate Software Engineer", "A", 1), mk("senior", "Senior Backend Engineer", "B", 5)];
    expect(buildFeed(rows, { ...base, minMatch: 0 }).jobs.map((j) => j.id)).toEqual(["grad", "senior"]);
    expect(buildFeed(rows, { ...base, minMatch: 0, sort: "match" }).jobs.map((j) => j.id)).toEqual(["senior", "grad"]);
  });

  it("without a profile nothing is hidden and match is null", () => {
    const f = buildFeed([mk("x", "Recruiter", "A", 1)], { ...base, profile: null });
    expect(f.jobs).toHaveLength(1);
    expect(f.jobs[0]!.match).toBeNull();
  });

  it("jobs with only a 'possible' sponsorship signal can be excluded", () => {
    const rows = [
      mk("sure", "Senior Backend Engineer", "A", 1, { sponsorship: { status: "confirmed_text" } }),
      mk("maybe", "Senior Backend Engineer", "B", 2, { sponsorship: { status: "possible" } }),
    ];
    expect(buildFeed(rows, base).jobs.map((j) => j.id)).toEqual(["sure", "maybe"]);
    expect(buildFeed(rows, { ...base, includePossible: false }).jobs.map((j) => j.id)).toEqual(["sure"]);
  });

  it("employer-level register matches can be excluded, and rank below explicit text when sorting by trust", () => {
    const rows = [
      mk("register", "Senior Backend Engineer", "A", 1, { sponsorship: { status: "confirmed_register" } }),
      mk("text", "Senior Backend Engineer", "B", 2, { sponsorship: { status: "confirmed_text" } }),
    ];
    expect(buildFeed(rows, { ...base, sort: "confidence" }).jobs.map((j) => j.id)).toEqual(["text", "register"]);
    expect(buildFeed(rows, { ...base, includeRegister: false }).jobs.map((j) => j.id)).toEqual(["text"]);
  });

  it("discards non-engineering roles (match 5) outright, without counting them as hidden poor fits", () => {
    const rows = [mk("rec", "Technical Recruiter", "A", 1), mk("be", "Senior Backend Engineer", "B", 2)];
    const f = buildFeed(rows, { ...base, minMatch: 0 });
    expect(f.jobs.map((j) => j.id)).toEqual(["be"]);
    expect(f.hidden.notMatching).toBe(0);
  });

  it("explicit no-sponsorship jobs are never listed", () => {
    const rows = [mk("no", "Senior Backend Engineer", "A", 1, { sponsorship: { status: "negative" } })];
    expect(buildFeed(rows, { ...base, minMatch: 0 }).jobs).toEqual([]);
  });

  it("counts how many listed jobs offer relocation", () => {
    const rows = [
      mk("a", "Senior Backend Engineer", "A", 1, { relocation: { status: "offered" } }),
      mk("b", "Senior Backend Engineer", "B", 2),
    ];
    expect(buildFeed(rows, base).relocationOffered).toBe(1);
  });

  it("relocation offered breaks ties upward when sorting by match", () => {
    const rows = [
      mk("plain", "Senior Backend Engineer", "A", 1),
      mk("reloc", "Senior Backend Engineer", "B", 2, { relocation: { status: "offered" } }),
    ];
    expect(buildFeed(rows, { ...base, sort: "match" }).jobs[0]!.id).toBe("reloc");
  });

  it("keeps one copy of a job that arrives from two sources, preferring the stronger evidence", () => {
    const board = mk("an", "Backend Engineer (m/f/d)", "Catawiki", 2, {
      country: "NL",
      sourceId: "arbeitnow",
      sponsorship: { status: "visa_source" },
    });
    const own = mk("gh", "Backend Engineer", "Catawiki B.V.", 3, {
      country: "NL",
      sourceId: "greenhouse",
      sponsorship: { status: "confirmed_register" },
    });
    const other = mk("x", "Backend Engineer", "Catawiki", 1, { country: "DE" }); // different country: kept
    expect(
      dedupeJobs([board, own, other])
        .map((j) => j.id)
        .sort(),
    ).toEqual(["gh", "x"]);
  });

  it("keeps several same-titled openings from one source (different teams)", () => {
    const a = mk("1", "Software Engineer 3", "MongoDB", 1, { sourceId: "greenhouse" });
    const b = mk("2", "Software Engineer 3", "MongoDB", 2, { sourceId: "greenhouse" });
    expect(dedupeJobs([a, b])).toHaveLength(2);
  });
});
