import { analyzeJob, classify, type Job } from "@shorebound/core";
import { htmlToText } from "./html.js";
import { USER_AGENT, sleep, type FetchContext, type FetchResult, type SourceConnector } from "./types.js";

/**
 * MyCareersFuture (Singapore government job portal) public JSON API, no key.
 * Source facts: data/countries/sg.json, data/sources/global.json.
 *
 * Singapore has no sponsor register and only ~1% of postings state sponsorship, so a job is kept when:
 *   1. the text states sponsorship ("confirmed_text"), or
 *   2. the posted salary clears the Employment Pass qualifying salary ("possible", a WEAKER signal:
 *      the salary makes the role EP-eligible, it does not prove the employer sponsors).
 * Explicit negatives ("Singapore citizens/PR only", "no sponsorship") are dropped.
 */
const API = "https://api.mycareersfuture.gov.sg/v2/jobs";
const QUERIES = ["software engineer", "full stack developer", "backend developer", "frontend developer"];
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

/**
 * Employment Pass qualifying salary used as the bar, SGD per month. From data/countries/sg.json: the
 * age-30 example is S$7,223 today and S$7,750 for new applications from 1 Jan 2027. The stricter 2027 figure
 * is used so a job that passes also passes next year.
 */
export const EP_QUALIFYING_MONTHLY_SGD = 7750;

interface RawJob {
  uuid: string;
  title: string;
  description?: string;
  postedCompany?: { name?: string } | null;
  hiringCompany?: { name?: string } | null;
  salary?: { minimum?: number | null; maximum?: number | null; type?: { salaryType?: string } } | null;
  metadata?: { originalPostingDate?: string; newPostingDate?: string; jobDetailsUrl?: string; isHideSalary?: boolean };
}

/** "ACME PTE. LTD." → "Acme Pte. Ltd." (the portal stores many names in capitals). */
export function tidyCompany(name: string): string {
  const n = name.trim();
  return n === n.toUpperCase() && /[A-Z]{3}/.test(n)
    ? n.toLowerCase().replace(/(^|[\s(/&-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
    : n;
}

function monthlyMax(s: RawJob["salary"]): number | null {
  if (!s || s.type?.salaryType !== "Monthly") return null;
  const v = s.maximum ?? s.minimum ?? null;
  return v && v > 0 ? v : null;
}

export const myCareersFuture: SourceConnector = {
  id: "mycareersfuture",

  async fetchJobs(ctx: FetchContext): Promise<FetchResult> {
    const stats = { requests: 0, seen: 0, tooOld: 0, unknownCountry: 0, notSoftware: 0, noSponsorshipSignal: 0 };
    const warnings: string[] = [];
    const seen = new Set<string>();
    const jobs: Job[] = [];

    for (const [qi, q] of QUERIES.entries()) {
      for (let page = 0; page < MAX_PAGES; page++) {
        if (qi > 0 || page > 0) await sleep(ctx.delayMs ?? 1000);
        let results: RawJob[];
        try {
          const url = `${API}?search=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&page=${page}&sortBy=new_posting_date`;
          const res = await ctx.fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
          stats.requests++;
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          results = ((await res.json()) as { results?: RawJob[] }).results ?? [];
        } catch (e) {
          warnings.push(`"${q}" page ${page}: ${(e as Error).message}`);
          break;
        }
        if (!results.length) break;

        let reachedOld = false;
        for (const raw of results) {
          if (seen.has(raw.uuid)) continue;
          seen.add(raw.uuid);
          stats.seen++;
          const job = toJob(raw, ctx, stats);
          if (job === "old") reachedOld = true;
          else if (job) jobs.push(job);
        }
        if (reachedOld || results.length < PAGE_SIZE) break; // newest first: the rest is older
      }
    }
    return { jobs, stats, warnings };
  },
};

const sgDate = (d?: string) => {
  const t = d ? new Date(`${d}T00:00:00+08:00`) : null; // Singapore time
  return t && !Number.isNaN(t.getTime()) ? t : null;
};

/**
 * Returns "old" only when the LISTING position is past the window: results are sorted by newPostingDate
 * (latest repost), so that is the date that tells us when to stop paging. Whether a job is genuinely new is a
 * separate check on originalPostingDate: a repost keeps its original date, so an old job can't pose as new.
 */
function toJob(raw: RawJob, ctx: FetchContext, stats: FetchResult["stats"]): Job | "old" | null {
  const listed = sgDate(raw.metadata?.newPostingDate) ?? sgDate(raw.metadata?.originalPostingDate);
  const postedAt = sgDate(raw.metadata?.originalPostingDate) ?? listed;
  if (!listed || !postedAt || postedAt > new Date(ctx.now.getTime() + 86_400_000)) {
    stats.tooOld++;
    return null;
  }
  if (listed < ctx.since) {
    stats.tooOld++;
    return "old";
  }
  if (postedAt < ctx.since) {
    stats.tooOld++;
    return null;
  }
  if (!analyzeJob(raw.title, "").isSoftware) {
    stats.notSoftware = (stats.notSoftware ?? 0) + 1;
    return null;
  }

  const description = htmlToText(raw.description ?? "");
  const cls = classify(description, { country: "SG" });
  let sponsorship: Job["sponsorship"];
  if (cls.sponsorship === "negative") {
    stats.noSponsorshipSignal = (stats.noSponsorshipSignal ?? 0) + 1;
    return null;
  }
  if (cls.sponsorship === "confirmed_text")
    sponsorship = { status: "confirmed_text", evidence: cls.sponsorshipEvidence };
  else {
    const salary = monthlyMax(raw.salary);
    if (salary === null || salary < EP_QUALIFYING_MONTHLY_SGD) {
      stats.noSponsorshipSignal = (stats.noSponsorshipSignal ?? 0) + 1;
      return null;
    }
    sponsorship = {
      status: "possible",
      evidence: `Posted salary up to S$${salary.toLocaleString("en-SG")}/month is above the Employment Pass qualifying salary (S$${EP_QUALIFYING_MONTHLY_SGD.toLocaleString("en-SG")} for a ~30-year-old from Jan 2027), so the role can be EP-eligible. The posting does not say the employer sponsors; ask before applying.`,
    };
  }

  const company = raw.hiringCompany?.name ?? raw.postedCompany?.name ?? "";
  return {
    id: `mycareersfuture:${raw.uuid}`,
    sourceId: "mycareersfuture",
    sourceJobId: raw.uuid,
    url: raw.metadata?.jobDetailsUrl ?? `https://www.mycareersfuture.gov.sg/job/${raw.uuid}`,
    title: raw.title,
    company: tidyCompany(company),
    country: "SG",
    city: "Singapore",
    postedAt,
    description,
    sponsorship,
    relocation:
      cls.relocation === "none" ? { status: "none" } : { status: cls.relocation, evidence: cls.relocationEvidence },
  };
}
