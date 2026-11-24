import { analyzeJob, classify, type Job } from "@shorebound/core";
import { inferCountry } from "./geo.js";
import { htmlToText } from "./html.js";
import { USER_AGENT, sleep, type FetchContext, type FetchResult, type SourceConnector } from "./types.js";

/**
 * Hacker News "Ask HN: Who is hiring?" monthly threads, read through the free Algolia HN API
 * (no key). Posts are free text, conventionally "Company | Role | Location | REMOTE | VISA | ...".
 * Source facts: data/sources/global.json. Each comment has a real timestamp.
 *
 * A post is kept only if it is a software role, its location maps to a country, and the text
 * states sponsorship (a header tag like "VISA" or sentence-level text). Negatives are dropped.
 */
const API = "https://hn.algolia.com/api/v1";
const THREADS = 2; // current and previous month, so early in a month the window is still covered

interface Hit {
  objectID: string;
  created_at: string;
  created_at_i: number;
  author: string;
  parent_id: number | string;
  story_id: number | string;
  comment_text: string | null;
}

const POSITIVE_TAG =
  /^(?:visa(?:\s*sponsorship)?(?:\s*(?:ok|available|provided|friendly|yes))?|visa\s*:\s*yes|h-?1b(?:\s*(?:sponsor\w*|ok|transfers?))?|sponsorship(?:\s*available)?|visa\s*&\s*relocation|relocation\s*&\s*visa)$/i;
const NEGATIVE_TAG = /^(?:no\s+visas?|no\s+sponsorship|visa\s*:\s*no|no\s+h-?1b)\b/i;
const ROLE_WORDS =
  /\b(?:engineer|developer|programmer|architect|sre|devops|swe|sde|full[- ]?stack|front[- ]?end|back[- ]?end|software|data|ml|machine learning|security|qa|mobile|ios|android)\b/i;

export interface ParsedPost {
  company: string;
  title: string;
  location?: string;
  fields: string[];
  body: string;
}

/** Splits the conventional pipe-separated first line. Returns null if the post has no header. */
export function parsePost(html: string): ParsedPost | null {
  const [headerHtml = "", ...rest] = html.split(/<p>/i);
  const header = htmlToText(headerHtml);
  const fields = header
    .split(/\s*[|•]\s*/)
    .map((f) => f.trim())
    .filter(Boolean);
  if (fields.length < 2) return null;
  const company = fields[0]!;
  const title = fields.slice(1).find((f) => ROLE_WORDS.test(f)) ?? "";
  const location = fields.slice(1).find((f) => inferCountry(f));
  return { company, title, location, fields, body: htmlToText([headerHtml, ...rest].join("<p>")) };
}

export function hnSponsorship(
  post: ParsedPost,
  country?: string,
): { status: "confirmed_text" | "negative" | "none"; evidence?: string } {
  const neg = post.fields.find((f) => NEGATIVE_TAG.test(f));
  if (neg) return { status: "negative", evidence: neg };
  const tag = post.fields.slice(1).find((f) => POSITIVE_TAG.test(f.replace(/[()]/g, "").trim()));
  const cls = classify(post.body, { country });
  if (cls.sponsorship === "negative") return { status: "negative", evidence: cls.sponsorshipEvidence };
  if (tag) return { status: "confirmed_text", evidence: `Header tag "${tag}" in the Hacker News post.` };
  if (cls.sponsorship === "confirmed_text") return { status: "confirmed_text", evidence: cls.sponsorshipEvidence };
  return { status: "none" };
}

export const hackerNews: SourceConnector = {
  id: "hackernews",

  async fetchJobs(ctx: FetchContext): Promise<FetchResult> {
    const stats = { requests: 0, seen: 0, tooOld: 0, unknownCountry: 0, notSoftware: 0, noSponsorshipSignal: 0 };
    const warnings: string[] = [];
    const jobs: Job[] = [];
    const get = async (url: string) => {
      const res = await ctx.fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
      stats.requests++;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { hits: unknown[] };
    };

    const found = (await get(`${API}/search_by_date?tags=story,author_whoishiring&hitsPerPage=10`)).hits as {
      objectID: string;
      title: string;
    }[];
    const threads = found.filter((h) => /who is hiring/i.test(h.title)).slice(0, THREADS);
    const sinceSec = Math.floor(ctx.since.getTime() / 1000);

    for (const t of threads) {
      await sleep(ctx.delayMs ?? 1000);
      try {
        const page = await get(
          `${API}/search_by_date?tags=comment,story_${t.objectID}&numericFilters=created_at_i>${sinceSec}&hitsPerPage=1000`,
        );
        for (const h of page.hits as Hit[]) {
          // top-level comments only: replies are discussion, not job posts
          if (String(h.parent_id) !== String(h.story_id) || !h.comment_text) continue;
          stats.seen++;
          const job = toJob(h, ctx, stats);
          if (job) jobs.push(job);
        }
      } catch (e) {
        warnings.push(`${t.title}: ${(e as Error).message}`);
      }
    }
    return { jobs, stats, warnings };
  },
};

function toJob(h: Hit, ctx: FetchContext, stats: FetchResult["stats"]): Job | null {
  const postedAt = new Date(h.created_at);
  if (Number.isNaN(postedAt.getTime()) || postedAt < ctx.since || postedAt > new Date(ctx.now.getTime() + 86_400_000)) {
    stats.tooOld++;
    return null;
  }
  const post = parsePost(h.comment_text!);
  if (!post || !post.title || !analyzeJob(post.title, "").isSoftware) {
    stats.notSoftware = (stats.notSoftware ?? 0) + 1;
    return null;
  }
  const country = inferCountry(post.location);
  if (!country) {
    stats.unknownCountry++;
    return null;
  }

  const s = hnSponsorship(post, country);
  if (s.status !== "confirmed_text") {
    stats.noSponsorshipSignal = (stats.noSponsorshipSignal ?? 0) + 1;
    return null;
  }
  const r = classify(post.body, { country });

  return {
    id: `hackernews:${h.objectID}`,
    sourceId: "hackernews",
    sourceJobId: h.objectID,
    url: `https://news.ycombinator.com/item?id=${h.objectID}`,
    title: post.title,
    company: post.company,
    country,
    city: post.location?.split(/[,/]/)[0]?.trim(),
    workMode: post.fields.some((f) => /^remote\b/i.test(f)) ? "remote" : undefined,
    postedAt,
    description: post.body,
    sponsorship: { status: "confirmed_text", evidence: s.evidence },
    relocation: r.relocation === "none" ? { status: "none" } : { status: r.relocation, evidence: r.relocationEvidence },
  };
}
