import { analyzeJob, classify, type Job } from "@shorebound/core";
import { inferCountry } from "./geo.js";
import { decodeEntities, htmlToText } from "./html.js";
import { normalizeOrg, type RegisterIndex } from "./registers.js";
import { USER_AGENT, sleep, type FetchContext, type FetchLike, type FetchResult, type SourceConnector } from "./types.js";

/**
 * Public job-board APIs used by many employers (no key, no login). Source facts:
 * data/sources/global.json. A company board lists every department, so jobs are kept only if
 * they are software roles, recent, in a known country, AND show a sponsorship signal:
 *   - explicit text in the posting, or
 *   - the employer holds a licence on that country's official sponsor register.
 */
export type AtsKind = "greenhouse" | "lever" | "ashby";

export interface SeedCompany {
  name: string;
  ats: AtsKind;
  token: string;
  /** country → exact organisation names on that country's register. */
  register?: Record<string, string[]>;
}

interface Candidate {
  id: string;
  title: string;
  url: string;
  postedAt: Date | null;
  locations: string[];
  description: string;
  remote?: boolean;
}

const URLS: Record<AtsKind, (t: string) => string> = {
  greenhouse: (t) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(t)}/jobs?content=true`,
  lever: (t) => `https://api.lever.co/v0/postings/${encodeURIComponent(t)}?mode=json`,
  ashby: (t) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(t)}`,
};

const date = (v: unknown): Date | null => {
  const d = new Date(v as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
};
const strs = (...v: unknown[]) => v.flat(Infinity).filter((x): x is string => typeof x === "string" && x.trim() !== "");

// ── Per-ATS parsing ─────────────────────────────────────────────────────────

type GhJob = {
  id: number; title: string; absolute_url: string; first_published?: string; updated_at?: string; content?: string;
  location?: { name?: string }; offices?: { name?: string; location?: string }[];
  metadata?: { name?: string; value?: unknown }[] | null;
};
export function parseGreenhouse(body: unknown): Candidate[] {
  return (((body ?? {}) as { jobs?: GhJob[] }).jobs ?? []).map((j) => ({
    id: String(j.id),
    title: j.title,
    url: j.absolute_url,
    // first_published is the real posting date; updated_at changes on every edit.
    postedAt: date(j.first_published ?? j.updated_at),
    locations: strs(
      j.location?.name,
      (j.metadata ?? []).filter((m) => /location/i.test(m.name ?? "")).map((m) => m.value),
      (j.offices ?? []).flatMap((o) => [o.location, o.name]),
    ),
    description: htmlToText(decodeEntities(j.content ?? "")),
  }));
}

type LvJob = {
  id: string; text: string; hostedUrl: string; createdAt?: number; descriptionPlain?: string; additionalPlain?: string;
  country?: string; workplaceType?: string; categories?: { location?: string; allLocations?: string[] };
};
export function parseLever(body: unknown): Candidate[] {
  return (Array.isArray(body) ? (body as LvJob[]) : []).map((j) => ({
    id: j.id,
    title: j.text,
    url: j.hostedUrl,
    postedAt: j.createdAt ? date(j.createdAt) : null,
    locations: strs(j.country, j.categories?.location, j.categories?.allLocations),
    description: `${j.descriptionPlain ?? ""}\n${j.additionalPlain ?? ""}`.trim(),
    remote: j.workplaceType === "remote",
  }));
}

type AbJob = {
  id: string; title: string; jobUrl: string; publishedAt?: string; descriptionPlain?: string; isListed?: boolean; isRemote?: boolean;
  location?: string; secondaryLocations?: { location?: string }[] | string[];
  address?: { postalAddress?: { addressCountry?: string; addressLocality?: string } };
};
export function parseAshby(body: unknown): Candidate[] {
  return (((body ?? {}) as { jobs?: AbJob[] }).jobs ?? []).filter((j) => j.isListed !== false).map((j) => ({
    id: j.id,
    title: j.title,
    url: j.jobUrl,
    // publishedAt is the LAST publish time: a re-posted job looks new (documented limitation).
    postedAt: date(j.publishedAt),
    locations: strs(
      j.address?.postalAddress?.addressCountry,
      j.location,
      (j.secondaryLocations ?? []).map((s) => (typeof s === "string" ? s : s.location)),
    ),
    description: j.descriptionPlain ?? "",
    remote: j.isRemote,
  }));
}

const PARSERS: Record<AtsKind, (b: unknown) => Candidate[]> = { greenhouse: parseGreenhouse, lever: parseLever, ashby: parseAshby };

// ── Connector ───────────────────────────────────────────────────────────────

/** What being "on the register" means in each country, shown as evidence in the UI. */
const REGISTER_EVIDENCE: Record<string, (name: string) => string> = {
  GB: (n) => `${n} holds a UK Home Office Skilled Worker sponsor licence.`,
  CA: (n) => `${n} was approved for a Labour Market Impact Assessment for software occupations in the last four quarters (Canada's foreign-worker programme).`,
};

