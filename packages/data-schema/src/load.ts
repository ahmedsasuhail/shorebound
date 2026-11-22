import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CatalogSchema, CountrySchema, MetaSchema, type Catalog, type Country } from "./schemas.js";
import { z } from "zod";

export interface DataStore {
  catalog: Catalog;
  countries: Map<string, Country>;
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

/** Loads and validates the whole /data store. Throws with all problems listed. */
export function loadData(dataDir: string): DataStore {
  const errors: string[] = [];
  const check = <T>(schema: z.ZodType<T>, file: string): T | undefined => {
    const r = schema.safeParse(readJson(join(dataDir, file)));
    if (r.success) return r.data;
    for (const i of r.error.issues) errors.push(`${file}: ${i.path.join(".") || "(root)"} — ${i.message}`);
    return undefined;
  };

  const catalog = check(CatalogSchema, "catalog.json");
  const countries = new Map<string, Country>();
  const available = new Set(
    (catalog?.countries ?? []).filter((c) => c.status === "available").map((c) => c.code),
  );

  for (const file of readdirSync(join(dataDir, "countries")).sort()) {
    const code = file.replace(/\.json$/, "").toUpperCase();
    const country = check(CountrySchema, `countries/${file}`);
    if (!country) continue;
    if (country.code !== code) errors.push(`countries/${file}: code "${country.code}" does not match filename`);
    if (!available.has(country.code)) errors.push(`countries/${file}: not marked "available" in catalog.json`);
    countries.set(country.code, country);
  }
  for (const code of available) {
    if (!countries.has(code)) errors.push(`catalog.json: ${code} is "available" but has no countries/${code.toLowerCase()}.json`);
  }

  const MetaOnly = z.looseObject({ _meta: MetaSchema });
  for (const file of ["origins/in.json", "sources/global.json", "trust/signals.json"]) check(MetaOnly, file);

  if (errors.length) throw new Error(`Data validation failed:\n${errors.join("\n")}`);
  return { catalog: catalog!, countries };
}
