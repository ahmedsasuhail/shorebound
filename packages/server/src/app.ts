import { PROFILE_VERSION, extractProfile, type Profile } from "@shorebound/core";
import { loadData, type DataStore } from "@shorebound/data-schema";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { deleteSetting, getSetting, putSetting, type Db } from "./db.js";
import { buildConnectors } from "./connectors.js";
import { buildFeed } from "./feed.js";
import { extractResumeText } from "./resumeText.js";
import { queryJobs } from "./jobs.js";
import { refreshJobs, type RefreshReport } from "./refresh.js";
import { getResume, removeResume, resumePath, saveResume } from "./resume.js";
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

const ProfileSchema = z.object({
  skills: z.array(z.string().min(1).max(40)).max(80),
  yearsExperience: z.number().min(0).max(50).nullable(),
  seniority: z.enum(["intern", "junior", "mid", "senior", "lead", "manager"]),
  families: z.array(z.enum(["frontend", "backend", "fullstack", "mobile", "devops", "data", "qa", "security", "general"])),
  title: z.string().max(80).nullable(),
});

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 12 * 1024 * 1024 });
  const data: DataStore = loadData(deps.dataDir);
  const enabledDefaults = data.catalog.countries
    .filter((c) => c.status === "available" && data.countries.get(c.code)?.default_enabled)
    .map((c) => c.code);
  let refreshing: Promise<RefreshReport> | null = null;
  const easeByCountry = new Map([...data.countries].map(([code, c]) => [code, c.ease_for_indian_nationals.score]));
  /**
   * Returns the stored profile. A rule-derived profile saved by an older extractor is re-read from the
   * stored resume (profiles the user edited are never touched).
   */
  const getProfile = async (): Promise<Profile | null> => {
    const stored = getSetting<Profile>(deps.db, "profile") ?? null;
    if (!stored || stored.source !== "rules" || (stored.version ?? 0) >= PROFILE_VERSION) return stored;
    const info = getResume(deps.db);
    if (!info) return stored;
    try {
      const fresh = extractProfile(await extractResumeText(resumePath(deps.appData, info)));
      putSetting(deps.db, "profile", fresh);
      return fresh;
    } catch {
      return stored;
    }
  };

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
    // Only apply keys the client sent: zod fills defaults for absent keys, which would
    // otherwise overwrite saved values (e.g. reset `countries` to []).
    const sent = new Set(Object.keys((req.body ?? {}) as object));
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => sent.has(k)));
    return updateSettings(deps.db, enabledDefaults, patch as never);
  });

  app.get("/api/jobs", async (req, reply) => {
    const q = FeedQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "Invalid query" });
    const s = loadSettings(deps.db, enabledDefaults);
    const countries = q.data.countries !== undefined
      ? q.data.countries.split(",").filter(Boolean)
      : s.countries;
    // No profile → no feed. Without a resume there is nothing to judge fit against, and an
    // unranked list of every job would be misleading.
    const profile = await getProfile();
    if (!profile) return { jobs: [], total: 0, hidden: { notMatching: 0, companyCap: 0 }, needsProfile: true };
    const rows = queryJobs(deps.db, {
      countries,
      sinceDays: q.data.sinceDays ?? s.search.lookbackDays,
      excludeNegative: q.data.excludeNegative ? q.data.excludeNegative === "true" : s.sponsorship.excludeNegative,
      relocation: q.data.relocation ?? (s.sponsorship.relocation === "required" ? "offered" : "any"),
      q: q.data.q,
      limit: 5000,
    });
    return buildFeed(rows, {
      profile,
      easeByCountry,
      sort: s.search.sort,
      onlyMatching: s.search.onlyMatching,
      minMatch: s.search.minMatch,
      maxPerCompany: s.search.maxPerCompany,
      relocationBonus: s.sponsorship.relocation === "bonus",
    });
  });

  app.get("/api/profile", async () => ({ profile: await getProfile() }));
  app.put("/api/profile", async (req, reply) => {
    const parsed = ProfileSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    const profile: Profile = { ...parsed.data, source: "user" };
    putSetting(deps.db, "profile", profile);
    return { profile };
  });

  app.post("/api/refresh", async (_req, reply) => {
    if (refreshing) return reply.code(409).send({ error: "A refresh is already running." });
    const s = loadSettings(deps.db, enabledDefaults);
    const run = deps.refresh ?? ((db, o) => refreshJobs(db, { ...o, connectors: buildConnectors({ dataDir: deps.dataDir, appData: deps.appData }) }));
    refreshing = run(deps.db, { lookbackDays: s.search.lookbackDays, disabled: s.sources.disabled });
    try {
      return await refreshing;
    } finally {
      refreshing = null;
    }
  });

  // Resume: raw bytes in the body, original file name in the `x-filename` header (URI-encoded).
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_r, body, done) => done(null, body));
  // Routes like POST /api/refresh take no body; accept (and ignore) whatever content type a client sends.
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_r, body, done) => done(null, body));
  app.get("/api/resume", async () => ({ resume: getResume(deps.db) ?? null }));
  app.put("/api/resume", async (req, reply) => {
    const name = decodeURIComponent(String(req.headers["x-filename"] ?? ""));
    if (!name) return reply.code(400).send({ error: "Missing x-filename header." });
    let resume;
    try {
      resume = saveResume(deps.db, deps.appData, name, req.body as Buffer);
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
    // Build the profile locally from the resume text. A failed parse keeps the file but no profile.
    let profile: Profile | null = null;
    let parseError: string | null = null;
    try {
      const text = await extractResumeText(resumePath(deps.appData, resume));
      profile = extractProfile(text);
      putSetting(deps.db, "profile", profile);
    } catch (e) {
      parseError = `Saved, but could not read text from the file: ${(e as Error).message}`;
    }
    return { resume, profile, parseError };
  });
  app.delete("/api/resume", async () => {
    removeResume(deps.db, deps.appData);
    deleteSetting(deps.db, "profile"); // the profile was derived from this resume
    return { resume: null };
  });

  return app;
}
