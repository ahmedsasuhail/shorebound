import { analyzeJob, classify, type Job } from "@shorebound/core";
import { htmlToText } from "./html.js";
import { USER_AGENT, sleep, type FetchContext, type FetchResult, type SourceConnector } from "./types.js";

/**
 * TokyoDev (Japan): English-language developer jobs. robots.txt allows crawling job pages.
 *
 * Signal: TokyoDev's own "Apply from abroad" listing (companies that hire people living outside Japan, i.e. who
 * handle the work visa). We keep only jobs that are ALSO in its "No Japanese required" listing, because the app's
 * users are mostly English-only engineers moving from India.
 *
 * Politeness: 2 list requests, then one request per job page NOT seen before. The listing shows no dates and the
 * sitemap marks nearly every page as recently changed, so each job's datePosted is remembered in a cache supplied
 * by the caller: the first refresh reads each job once, later refreshes only fetch new jobs. A cap bounds the
 * worst case.
 */
const BASE = "https://www.tokyodev.com";
const MAX_JOB_PAGES = 60;

/** Remembers each job's datePosted so a job page is fetched only once. */
export interface PostedDateCache {
  get(path: string): Date | undefined;
  set(path: string, postedAt: Date): void;
  save?(): void;
}

export const ABROAD_EVIDENCE =
  "Listed under TokyoDev's “Apply from abroad” filter: the company hires people living outside Japan.";

/** Job paths like /companies/acme/jobs/backend-engineer found in a listing page. */
export function jobPaths(html: string): Set<string> {
  return new Set([...html.matchAll(/href="(\/companies\/[^/"]+\/jobs\/[^"#?]+)"/g)].map((m) => m[1]!));
}

export interface TokyoDevPosting {
  title: string;
  company: string;
  postedAt: Date;
  description: string;
  city?: string;
  country: string;
}

/** Reads the schema.org JobPosting embedded in a job page. */
export function parseJobPage(html: string): TokyoDevPosting | null {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(m[1]!) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (doc["@type"] !== "JobPosting") continue;
    const postedAt = new Date(String(doc.datePosted ?? ""));
    if (Number.isNaN(postedAt.getTime())) return null;
    const place = doc.jobLocation as
      { address?: { addressRegion?: string; addressLocality?: string; addressCountry?: string } } | undefined;
    return {
      title: String(doc.title ?? "").trim(),
      company: String((doc.hiringOrganization as { name?: string } | undefined)?.name ?? "").trim(),
      postedAt,
      description: htmlToText(String(doc.description ?? "")),
      city: place?.address?.addressRegion ?? place?.address?.addressLocality,
      country: (place?.address?.addressCountry ?? "JP").toUpperCase(),
    };
  }
  return null;
}

export function tokyoDevConnector(cache?: PostedDateCache): SourceConnector {
  return {
    id: "tokyodev",

    async fetchJobs(ctx: FetchContext): Promise<FetchResult> {
      const stats = { requests: 0, seen: 0, tooOld: 0, unknownCountry: 0, notSoftware: 0, noSponsorshipSignal: 0 };
      const jobs: Job[] = [];
      const get = async (path: string) => {
        const res = await ctx.fetch(`${BASE}${path}`, {
          headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        });
        stats.requests++;
        if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
        return res.text();
      };
      const pause = () => sleep(ctx.delayMs ?? 1000);

      const abroad = jobPaths(await get("/jobs/apply-from-abroad"));
      await pause();
      const noJapanese = jobPaths(await get("/jobs/no-japanese-required"));

      const candidates = [...abroad].filter((p) => noJapanese.has(p));
      const fresh = candidates.filter((p) => {
        const known = cache?.get(p);
        if (known && known < ctx.since) {
          stats.tooOld++; // known from an earlier refresh: no request needed
          return false;
        }
        return true;
      });

      const warnings: string[] = [];
      if (fresh.length > MAX_JOB_PAGES)
        warnings.push(`Checked the first ${MAX_JOB_PAGES} of ${fresh.length} recent jobs.`);
      for (const path of fresh.slice(0, MAX_JOB_PAGES)) {
        await pause();
        stats.seen++;
        let posting: TokyoDevPosting | null;
        try {
          posting = parseJobPage(await get(path));
        } catch (e) {
          warnings.push((e as Error).message);
          continue;
        }
        if (posting) cache?.set(path, posting.postedAt);
        const job = posting && toJob(path, posting, ctx, stats);
        if (job) jobs.push(job);
      }
      cache?.save?.();
      return { jobs, stats, warnings };
    },
  };
}

/** Without a cache every candidate page is fetched on each refresh; the server always supplies one. */
export const tokyoDev = tokyoDevConnector();

function toJob(path: string, p: TokyoDevPosting, ctx: FetchContext, stats: FetchResult["stats"]): Job | null {
  if (p.postedAt < ctx.since || p.postedAt > new Date(ctx.now.getTime() + 86_400_000)) {
    stats.tooOld++;
    return null;
  }
  if (!analyzeJob(p.title, "").isSoftware) {
    stats.notSoftware = (stats.notSoftware ?? 0) + 1;
    return null;
  }
  const cls = classify(p.description, { country: p.country });
  if (cls.sponsorship === "negative") {
    stats.noSponsorshipSignal = (stats.noSponsorshipSignal ?? 0) + 1;
    return null;
  }
  return {
    id: `tokyodev:${path}`,
    sourceId: "tokyodev",
    sourceJobId: path,
    url: `${BASE}${path}`,
    title: p.title,
    company: p.company,
    country: p.country,
    city: p.city,
    postedAt: p.postedAt,
    description: p.description,
    sponsorship:
      cls.sponsorship === "confirmed_text"
        ? { status: "confirmed_text", evidence: cls.sponsorshipEvidence }
        : { status: "visa_source", evidence: ABROAD_EVIDENCE },
    relocation:
      cls.relocation === "none" ? { status: "none" } : { status: cls.relocation, evidence: cls.relocationEvidence },
  };
}
