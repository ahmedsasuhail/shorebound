import type { JobDTO } from "@shorebound/core";
import { extractProfile } from "@shorebound/core";
import { describe, expect, it } from "vitest";
import { buildFeed } from "./feed.js";

const now = new Date("2026-11-22T12:00:00Z");
const mk = (id: string, title: string, company: string, hoursAgo: number, extra: Partial<JobDTO> = {}): JobDTO => ({
  id, sourceId: "t", sourceJobId: id, url: "u", title, company, country: "DE",
  postedAt: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(), firstSeenAt: now.toISOString(),
  description: "Node.js TypeScript AWS. ".repeat(20), sponsorship: { status: "visa_source" }, relocation: { status: "none" }, ...extra,
});
const profile = extractProfile("Senior Software Engineer, 7+ years of experience. TypeScript Node.js NestJS React Next.js HTML CSS AWS Docker MySQL", now);
const base = { profile, easeByCountry: new Map([["DE", 4]]), sort: "newest" as const, onlyMatching: true, maxPerCompany: 3, relocationBonus: true, now };

describe("buildFeed", () => {
  it("caps jobs per company and reports how many were hidden", () => {
    const rows = [1, 2, 3, 4, 5].map((h) => mk(`a${h}`, "Senior Backend Engineer", "Acme", h));
    const f = buildFeed(rows, base);
    expect(f.jobs).toHaveLength(3);
    expect(f.hidden.companyCap).toBe(2);
  });

  it("keeps newest-first by default and can sort by match", () => {
    const rows = [mk("grad", "Graduate Software Engineer", "A", 1), mk("senior", "Senior Backend Engineer", "B", 5)];
    expect(buildFeed(rows, { ...base, onlyMatching: false }).jobs.map((j) => j.id)).toEqual(["grad", "senior"]);
    expect(buildFeed(rows, { ...base, onlyMatching: false, sort: "match" }).jobs.map((j) => j.id)).toEqual(["senior", "grad"]);
  });

  it("without a profile nothing is hidden and match is null", () => {
    const f = buildFeed([mk("x", "Recruiter", "A", 1)], { ...base, profile: null });
    expect(f.jobs).toHaveLength(1);
    expect(f.jobs[0]!.match).toBeNull();
  });

  it("jobs with only a 'possible' sponsorship signal can be excluded", () => {
    const rows = [mk("sure", "Senior Backend Engineer", "A", 1, { sponsorship: { status: "confirmed_text" } }), mk("maybe", "Senior Backend Engineer", "B", 2, { sponsorship: { status: "possible" } })];
    expect(buildFeed(rows, base).jobs.map((j) => j.id)).toEqual(["sure", "maybe"]);
    expect(buildFeed(rows, { ...base, includePossible: false }).jobs.map((j) => j.id)).toEqual(["sure"]);
  });

  it("relocation offered breaks ties upward when sorting by match", () => {
    const rows = [mk("plain", "Senior Backend Engineer", "A", 1), mk("reloc", "Senior Backend Engineer", "B", 2, { relocation: { status: "offered" } })];
    expect(buildFeed(rows, { ...base, sort: "match" }).jobs[0]!.id).toBe("reloc");
  });
});
