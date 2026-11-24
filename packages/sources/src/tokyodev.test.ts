import { describe, expect, it } from "vitest";
import {
  ABROAD_EVIDENCE,
  jobPaths,
  parseJobPage,
  tokyoDev,
  tokyoDevConnector,
  type PostedDateCache,
} from "./tokyodev.js";
import type { FetchLike } from "./types.js";

const now = new Date("2026-11-25T06:00:00Z");
const since = new Date(now.getTime() - 7 * 86_400_000);
const iso = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

const page = (title: string, posted: string, description = "<p>TypeScript and Node.js.</p>") =>
  `<html><script type="application/ld+json">${JSON.stringify({
    "@type": "JobPosting",
    title,
    datePosted: posted,
    description,
    hiringOrganization: { "@type": "Organization", name: "Acme KK" },
    jobLocation: { "@type": "Place", address: { addressRegion: "Tokyo", addressCountry: "JP" } },
  })}</script><script type="application/ld+json">{"@type":"BreadcrumbList"}</script></html>`;

const list = (...paths: string[]) => paths.map((p) => `<a href="${p}">x</a>`).join("");
function site(pages: Record<string, string>): { f: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const f: FetchLike = async (url) => {
    const path = url.replace("https://www.tokyodev.com", "");
    calls.push(path);
    const body = pages[path];
    return body === undefined
      ? { ok: false, status: 404, json: async () => ({}), text: async () => "" }
      : { ok: true, status: 200, json: async () => ({}), text: async () => body };
  };
  return { f, calls };
}

const A = "/companies/acme/jobs/backend-engineer";
const B = "/companies/acme/jobs/needs-japanese";
const C = "/companies/acme/jobs/old-role";
const D = "/companies/acme/jobs/sales";

describe("TokyoDev parsing", () => {
  it("reads job paths, sitemap lastmod and the JobPosting JSON-LD", () => {
    expect([...jobPaths(list(A, B, A))]).toEqual([A, B]);
    expect(parseJobPage(page("Backend Engineer", iso(1)))).toMatchObject({
      title: "Backend Engineer",
      company: "Acme KK",
      country: "JP",
      city: "Tokyo",
    });
    expect(parseJobPage("<html>no data</html>")).toBeNull();
  });
});

describe("TokyoDev connector", () => {
  const pages = {
    "/jobs/apply-from-abroad": list(A, B, C, D),
    "/jobs/no-japanese-required": list(A, C, D),
    [A]: page("Backend Engineer", iso(1)),
    [C]: page("Platform Engineer", iso(40)),
    [D]: page("Account Executive", iso(1)),
  };

  it("keeps recent software jobs that are open to applicants abroad AND need no Japanese", async () => {
    const { f, calls } = site(pages);
    const { jobs, stats } = await tokyoDev.fetchJobs({ fetch: f, since, now, delayMs: 0 });
    expect(jobs.map((j) => j.sourceJobId)).toEqual([A]);
    expect(jobs[0]).toMatchObject({ country: "JP", sourceId: "tokyodev", url: `https://www.tokyodev.com${A}` });
    expect(jobs[0]!.sponsorship).toEqual({ status: "visa_source", evidence: ABROAD_EVIDENCE });
    expect(calls).not.toContain(B); // Japanese required: never fetched
    expect(stats).toMatchObject({ tooOld: 1, notSoftware: 1 });
  });

  it("remembers posting dates: a job known to be old is not fetched again on the next refresh", async () => {
    const store = new Map<string, Date>();
    const cache: PostedDateCache = { get: (p) => store.get(p), set: (p, d) => void store.set(p, d) };
    const first = site(pages);
    await tokyoDevConnector(cache).fetchJobs({ fetch: first.f, since, now, delayMs: 0 });
    expect(first.calls).toContain(C);
    const second = site(pages);
    const r = await tokyoDevConnector(cache).fetchJobs({ fetch: second.f, since, now, delayMs: 0 });
    expect(second.calls).not.toContain(C); // 40 days old, known from the first run
    expect(second.calls).toContain(A); // still recent: fetched to keep it in the feed
    expect(r.jobs.map((j) => j.sourceJobId)).toEqual([A]);
  });

  it("explicit 'no visa support' text in the posting still discards the job", async () => {
    const { f } = site({ ...pages, [A]: page("Backend Engineer", iso(1), "<p>We do not provide visa support.</p>") });
    expect((await tokyoDev.fetchJobs({ fetch: f, since, now, delayMs: 0 })).jobs).toEqual([]);
  });

  it("a page that fails to load becomes a warning", async () => {
    const { f } = site({ ...pages, [A]: undefined as unknown as string });
    const r = await tokyoDev.fetchJobs({ fetch: f, since, now, delayMs: 0 });
    expect(r.jobs).toEqual([]);
    expect(r.warnings?.[0]).toMatch(/HTTP 404/);
  });
});
