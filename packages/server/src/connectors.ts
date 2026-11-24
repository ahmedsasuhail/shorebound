import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  arbeitnow, atsConnector, fetchCanadaLmia, fetchUkRegisterCsv, hackerNews, myCareersFuture, parseUkRegister,
  type FetchLike, type RegisterIndex, type RegistersResult, type SeedCompany, type SheetReader, type SourceConnector,
} from "@shorebound/sources";
import { z } from "zod";

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
export function ukRegisterLoader(appData: string, fetchFn: FetchLike, now = () => Date.now()): () => Promise<RegisterIndex> {
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

/** Merges several register loaders; a failing one is reported as a warning, the rest still apply. */
export function combineRegisters(loaders: { label: string; load: () => Promise<RegisterIndex> }[]): () => Promise<RegistersResult> {
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

export function buildConnectors(o: { dataDir: string; appData: string; fetchImpl?: typeof fetch }): SourceConnector[] {
  const f = (o.fetchImpl ?? fetch) as unknown as FetchLike;
  const registers = combineRegisters([
    { label: "UK", load: ukRegisterLoader(o.appData, f) },
    { label: "Canada", load: canadaRegisterLoader(o.appData, f) },
  ]);
  return [arbeitnow, hackerNews, myCareersFuture, atsConnector(loadSeed(o.dataDir), registers)];
}
