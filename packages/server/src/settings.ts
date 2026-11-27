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
  /** Hide jobs below this match score: Broad 40, Balanced 55, Strict 70. */
  minMatch: z.number().int().min(0).max(100).default(55),
  /** Max jobs per company in the feed so one employer cannot flood it (0 = no cap). */
  maxPerCompany: z.number().int().min(0).max(50).default(3),
  /** Must-have keywords: a job needs at least one, in its title or description (empty = no requirement). */
  includeKeywords: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  /** Excluded keywords: jobs whose TITLE contains any are hidden. */
  excludeKeywords: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
});

const SponsorshipSchema = z.object({
  /** "required": only jobs with employer-paid relocation; "bonus": ranks them higher; "ignore". */
  relocation: z.enum(["required", "bonus", "ignore"]).default("bonus"),
  /**
   * Show jobs whose only signal is that the EMPLOYER is on a sponsor register (UK licence, Canada LMIA). The posting
   * itself does not mention visas, so these are leads to verify, not stated offers.
   */
  includeRegister: z.boolean().default(true),
  /** Show jobs whose only signal is "salary meets the visa threshold" (Singapore), clearly marked. */
  includePossible: z.boolean().default(true),
  /**
   * Show postings from staffing agencies and recruiters. Off by default: the real employer (and so the sponsor) is
   * unnamed, sponsorship claims cannot be checked, and register matches would name the wrong company.
   */
  includeAgencies: z.boolean().default(false),
});

export const SettingsSchema = z.object({
  /** Enabled destination countries (ISO alpha-2); defaults come from data/countries/*.json. */
  countries: z.array(z.string().length(2)).default([]),
  /** YYYY-MM-DD the country list was last checked for newly added countries (see reconcileNewCountries). */
  countriesReviewedAt: z.string().optional(),
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

/**
 * Countries added in an app update (catalog entries with `since`) would stay invisible to existing users, whose
 * stored country list predates them. On startup, add every newly available, enabled-by-default country the user has
 * not been offered yet, once. Afterwards the user's choice wins: unticking a country is never undone.
 */
export function reconcileNewCountries(
  s: Settings,
  added: { code: string; since: string; defaultEnabled: boolean }[],
  today: string,
): { settings: Settings; addedCodes: string[] } {
  const reviewed = s.countriesReviewedAt ?? "0000-00-00";
  const addedCodes = added
    .filter((c) => c.defaultEnabled && c.since > reviewed && !s.countries.includes(c.code))
    .map((c) => c.code);
  return { settings: { ...s, countries: [...s.countries, ...addedCodes], countriesReviewedAt: today }, addedCodes };
}
