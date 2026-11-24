import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { arbeitnow } from "./arbeitnow.js";
import { inferCountry } from "./geo.js";
import { htmlToText } from "./html.js";
import type { FetchLike } from "./types.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("./__fixtures__/arbeitnow.json", import.meta.url)), "utf8"),
) as { data: { created_at: number }[] };

const newest = Math.max(...fixture.data.map((j) => j.created_at));
const now = new Date((newest + 3600) * 1000);
const since = new Date(now.getTime() - 7 * 86_400_000);

const fakeFetch: FetchLike = async () => ({ ok: true, status: 200, json: async () => fixture, text: async () => "" });

describe("arbeitnow connector", () => {
  it("keeps only jobs from the last 7 days and drops the 30-day-old one", async () => {
    const { jobs, stats } = await arbeitnow.fetchJobs({ fetch: fakeFetch, since, now, delayMs: 0 });
    expect(jobs.map((j) => j.sourceJobId)).not.toContain("old-1");
    expect(stats.tooOld).toBe(1);
    expect(jobs.length).toBeGreaterThan(0);
  });

  it("uses the real posting date and country inferred from the location", async () => {
    const { jobs } = await arbeitnow.fetchJobs({ fetch: fakeFetch, since, now, delayMs: 0 });
    for (const j of jobs) {
      expect(j.country).toBe("DE");
      expect(j.postedAt.getTime()).toBeGreaterThanOrEqual(since.getTime());
    }
  });

  it("marks visa-filter jobs as visa_source and lets explicit negative text veto", async () => {
    const { jobs } = await arbeitnow.fetchJobs({ fetch: fakeFetch, since, now, delayMs: 0 });
    expect(jobs.find((j) => j.sourceJobId === "neg-1")?.sponsorship.status).toBe("negative");
    const ok = jobs.filter((j) => j.sourceJobId !== "neg-1");
    expect(ok.every((j) => ["visa_source", "confirmed_text"].includes(j.sponsorship.status))).toBe(true);
  });

  it("throws a clear error on HTTP failure", async () => {
    const bad: FetchLike = async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => "" });
    await expect(arbeitnow.fetchJobs({ fetch: bad, since, now, delayMs: 0 })).rejects.toThrow(/HTTP 503/);
  });

  it("stops paginating once it reaches jobs older than the window", async () => {
    let calls = 0;
    const paged: FetchLike = async () => {
      calls++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ ...fixture, links: { next: "https://x/next" } }),
        text: async () => "",
      };
    };
    await arbeitnow.fetchJobs({ fetch: paged, since, now, delayMs: 0 });
    expect(calls).toBe(1);
  });
});

describe("inferCountry", () => {
  it.each([
    ["London", "GB"],
    ["Berlin, Germany", "DE"],
    ["Zürich", "CH"],
    ["Zurich, Zürich, Switzerland", "CH"],
    ["Berlin Office", "DE"],
    ["Munich", "DE"],
    ["Amsterdam", "NL"],
    ["Cambridge, United States", "US"],
    ["Dublin", "IE"],
    ["Dubai", "AE"],
    ["San Francisco, CA", "US"],
  ])("%s → %s", (loc, code) => expect(inferCountry(loc)).toBe(code));

  it("returns undefined when unknown or empty", () => {
    expect(inferCountry("")).toBeUndefined();
    expect(inferCountry("Remote")).toBeUndefined();
    expect(inferCountry("Atlantis")).toBeUndefined();
  });
});

describe("htmlToText", () => {
  it("strips tags and keeps sentence breaks between blocks", () => {
    expect(htmlToText("<p>We cannot sponsor</p><p>Free lunch &amp; gym</p>")).toBe(
      "We cannot sponsor. Free lunch & gym.",
    );
  });
});
