import { analyzeJob, confidenceScore, matchScore, type JobDTO, type Profile } from "@shorebound/core";

export interface FeedOptions {
  profile: Profile | null;
  easeByCountry: Map<string, number>;
  sort: "newest" | "match" | "confidence";
  onlyMatching: boolean;
  /** Jobs scoring below this are hidden when `onlyMatching` is on. */
  minMatch: number;
  maxPerCompany: number;
  relocationBonus: boolean;
  /** Keep jobs whose sponsorship status is only "possible" (weaker signal). */
  includePossible?: boolean;
  limit?: number;
  now?: Date;
}

export interface Feed {
  jobs: JobDTO[];
  total: number;
  hidden: { notMatching: number; companyCap: number };
}

/** Scores, filters, sorts and caps jobs. Newest-first stays the default (user requirement). */
export function buildFeed(rows: JobDTO[], o: FeedOptions): Feed {
  const now = o.now ?? new Date();
  let notMatching = 0;
  const scored: JobDTO[] = [];
  for (const j of rows) {
    if (o.includePossible === false && j.sponsorship.status === "possible") continue;
    const analysis = analyzeJob(j.title, j.description);
    const match = o.profile ? matchScore(o.profile, analysis) : null;
    if (o.onlyMatching && match && match.score < o.minMatch) {
      notMatching++;
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
    scored.push({ ...j, analysis, match, confidence });
  }

  const reloc = (j: JobDTO) => (o.relocationBonus && j.relocation.status === "offered" ? 5 : 0);
  const key: Record<FeedOptions["sort"], (j: JobDTO) => number> = {
    newest: (j) => new Date(j.postedAt).getTime(),
    match: (j) => (j.match?.score ?? 0) + reloc(j) + (j.confidence?.score ?? 0) / 100,
    confidence: (j) => (j.confidence?.score ?? 0) + reloc(j) + (j.match?.score ?? 0) / 100,
  };
  scored.sort((a, b) => key[o.sort](b) - key[o.sort](a) || new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

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

  return { jobs: capped.slice(0, o.limit ?? 200), total: capped.length, hidden: { notMatching, companyCap } };
}
