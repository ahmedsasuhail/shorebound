import { describe, expect, it } from "vitest";
import { EP_QUALIFYING_MONTHLY_SGD, myCareersFuture, tidyCompany } from "./mycareersfuture.js";
import type { FetchLike } from "./types.js";

const now = new Date("2026-11-24T06:00:00Z");
const since = new Date(now.getTime() - 7 * 86_400_000);
const day = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString().slice(0, 10);

const job = (id: string, over: Record<string, unknown> = {}) => ({
  uuid: id, title: "Senior Software Engineer", description: "<p>Build services with Node.js.</p>",
  postedCompany: { name: "ACME TECH PTE. LTD." }, salary: { minimum: 8000, maximum: 10000, type: { salaryType: "Monthly" } },
  metadata: { originalPostingDate: day(1), newPostingDate: day(1), jobDetailsUrl: `https://www.mycareersfuture.gov.sg/job/x-${id}` },
  ...over,
});
const api = (pages: unknown[][]): { f: FetchLike; calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    f: async (url) => {
      calls.push(url);
      const q = new URL(url).searchParams;
      return { ok: true, status: 200, text: async () => "", json: async () => ({ results: pages[Number(q.get("page"))] ?? [] }) };
    },
  };
};
const run = (pages: unknown[][]) => myCareersFuture.fetchJobs({ fetch: api(pages).f, since, now, delayMs: 0 });

describe("MyCareersFuture connector", () => {
  it("salary above the Employment Pass bar gives a 'possible' signal with honest evidence", async () => {
    const { jobs } = await run([[job("a")]]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ country: "SG", sourceId: "mycareersfuture", company: "Acme Tech Pte. Ltd.", sponsorship: { status: "possible" } });
    expect(jobs[0]!.sponsorship.evidence).toMatch(/does not say the employer sponsors/);
    expect(jobs[0]!.url).toBe("https://www.mycareersfuture.gov.sg/job/x-a");
  });

  it("explicit sponsorship text is 'confirmed_text' even when the salary is low", async () => {
    const { jobs } = await run([[job("a", { salary: { minimum: 4000, maximum: 5000, type: { salaryType: "Monthly" } }, description: "<p>We offer visa sponsorship and relocation support.</p>" })]]);
    expect(jobs[0]!.sponsorship.status).toBe("confirmed_text");
    expect(jobs[0]!.relocation.status).toBe("offered");
  });

  it("drops: salary below the bar, hidden salary, non-monthly salary, negatives, non-software, old", async () => {
    const { jobs, stats } = await run([[
      job("low", { salary: { minimum: 3000, maximum: 5000, type: { salaryType: "Monthly" } } }),
      job("hidden", { salary: null }),
      job("annual", { salary: { minimum: 90000, maximum: 120000, type: { salaryType: "Annual" } } }),
      job("neg", { description: "<p>Singapore citizens and PRs only.</p>" }),
      job("sales", { title: "Account Executive" }),
      job("good"),
    ]]);
    expect(jobs.map((j) => j.sourceJobId)).toEqual(["good"]);
    expect(stats).toMatchObject({ notSoftware: 1, noSponsorshipSignal: 4 });
  });

  it("uses the ORIGINAL posting date: a recently reposted old job is not new", async () => {
    const { jobs, stats } = await run([[job("repost", { metadata: { originalPostingDate: day(40), newPostingDate: day(0), jobDetailsUrl: "u" } })]]);
    expect(jobs).toHaveLength(0);
    expect(stats.tooOld).toBe(1);
  });

  it("an old repost among new listings does not stop paging (sort key is the latest repost date)", async () => {
    const repost = job("repost", { metadata: { originalPostingDate: day(40), newPostingDate: day(0), jobDetailsUrl: "u" } });
    const page0 = [job("a"), repost, ...Array.from({ length: 98 }, (_, i) => job(`p0-${i}`))];
    const a = api([page0, [job("b")]]);
    const r = await myCareersFuture.fetchJobs({ fetch: a.f, since, now, delayMs: 0 });
    expect(a.calls.filter((u) => u.includes("search=software%20engineer")).length).toBe(2); // continued to page 1
    expect(r.jobs.map((j) => j.sourceJobId)).toContain("b");
    expect(r.jobs.map((j) => j.sourceJobId)).not.toContain("repost");
  });

  it("stops paging once it reaches jobs older than the window, and dedupes across queries", async () => {
    const full = Array.from({ length: 100 }, (_, i) => job(`n${i}`));
    const mixed = [...full.slice(0, 5).map((j, i) => ({ ...j, uuid: `m${i}` })), job("old", { metadata: { originalPostingDate: day(30), newPostingDate: day(30), jobDetailsUrl: "u" } })];
    const a = api([full, mixed, full]);
    const r = await myCareersFuture.fetchJobs({ fetch: a.f, since, now, delayMs: 0 });
    // per query: page0 (full) + page1 (reaches old) = 2 requests; 4 queries share the same ids → deduped
    expect(a.calls.length).toBe(8);
    expect(r.jobs.length).toBe(105);
  });

  it("a failing request becomes a warning, not a crash", async () => {
    const bad: FetchLike = async () => ({ ok: false, status: 429, text: async () => "", json: async () => ({}) });
    const r = await myCareersFuture.fetchJobs({ fetch: bad, since, now, delayMs: 0 });
    expect(r.jobs).toEqual([]);
    expect(r.warnings?.length).toBeGreaterThan(0);
    expect(r.warnings?.[0]).toMatch(/HTTP 429/);
  });
});

describe("helpers", () => {
  it("tidyCompany fixes capitals only", () => {
    expect(tidyCompany("CODEX SOLUTIONS PTE. LTD.")).toBe("Codex Solutions Pte. Ltd.");
    expect(tidyCompany("Grab Holdings")).toBe("Grab Holdings");
  });
  it("EP bar comes from the researched data (S$7,750 from Jan 2027)", () => {
    expect(EP_QUALIFYING_MONTHLY_SGD).toBe(7750);
  });
});
