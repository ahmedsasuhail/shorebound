import { z } from "zod";
import { getSetting, putSetting, type Db } from "./db.js";

/** User settings (PLAN.md §8). Secrets such as the Claude API key are NOT stored here. */
export const SettingsSchema = z.object({
  countries: z.array(z.string().length(2)).default([]),
  search: z
    .object({
      targetRoles: z.array(z.string()).default([]),
      mustHaveKeywords: z.array(z.string()).default([]),
      excludeKeywords: z.array(z.string()).default([]),
      lookbackDays: z.number().int().min(1).max(30).default(7),
      workModes: z.array(z.enum(["onsite", "hybrid", "remote"])).default(["onsite", "hybrid", "remote"]),
      showUnknownPostedDate: z.boolean().default(false),
      sort: z.enum(["newest", "match", "confidence"]).default("newest"),
      /** Hide non-software roles and weak matches once a profile exists. */
      onlyMatching: z.boolean().default(true),
      /** Hide jobs below this match score: Broad 40, Balanced 55, Strict 70. */
      minMatch: z.number().int().min(0).max(100).default(55),
      /** Max jobs per company in the feed so one employer cannot flood it (0 = no cap). */
      maxPerCompany: z.number().int().min(0).max(50).default(3),
    })
    .default(() => ({
      targetRoles: [], mustHaveKeywords: [], excludeKeywords: [], lookbackDays: 7,
      workModes: ["onsite", "hybrid", "remote"] as ("onsite" | "hybrid" | "remote")[], showUnknownPostedDate: false,
      sort: "newest" as const, onlyMatching: true, minMatch: 55, maxPerCompany: 3,
    })),
  sponsorship: z
    .object({
      excludeNegative: z.boolean().default(true),
      /** "required": must offer employer-paid relocation; "bonus": ranks higher; "ignore". */
      relocation: z.enum(["required", "bonus", "ignore"]).default("bonus"),
    })
    .default({ excludeNegative: true, relocation: "bonus" }),
  sources: z.object({ disabled: z.array(z.string()).default([]) }).default({ disabled: [] }),
  schedule: z.object({ refreshHours: z.number().min(1).max(168).default(6) }).default({ refreshHours: 6 }),
  appearance: z.object({ theme: z.enum(["system", "light", "dark"]).default("system") }).default({ theme: "system" }),
});

export type Settings = z.infer<typeof SettingsSchema>;

const KEY = "app";

export function defaultSettings(enabledCountries: string[]): Settings {
  return SettingsSchema.parse({ countries: enabledCountries });
}

/** Returns stored settings (missing fields filled with defaults), or defaults on first run. */
export function loadSettings(db: Db, enabledCountries: string[]): Settings {
  const stored = getSetting<unknown>(db, KEY);
  return stored === undefined ? defaultSettings(enabledCountries) : SettingsSchema.parse(stored);
}

/** Validates and saves a partial update merged over current settings. */
export function updateSettings(db: Db, enabledCountries: string[], patch: Partial<Settings>): Settings {
  const next = SettingsSchema.parse({ ...loadSettings(db, enabledCountries), ...patch });
  putSetting(db, KEY, next);
  return next;
}
