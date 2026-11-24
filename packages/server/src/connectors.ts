import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  arbeitnow, atsConnector, fetchUkRegisterCsv, hackerNews, parseUkRegister,
  type FetchLike, type RegisterIndex, type SeedCompany, type SourceConnector,
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

export function buildConnectors(o: { dataDir: string; appData: string; fetchImpl?: typeof fetch }): SourceConnector[] {
  const f = (o.fetchImpl ?? fetch) as unknown as FetchLike;
  return [arbeitnow, hackerNews, atsConnector(loadSeed(o.dataDir), ukRegisterLoader(o.appData, f))];
}
