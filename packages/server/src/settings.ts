import { z } from "zod";
import { getSetting, putSetting, type Db } from "./db.js";

/**
 * User settings. Everything here is read by the app; nothing is "for later".
 * Stored as one JSON value; older stored settings with extra keys still parse (zod drops unknown keys).
 * Secrets are never stored here.
 */
const SearchSchema = z.object({
  /** Only jobs posted within this many days (real posting dates). */
  lookbackDays: z.number().int().min(1).max(30).default(7),
  sort: z.enum(["newest", "match", "confidence"]).default("newest"),
  /** Hide non-software roles and weak matches (requires a profile). */
  onlyMatching: z.boolean().default(true),
  /** Hide jobs below this match score: Broad 40, Balanced 55, Strict 70. */
  minMatch: z.number().int().min(0).max(100).default(55),
  /** Max jobs per company in the feed so one employer cannot flood it (0 = no cap). */
  maxPerCompany: z.number().int().min(0).max(50).default(3),
});

const SponsorshipSchema = z.object({
  /** Hide jobs whose text rules out sponsorship ("no sponsorship", "must already live there"). */
  excludeNegative: z.boolean().default(true),
  /** "required": only jobs with employer-paid relocation; "bonus": ranks them higher; "ignore". */
  relocation: z.enum(["required", "bonus", "ignore"]).default("bonus"),
  /** Show jobs whose only signal is "salary meets the visa threshold" (Singapore), clearly marked. */
  includePossible: z.boolean().default(true),
});

export const SettingsSchema = z.object({
  /** Enabled destination countries (ISO alpha-2); defaults come from data/countries/*.json. */
  countries: z.array(z.string().length(2)).default([]),
  search: SearchSchema.default(() => SearchSchema.parse({})),
  sponsorship: SponsorshipSchema.default(() => SponsorshipSchema.parse({})),
  /** Source ids (see packages/server/src/connectors.ts) the user switched off. */
  sources: z.object({ disabled: z.array(z.string()).default([]) }).default({ disabled: [] }),
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
