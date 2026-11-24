import type { Job, JobDTO } from "@shorebound/core";
import type { Db } from "./db.js";

export function upsertJobs(db: Db, jobs: Job[], now = new Date()): { inserted: number; updated: number } {
  const exists = db.prepare("SELECT 1 FROM jobs WHERE id = ?");
  const insert = db.prepare(
    `INSERT INTO jobs (id, source_id, country, title, company, posted_at, first_seen_at, sponsorship, relocation, json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const update = db.prepare(
    `UPDATE jobs SET title = ?, company = ?, posted_at = ?, sponsorship = ?, relocation = ?, json = ? WHERE id = ?`,
  );
  let inserted = 0;
  let updated = 0;
  db.exec("BEGIN");
  try {
    for (const j of jobs) {
      const posted = j.postedAt.toISOString();
      const json = JSON.stringify(j);
      if (exists.get(j.id)) {
        update.run(j.title, j.company, posted, j.sponsorship.status, j.relocation.status, json, j.id);
        updated++;
      } else {
        insert.run(j.id, j.sourceId, j.country, j.title, j.company, posted, now.toISOString(), j.sponsorship.status, j.relocation.status, json);
        inserted++;
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { inserted, updated };
}

/** Deletes jobs posted before `before` so the table does not grow forever. */
export function pruneJobs(db: Db, before: Date): number {
  return Number(db.prepare("DELETE FROM jobs WHERE posted_at < ?").run(before.toISOString()).changes);
}

export interface JobQuery {
  countries?: string[];
  sinceDays?: number;
  excludeNegative?: boolean;
  relocation?: "offered" | "any";
  q?: string;
  limit?: number;
  now?: Date;
}

/** Newest first. Filters are applied in SQL. */
export function queryJobs(db: Db, f: JobQuery = {}): JobDTO[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  const now = f.now ?? new Date();
  if (f.sinceDays) {
    where.push("posted_at >= ?");
    args.push(new Date(now.getTime() - f.sinceDays * 86_400_000).toISOString());
  }
  if (f.countries) {
    if (f.countries.length === 0) return [];
    where.push(`country IN (${f.countries.map(() => "?").join(",")})`);
    args.push(...f.countries);
  }
  if (f.excludeNegative) where.push("sponsorship != 'negative'");
  if (f.relocation === "offered") where.push("relocation = 'offered'");
  if (f.q?.trim()) {
    where.push("(title LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\')");
    const like = `%${f.q.trim().replace(/[\\%_]/g, "\\$&")}%`;
    args.push(like, like);
  }
  const sql = `SELECT json, first_seen_at FROM jobs ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY posted_at DESC LIMIT ?`;
  args.push(Math.min(f.limit ?? 200, 5000));
  const rows = db.prepare(sql).all(...args) as { json: string; first_seen_at: string }[];
  return rows.map((r) => ({ ...(JSON.parse(r.json) as JobDTO), firstSeenAt: r.first_seen_at }));
}
