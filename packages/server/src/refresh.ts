import type { SourceConnector } from "@shorebound/sources";
import { arbeitnow } from "@shorebound/sources";
import type { Db } from "./db.js";
import { pruneJobs, upsertJobs } from "./jobs.js";

export const CONNECTORS: SourceConnector[] = [arbeitnow];

export interface RefreshReport {
  startedAt: string;
  sources: { id: string; ok: boolean; seen?: number; kept?: number; inserted?: number; updated?: number; error?: string }[];
}

/** Runs every enabled connector. A failing source never stops the others. */
export async function refreshJobs(
  db: Db,
  opts: { lookbackDays: number; disabled?: string[]; fetchImpl?: typeof fetch; connectors?: SourceConnector[]; now?: Date },
): Promise<RefreshReport> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - opts.lookbackDays * 86_400_000);
  const report: RefreshReport = { startedAt: now.toISOString(), sources: [] };
  const doFetch = (opts.fetchImpl ?? fetch) as never;

  for (const c of opts.connectors ?? CONNECTORS) {
    if (opts.disabled?.includes(c.id)) continue;
    try {
      const r = await c.fetchJobs({ fetch: doFetch, since, now });
      const { inserted, updated } = upsertJobs(db, r.jobs, now);
      report.sources.push({ id: c.id, ok: true, seen: r.stats.seen, kept: r.jobs.length, inserted, updated });
    } catch (e) {
      report.sources.push({ id: c.id, ok: false, error: (e as Error).message });
    }
  }
  pruneJobs(db, new Date(now.getTime() - 30 * 86_400_000));
  return report;
}
