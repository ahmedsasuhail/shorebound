import type { Job } from "@shorebound/core";

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
  /** Needed only for binary downloads (e.g. XLSX). */
  arrayBuffer?(): Promise<ArrayBuffer>;
}>;

export interface FetchContext {
  fetch: FetchLike;
  /** Only jobs posted at or after this instant are wanted. */
  since: Date;
  now: Date;
  /** Delay between requests to the same host (ms). Tests pass 0. */
  delayMs?: number;
}

export interface FetchStats {
  requests: number;
  seen: number;
  /** Dropped because the posting date was missing or older than `since`. */
  tooOld: number;
  /** Dropped because the country could not be determined from the location. */
  unknownCountry: number;
  /** Dropped as not a software role (company boards list every department). */
  notSoftware?: number;
  /** Dropped because nothing showed the employer sponsors (no text, not on a register). */
  noSponsorshipSignal?: number;
}

export interface FetchResult {
  jobs: Job[];
  stats: FetchStats;
  /** Non-fatal problems (e.g. one company board failed). */
  warnings?: string[];
}

export interface SourceConnector {
  id: string;
  fetchJobs(ctx: FetchContext): Promise<FetchResult>;
}

/** Honest, identifying User-Agent (PLAN.md polite-scraping defaults). */
export const USER_AGENT = "Shorebound/0.0 (+https://github.com/ahmedsasuhail/shorebound)";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
