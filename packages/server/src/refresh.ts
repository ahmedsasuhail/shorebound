import type { SourceConnector } from "@shorebound/sources";
import type { Db } from "./db.js";
import { timedFetch } from "./http.js";
import { pruneJobs, purgeNegative, upsertJobs } from "./jobs.js";

export interface RefreshReport {
  startedAt: string;
  sources: {
    id: string;
    ok: boolean;
    seen?: number;
    kept?: number;
    inserted?: number;
    updated?: number;
    error?: string;
    warnings?: string[];
    stats?: Record<string, number>;
  }[];
}

/** Runs every enabled connector. A failing source never stops the others. */
export async function refreshJobs(
  db: Db,
  opts: {
    lookbackDays: number;
    disabled?: string[];
    fetchImpl?: typeof fetch;
    connectors: SourceConnector[];
    now?: Date;
  },
): Promise<RefreshReport> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - opts.lookbackDays * 86_400_000);
  const report: RefreshReport = { startedAt: now.toISOString(), sources: [] };
  const doFetch = (opts.fetchImpl ?? timedFetch()) as never;

  for (const c of opts.connectors) {
    if (opts.disabled?.includes(c.id)) continue;
    try {
      const r = await c.fetchJobs({ fetch: doFetch, since, now });
      const { inserted, updated } = upsertJobs(db, r.jobs, now);
      report.sources.push({
        id: c.id,
        ok: true,
        seen: r.stats.seen,
        kept: r.jobs.length,
        inserted,
        updated,
        warnings: r.warnings,
        stats: { ...r.stats },
      });
    } catch (e) {
      report.sources.push({ id: c.id, ok: false, error: (e as Error).message });
    }
  }
  pruneJobs(db, new Date(now.getTime() - 30 * 86_400_000));
  purgeNegative(db);
  return report;
}
