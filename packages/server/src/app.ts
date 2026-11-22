import { loadData, type DataStore } from "@shorebound/data-schema";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "./db.js";
import { queryJobs } from "./jobs.js";
import { refreshJobs, type RefreshReport } from "./refresh.js";
import { getResume, removeResume, saveResume } from "./resume.js";
import { SettingsSchema, loadSettings, updateSettings } from "./settings.js";

export interface AppDeps {
  db: Db;
  appData: string;
  dataDir: string;
  /** Test hook. */
  refresh?: (db: Db, opts: { lookbackDays: number; disabled?: string[] }) => Promise<RefreshReport>;
}

const FeedQuery = z.object({
  countries: z.string().optional(), // comma separated
  sinceDays: z.coerce.number().int().min(1).max(30).optional(),
  excludeNegative: z.enum(["true", "false"]).optional(),
  relocation: z.enum(["offered", "any"]).optional(),
  q: z.string().max(100).optional(),
});

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 12 * 1024 * 1024 });
  const data: DataStore = loadData(deps.dataDir);
  const enabledDefaults = data.catalog.countries
    .filter((c) => c.status === "available" && data.countries.get(c.code)?.default_enabled)
    .map((c) => c.code);
  let refreshing: Promise<RefreshReport> | null = null;

  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/catalog", async () => ({
    countries: data.catalog.countries.map((c) => {
      const full = data.countries.get(c.code);
      return {
        code: c.code, name: c.name, region: c.region, status: c.status,
        ease: full?.ease_for_indian_nationals.score ?? null,
        confidence: full?._meta.confidence ?? null,
        note: (c as { note?: string }).note ?? null,
      };
    }),
  }));

  app.get("/api/settings", async () => loadSettings(deps.db, enabledDefaults));
  app.put("/api/settings", async (req, reply) => {
    const parsed = SettingsSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    return updateSettings(deps.db, enabledDefaults, parsed.data as never);
  });

  app.get("/api/jobs", async (req, reply) => {
    const q = FeedQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "Invalid query" });
    const s = loadSettings(deps.db, enabledDefaults);
    const countries = q.data.countries !== undefined
      ? q.data.countries.split(",").filter(Boolean)
      : s.countries;
    const jobs = queryJobs(deps.db, {
      countries,
      sinceDays: q.data.sinceDays ?? s.search.lookbackDays,
      excludeNegative: q.data.excludeNegative ? q.data.excludeNegative === "true" : s.sponsorship.excludeNegative,
      relocation: q.data.relocation ?? (s.sponsorship.relocation === "required" ? "offered" : "any"),
      q: q.data.q,
    });
    return { jobs };
  });

  app.post("/api/refresh", async (_req, reply) => {
    if (refreshing) return reply.code(409).send({ error: "A refresh is already running." });
    const s = loadSettings(deps.db, enabledDefaults);
    const run = deps.refresh ?? ((db, o) => refreshJobs(db, o));
    refreshing = run(deps.db, { lookbackDays: s.search.lookbackDays, disabled: s.sources.disabled });
    try {
      return await refreshing;
    } finally {
      refreshing = null;
    }
  });

  // Resume: raw bytes in the body, original file name in the `x-filename` header (URI-encoded).
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_r, body, done) => done(null, body));
  app.get("/api/resume", async () => ({ resume: getResume(deps.db) ?? null }));
  app.put("/api/resume", async (req, reply) => {
    const name = decodeURIComponent(String(req.headers["x-filename"] ?? ""));
    if (!name) return reply.code(400).send({ error: "Missing x-filename header." });
    try {
      return { resume: saveResume(deps.db, deps.appData, name, req.body as Buffer) };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });
  app.delete("/api/resume", async () => {
    removeResume(deps.db, deps.appData);
    return { resume: null };
  });

  return app;
}