export type RegistersResult = RegisterIndex | { index: RegisterIndex; warnings: string[] };

export function atsConnector(companies: SeedCompany[], getRegisters: () => Promise<RegistersResult>): SourceConnector {
  return {
    id: "company-boards",

    async fetchJobs(ctx: FetchContext): Promise<FetchResult> {
      const stats = { requests: 0, seen: 0, tooOld: 0, unknownCountry: 0, notSoftware: 0, noSponsorshipSignal: 0 };
      const warnings: string[] = [];
      const jobs: Job[] = [];

      let registers: RegisterIndex = new Map();
      try {
        const r = await getRegisters();
        if (r instanceof Map) registers = r;
        else {
          registers = r.index;
          warnings.push(...r.warnings);
        }
      } catch (e) {
        warnings.push(`Sponsor register unavailable (${(e as Error).message}); only jobs with explicit sponsorship text will appear.`);
      }

      for (let i = 0; i < companies.length; i++) {
        const co = companies[i]!;
        if (i > 0) await sleep(ctx.delayMs ?? 1000);
        try {
          const res = await (ctx.fetch as FetchLike)(URLS[co.ats](co.token), { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
          stats.requests++;
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          for (const c of PARSERS[co.ats](await res.json())) {
            stats.seen++;
            const job = toJob(co, c, ctx, registers, stats);
            if (job) jobs.push(job);
          }
        } catch (e) {
          warnings.push(`${co.name}: ${(e as Error).message}`);
        }
      }
      return { jobs, stats, warnings };
    },
  };
}

function toJob(co: SeedCompany, c: Candidate, ctx: FetchContext, registers: RegisterIndex, stats: FetchResult["stats"]): Job | null {
  if (!c.postedAt || c.postedAt < ctx.since || c.postedAt > new Date(ctx.now.getTime() + 86_400_000)) { stats.tooOld++; return null; }
  if (!analyzeJob(c.title, "").isSoftware) { stats.notSoftware = (stats.notSoftware ?? 0) + 1; return null; }

  const country = c.locations.map(inferCountry).find(Boolean);
  if (!country) { stats.unknownCountry++; return null; }

  const cls = classify(c.description, { country });
  let sponsorship: Job["sponsorship"];
  if (cls.sponsorship === "negative") { stats.noSponsorshipSignal = (stats.noSponsorshipSignal ?? 0) + 1; return null; }
  if (cls.sponsorship === "confirmed_text") sponsorship = { status: "confirmed_text", evidence: cls.sponsorshipEvidence };
  else {
    const known = registers.get(country);
    const hit = co.register?.[country]?.find((n) => known?.has(normalizeOrg(n)));
    if (!hit) { stats.noSponsorshipSignal = (stats.noSponsorshipSignal ?? 0) + 1; return null; }
    sponsorship = { status: "confirmed_register", evidence: (REGISTER_EVIDENCE[country] ?? ((n: string) => `${n} is on the official ${country} sponsor register.`))(hit) };
  }

  return {
    id: `${co.ats}:${co.token}:${c.id}`,
    sourceId: `${co.ats}`,
    sourceJobId: c.id,
    url: c.url,
    title: c.title,
    company: co.name,
    country,
    city: c.locations.find((l) => inferCountry(l) === country)?.split(",")[0]?.trim(),
    workMode: c.remote ? "remote" : undefined,
    postedAt: c.postedAt,
    description: c.description,
    sponsorship,
    relocation: cls.relocation === "none" ? { status: "none" } : { status: cls.relocation, evidence: cls.relocationEvidence },
  };
}
