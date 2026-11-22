import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadData } from "./load.js";

const dataDir = fileURLToPath(new URL("../../../data", import.meta.url));

describe("data store", () => {
  const { catalog, countries } = loadData(dataDir);

  it("has a file for every available country", () => {
    const available = catalog.countries.filter((c) => c.status === "available");
    expect(available.length).toBeGreaterThan(0);
    for (const c of available) expect(countries.has(c.code)).toBe(true);
  });

  it("includes only high-signal v1 fields the app relies on", () => {
    for (const c of countries.values()) {
      expect(c.sponsorship_phrases.positive.length, c.code).toBeGreaterThan(0);
      expect(c.job_sites.length, c.code).toBeGreaterThan(0);
    }
  });
});
