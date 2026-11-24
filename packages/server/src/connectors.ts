import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  arbeitnow,
  atsConnector,
  fetchCanadaLmia,
  fetchIrelandPermits,
  fetchNetherlandsRegister,
  fetchUkRegisterCsv,
  hackerNews,
  myCareersFuture,
  parseUkRegister,
  type FetchLike,
  type RegisterIndex,
  type RegistersResult,
  type SeedCompany,
  type SheetReader,
  type SourceConnector,
} from "@shorebound/sources";
import { z } from "zod";
import { timedFetch } from "./http.js";

const SeedSchema = z.object({
  companies: z.array(
    z.object({
      name: z.string().min(1),
      ats: z.enum(["greenhouse", "lever", "ashby"]),
      token: z.string().min(1),
      register: z.record(z.string().length(2), z.array(z.string().min(1))).optional(),
    }),
  ),
});

export function loadSeed(dataDir: string): SeedCompany[] {
  return SeedSchema.parse(JSON.parse(readFileSync(join(dataDir, "companies", "seed.json"), "utf8"))).companies;
}

const WEEK_MS = 7 * 86_400_000;

/**
 * UK sponsor register, cached on disk for a week (the file is ~11 MB and changes a few times a month).
 * If the download fails, an older cached copy is still used.
 */
export function ukRegisterLoader(
  appData: string,
  fetchFn: FetchLike,
  now = () => Date.now(),
): () => Promise<RegisterIndex> {
  const file = join(appData, "registers", "gb.csv");
  return async () => {
    let csv: string | null = null;
    const cached = existsSync(file);
    if (cached && now() - statSync(file).mtimeMs < WEEK_MS) csv = readFileSync(file, "utf8");
    if (csv === null) {
      try {
        csv = (await fetchUkRegisterCsv(fetchFn)).csv;
        mkdirSync(join(appData, "registers"), { recursive: true });
        writeFileSync(file, csv);
      } catch (e) {
        if (!cached) throw e;
        csv = readFileSync(file, "utf8");
      }
    }
    return new Map([["GB", parseUkRegister(csv)]]);
  };
}

/**
 * Canada: software-occupation LMIA employers of the last four quarters (XLSX, ~0.5 MB each).
 * Cached as a small JSON list for two weeks (data is published quarterly).
 */
export function canadaRegisterLoader(
  appData: string,
  fetchFn: FetchLike,
  now = () => Date.now(),
  read?: SheetReader,
): () => Promise<RegisterIndex> {
  const file = join(appData, "registers", "ca.json");
  return async () => {
    const cached = existsSync(file);
    if (cached && now() - statSync(file).mtimeMs < 2 * WEEK_MS) {
      return new Map([["CA", new Set<string>(JSON.parse(readFileSync(file, "utf8")).names as string[])]]);
    }
    try {
      const { names, quarters } = await fetchCanadaLmia(fetchFn, { read, delayMs: 1000 });
      mkdirSync(join(appData, "registers"), { recursive: true });
      writeFileSync(file, JSON.stringify({ quarters, names: [...names] }));
      return new Map([["CA", names]]);
    } catch (e) {
      if (!cached) throw e;
      return new Map([["CA", new Set<string>(JSON.parse(readFileSync(file, "utf8")).names as string[])]]);
    }
  };
}

/**
 * Ireland: companies issued employment permits in the latest published year (XLSX, ~0.5 MB).
 * Cached as a small JSON list for two weeks; falls back to an old copy if a download fails.
 */
export function irelandRegisterLoader(
  appData: string,
  fetchFn: FetchLike,
  now = () => Date.now(),
  read?: SheetReader,
): () => Promise<RegisterIndex> {
  const file = join(appData, "registers", "ie.json");
  const fromDisk = () => new Map([["IE", new Set<string>(JSON.parse(readFileSync(file, "utf8")).names as string[])]]);
  return async () => {
    const cached = existsSync(file);
    if (cached && now() - statSync(file).mtimeMs < 2 * WEEK_MS) return fromDisk();
    try {
      const { names, year } = await fetchIrelandPermits(fetchFn, { now: new Date(now()), read });
      mkdirSync(join(appData, "registers"), { recursive: true });
      writeFileSync(file, JSON.stringify({ year, names: [...names] }));
      return new Map([["IE", names]]);
    } catch (e) {
      if (!cached) throw e;
      return fromDisk();
    }
  };
}

/** Netherlands: IND recognised sponsors (one ~1 MB HTML page). Cached for a week; falls back to an old copy. */
export function netherlandsRegisterLoader(
  appData: string,
  fetchFn: FetchLike,
  now = () => Date.now(),
): () => Promise<RegisterIndex> {
  const file = join(appData, "registers", "nl.json");
  const fromDisk = () => new Map([["NL", new Set<string>(JSON.parse(readFileSync(file, "utf8")).names as string[])]]);
  return async () => {
    const cached = existsSync(file);
    if (cached && now() - statSync(file).mtimeMs < WEEK_MS) return fromDisk();
    try {
      const names = await fetchNetherlandsRegister(fetchFn);
      mkdirSync(join(appData, "registers"), { recursive: true });
      writeFileSync(file, JSON.stringify({ names: [...names] }));
      return new Map([["NL", names]]);
    } catch (e) {
      if (!cached) throw e;
      return fromDisk();
    }
  };
}

/** Merges several register loaders; a failing one is reported as a warning, the rest still apply. */
export function combineRegisters(
  loaders: { label: string; load: () => Promise<RegisterIndex> }[],
): () => Promise<RegistersResult> {
  return async () => {
    const index: RegisterIndex = new Map();
    const warnings: string[] = [];
    for (const { label, load } of loaders) {
      try {
        for (const [country, names] of await load()) index.set(country, names);
      } catch (e) {
        warnings.push(`${label} register unavailable (${(e as Error).message}).`);
      }
    }
    if (!index.size) throw new Error(warnings.join(" "));
    return { index, warnings };
  };
}

/** Every job source, in refresh order. `id` matches settings.sources.disabled. */
export const SOURCE_INFO = [
  { id: "arbeitnow", label: "Arbeitnow", description: "Job board with a visa-sponsorship filter. Mostly UK and EU." },
  {
    id: "hackernews",
    label: "Hacker News: Who is hiring?",
    description: "Monthly thread; strongest in the first week of each month.",
  },
  {
    id: "mycareersfuture",
    label: "MyCareersFuture (Singapore)",
    description: "Government job portal. Uses the visa-eligible salary signal.",
  },
  {
    id: "company-boards",
    label: "Company job boards",
    description:
      "Greenhouse, Lever and Ashby boards of employers on the UK, Canada, Ireland or Netherlands registers. Slowest source.",
  },
] as const;

export function buildConnectors(o: { dataDir: string; appData: string; fetchImpl?: typeof fetch }): SourceConnector[] {
  // Register files are large (UK ~11 MB), so they get a longer timeout than job APIs.
  const registerFetch = timedFetch(120_000, o.fetchImpl) as unknown as FetchLike;
  const registers = combineRegisters([
    { label: "UK", load: ukRegisterLoader(o.appData, registerFetch) },
    { label: "Canada", load: canadaRegisterLoader(o.appData, registerFetch) },
    { label: "Ireland", load: irelandRegisterLoader(o.appData, registerFetch) },
    { label: "Netherlands", load: netherlandsRegisterLoader(o.appData, registerFetch) },
  ]);
  return [arbeitnow, hackerNews, myCareersFuture, atsConnector(loadSeed(o.dataDir), registers)];
}
