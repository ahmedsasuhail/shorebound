import { describe, expect, it } from "vitest";
import { hackerNews, hnSponsorship, parsePost } from "./hackernews.js";
import type { FetchLike } from "./types.js";

const now = new Date("2026-11-22T12:00:00Z");
const since = new Date(now.getTime() - 7 * 86_400_000);
const iso = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

const hit = (id: string, text: string, daysAgo = 1, parent = "100") => ({
  objectID: id,
  created_at: iso(daysAgo),
  created_at_i: Math.floor((now.getTime() - daysAgo * 86_400_000) / 1000),
  author: "a",
  parent_id: parent,
  story_id: "100",
  comment_text: text,
});

const api =
  (comments: unknown[]): FetchLike =>
  async (url) => ({
    ok: true,
    status: 200,
    text: async () => "",
    json: async () =>
      url.includes("author_whoishiring")
        ? {
            hits: [
              { objectID: "100", title: "Ask HN: Who is hiring? (November 2026)" },
              { objectID: "99", title: "Ask HN: Who wants to be hired? (November 2026)" },
            ],
          }
        : { hits: comments },
  });
const run = (comments: unknown[]) => hackerNews.fetchJobs({ fetch: api(comments), since, now, delayMs: 0 });

describe("parsePost", () => {
  it("reads company, role and location from the pipe header", () => {
    const p = parsePost("Acme | Senior Backend Engineer | London, UK | REMOTE | VISA<p>We build things.")!;
    expect(p).toMatchObject({ company: "Acme", title: "Senior Backend Engineer", location: "London, UK" });
    expect(p.fields).toContain("VISA");
  });
  it("returns null for posts without a header", () => {
    expect(parsePost("Just some text with no header")).toBeNull();
  });
});

describe("hnSponsorship", () => {
  const s = (html: string, c?: string) => hnSponsorship(parsePost(html)!, c);
  it.each([
    ["Acme | Engineer | Berlin | VISA", "confirmed_text"],
    ["Acme | Engineer | Berlin | VISA sponsorship", "confirmed_text"],
    ["Acme | Engineer | Berlin | H1B<p>x", "confirmed_text"],
    ["Acme | Engineer | Berlin<p>We offer visa sponsorship and relocation.", "confirmed_text"],
    ["Acme | Engineer | Berlin | No visa sponsorship", "negative"],
    ["Acme | Engineer | Berlin<p>We cannot provide visa sponsorship.", "negative"],
    ["Acme | Engineer | Berlin | ONSITE<p>Great team.", "none"],
    ["Acme | Engineer | Tokyo<p>Tokyo, Japan (no visa support, US/Canada remote available)", "negative"],
  ])("%s → %s", (html, status) => expect(s(html).status).toBe(status));
});

describe("hackerNews connector", () => {
  it("keeps recent software posts with a visa tag and a known country", async () => {
    const { jobs, stats } = await run([
      hit("1", "Acme | Senior Backend Engineer | London, UK | VISA | Relocation package<p>Node and Postgres."),
      hit("2", "Beta | Software Engineer | Berlin | ONSITE<p>No mention of visas."),
      hit("3", "Gamma | Account Executive | London | VISA<p>Sales."),
      hit("4", "Delta | Software Engineer | Atlantis | VISA"),
      hit("5", "Reply: great job", 1, "999"),
      hit("6", "Echo | Software Engineer | London | No visa sponsorship"),
    ]);
    expect(jobs.map((j) => j.sourceJobId)).toEqual(["1"]);
    expect(jobs[0]).toMatchObject({
      company: "Acme",
      title: "Senior Backend Engineer",
      country: "GB",
      sourceId: "hackernews",
      url: "https://news.ycombinator.com/item?id=1",
    });
    expect(jobs[0]!.sponsorship.status).toBe("confirmed_text");
    expect(jobs[0]!.relocation.status).toBe("offered");
    expect(stats).toMatchObject({ seen: 5, notSoftware: 1, unknownCountry: 1, noSponsorshipSignal: 2 });
  });

  it("uses the comment's own timestamp and drops posts older than the window", async () => {
    const { jobs, stats } = await run([hit("1", "Acme | Software Engineer | London | VISA", 30)]);
    expect(jobs).toHaveLength(0);
    expect(stats.tooOld).toBe(1);
  });

  it("marks remote posts and decodes HTML entities", async () => {
    const { jobs } = await run([
      hit("1", "Acme | Software Engineer | Remote (US) | VISA<p>Tom &amp; Jerry&#x27;s stack"),
    ]);
    expect(jobs[0]).toMatchObject({ country: "US", workMode: "remote" });
    expect(jobs[0]!.description).toContain("Tom & Jerry's stack");
  });

  it("reports a failing thread as a warning and keeps the rest", async () => {
    let n = 0;
    const f: FetchLike = async (url) => {
      if (url.includes("author_whoishiring"))
        return {
          ok: true,
          status: 200,
          text: async () => "",
          json: async () => ({
            hits: [
              { objectID: "100", title: "Ask HN: Who is hiring? (November 2026)" },
              { objectID: "98", title: "Ask HN: Who is hiring? (October 2026)" },
            ],
          }),
        };
      return ++n === 1
        ? { ok: false, status: 500, text: async () => "", json: async () => ({}) }
        : {
            ok: true,
            status: 200,
            text: async () => "",
            json: async () => ({ hits: [hit("1", "Acme | Software Engineer | London | VISA")] }),
          };
    };
    const r = await hackerNews.fetchJobs({ fetch: f, since, now, delayMs: 0 });
    expect(r.jobs).toHaveLength(1);
    expect(r.warnings?.[0]).toMatch(/HTTP 500/);
  });
});
