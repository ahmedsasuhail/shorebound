import { analyzeJob, confidenceScore, detectAgency, matchScore, type JobDTO, type Profile } from "@shorebound/core";

export interface FeedOptions {
  profile: Profile | null;
  easeByCountry: Map<string, number>;
  sort: "newest" | "match" | "confidence";
  /** Strictness: jobs scoring below this are hidden (counted as "poor fit"). */
  minMatch: number;
  maxPerCompany: number;
  relocationBonus: boolean;
  /** Keep jobs whose sponsorship status is only "possible" (weaker signal). */
  includePossible?: boolean;
  /** Keep jobs whose only signal is an employer-level register match. */
  includeRegister?: boolean;
  /** Keep postings from staffing agencies / recruiters (the real employer and sponsor are unnamed). */
  includeAgencies?: boolean;
  limit?: number;
  now?: Date;
}

export interface Feed {
  jobs: JobDTO[];
  total: number;
  hidden: { notMatching: number; companyCap: number; agency: number };
  /** How many of the listed jobs state employer-offered relocation. */
  relocationOffered: number;
}

/**
 * Jobs scoring at or below this are discarded outright and not even counted: 5 is what non-engineering roles
 * (recruiters, sales, designers...) get, so they are noise, not "weak matches".
 */
export const DISCARD_AT_OR_BELOW = 5;

/** Stronger evidence wins when the same job arrives from two sources. */
const EVIDENCE_RANK: Record<JobDTO["sponsorship"]["status"], number> = {
  confirmed_text: 5,
  confirmed_register: 4,
  visa_source: 3,
  possible: 2,
  unknown: 1,
  negative: 0,
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(
      /\b(?:b\.?v\.?|gmbh|ltd|limited|inc|sas|ag|\(?[mfwdx]\/[mfwdx](?:\/[mfwdx])?\)?|\(all genders\)|h\/f|f\/h)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The same posting often appears on a job board AND on the employer's own board (e.g. Arbeitnow and Greenhouse).
 * Jobs are grouped by company + title + country; when a group spans several sources, only the jobs from the source
 * with the strongest sponsorship evidence are kept. Several jobs from ONE source all stay: an employer can genuinely
 * post three "Software Engineer 3" roles for different teams.
 */
export function dedupeJobs(rows: JobDTO[]): JobDTO[] {
  const groups = new Map<string, JobDTO[]>();
  for (const j of rows) {
    const key = `${normalize(j.company)}|${normalize(j.title)}|${j.country}`;
    groups.set(key, [...(groups.get(key) ?? []), j]);
  }
  const out: JobDTO[] = [];
  for (const group of groups.values()) {
    const best = group.reduce((a, b) => {
      const ra = EVIDENCE_RANK[a.sponsorship.status];
      const rb = EVIDENCE_RANK[b.sponsorship.status];
      return rb > ra || (rb === ra && b.postedAt > a.postedAt) ? b : a;
    });
    out.push(...group.filter((j) => j.sourceId === best.sourceId));
  }
  return out;
}

/** Scores, filters, sorts and caps jobs. Newest-first stays the default (user requirement). */
export function buildFeed(rows: JobDTO[], o: FeedOptions): Feed {
  const now = o.now ?? new Date();
  let notMatching = 0;
  let agencyHidden = 0;
  const scored: JobDTO[] = [];
  for (const j of dedupeJobs(rows)) {
    // Explicit "no sponsorship" is never listed (connectors already drop it; this guards older stored rows).
    if (j.sponsorship.status === "negative") continue;
    if (o.includePossible === false && j.sponsorship.status === "possible") continue;
    if (o.includeRegister === false && j.sponsorship.status === "confirmed_register") continue;
    const ag = detectAgency(j.company ?? "", j.description);
    const agency = ag.agency ? { evidence: ag.evidence! } : undefined;
    const analysis = analyzeJob(j.title, j.description);
    const match = o.profile ? matchScore(o.profile, analysis) : null;
    if (match && match.score <= DISCARD_AT_OR_BELOW) continue;
    if (match && match.score < o.minMatch) {
      notMatching++;
      continue;
    }
    if (agency && o.includeAgencies === false) {
      agencyHidden++;
      continue;
    }
    const confidence = confidenceScore({
      sponsorship: j.sponsorship.status,
      ease: o.easeByCountry.get(j.country) ?? null,
      postedAt: new Date(j.postedAt),
      now,
      descriptionLength: j.description.length,
      hasCompany: Boolean(j.company?.trim()),
      text: `${j.title}\n${j.description}`,
    });
    scored.push({ ...j, analysis, match, confidence, ...(agency ? { agency } : {}) });
  }

  const reloc = (j: JobDTO) => (o.relocationBonus && j.relocation.status === "offered" ? 5 : 0);
  const key: Record<FeedOptions["sort"], (j: JobDTO) => number> = {
    newest: (j) => new Date(j.postedAt).getTime(),
    match: (j) => (j.match?.score ?? 0) + reloc(j) + (j.confidence?.score ?? 0) / 100,
    confidence: (j) => (j.confidence?.score ?? 0) + reloc(j) + (j.match?.score ?? 0) / 100,
  };
  scored.sort(
    (a, b) => key[o.sort](b) - key[o.sort](a) || new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
  );

  let companyCap = 0;
  const perCompany = new Map<string, number>();
  const capped = o.maxPerCompany
    ? scored.filter((j) => {
        const c = j.company.trim().toLowerCase();
        const n = (perCompany.get(c) ?? 0) + 1;
        perCompany.set(c, n);
        if (n > o.maxPerCompany) companyCap++;
        return n <= o.maxPerCompany;
      })
    : scored;

  const jobs = capped.slice(0, o.limit ?? 200);
  return {
    jobs,
    total: capped.length,
    hidden: { notMatching, companyCap, agency: agencyHidden },
    relocationOffered: capped.filter((j) => j.relocation.status === "offered").length,
  };
}
