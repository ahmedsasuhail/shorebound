import { classify, type Job } from "@shorebound/core";
import { inferCountry } from "./geo.js";
import { htmlToText } from "./html.js";
import { USER_AGENT, sleep, type FetchContext, type FetchResult, type SourceConnector } from "./types.js";

/**
 * Arbeitnow free job-board API (no key). `visa_sponsorship=true` is a server-side filter,
 * results are newest first (`created_at`, unix seconds), refreshed hourly.
 * Terms: free public API, "please do not abuse"; link back to the site (we keep `url`).
 * Source facts: data/sources/global.json.
 */
export const ARBEITNOW_URL = "https://www.arbeitnow.com/api/job-board-api?visa_sponsorship=true";
const MAX_PAGES = 5;

interface RawJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  location: string;
  created_at: number;
}
interface RawPage {
  data: RawJob[];
  links?: { next?: string | null };
}

export const arbeitnow: SourceConnector = {
  id: "arbeitnow",

  async fetchJobs(ctx: FetchContext): Promise<FetchResult> {
    const stats = { requests: 0, seen: 0, tooOld: 0, unknownCountry: 0 };
    const jobs: Job[] = [];
    let url: string | null | undefined = ARBEITNOW_URL;

    for (let page = 0; url && page < MAX_PAGES; page++) {
      if (page > 0) await sleep(ctx.delayMs ?? 1000);
      const res = await ctx.fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
      stats.requests++;
      if (!res.ok) throw new Error(`Arbeitnow returned HTTP ${res.status}`);
      const body = (await res.json()) as RawPage;

      let reachedOld = false;
      for (const raw of body.data) {
        stats.seen++;
        const postedAt = new Date(raw.created_at * 1000);
        if (!(raw.created_at > 0) || postedAt < ctx.since || postedAt > new Date(ctx.now.getTime() + 86_400_000)) {
          stats.tooOld++;
          reachedOld = true; // newest-first: everything after this is older too
          continue;
        }
        const country = inferCountry(raw.location);
        if (!country) {
          stats.unknownCountry++;
          continue;
        }
        jobs.push(normalize(raw, postedAt, country));
      }
      url = reachedOld ? null : body.links?.next;
    }
    return { jobs, stats };
  },
};

function normalize(raw: RawJob, postedAt: Date, country: string): Job {
  const description = htmlToText(raw.description);
  const c = classify(description, { country });
  // The board's visa filter is a source-level signal; explicit text can strengthen or veto it.
  const sponsorship =
    c.sponsorship === "negative"
      ? { status: "negative" as const, evidence: c.sponsorshipEvidence }
      : c.sponsorship === "confirmed_text"
        ? { status: "confirmed_text" as const, evidence: c.sponsorshipEvidence }
        : { status: "visa_source" as const, evidence: "Listed under Arbeitnow's visa-sponsorship filter." };
  const relocation =
    c.relocation === "none"
      ? { status: "none" as const }
      : { status: c.relocation, evidence: c.relocationEvidence };

  return {
    id: `arbeitnow:${raw.slug}`,
    sourceId: "arbeitnow",
    sourceJobId: raw.slug,
    url: raw.url,
    title: raw.title,
    company: raw.company_name,
    country,
    city: raw.location.split(",")[0]?.trim() || undefined,
    workMode: raw.remote ? "remote" : undefined,
    postedAt,
    description,
    sponsorship,
    relocation,
  };
}
