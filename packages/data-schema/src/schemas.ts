import { z } from "zod";

// Schemas are deliberately loose (`looseObject`): data files carry extra research fields.
// They enforce what the app relies on; see data/SCHEMA.md for the full documented shape.

export const MetaSchema = z.looseObject({
  schema_version: z.number(),
  researched_on: z.string(),
  generated_by: z.looseObject({ model: z.string() }),
  confidence: z.enum(["high", "medium", "low"]),
  open_questions: z.array(z.string()),
  review_by: z.string(),
});

export const JobSiteSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  kind: z.string(),
  access: z.looseObject({ method: z.string() }),
  verified: z.boolean().nullable(),
});

export const CountrySchema = z.looseObject({
  _meta: MetaSchema,
  code: z.string().length(2),
  name: z.string(),
  region: z.string(),
  tier: z.string(),
  default_enabled: z.boolean(),
  currency: z.string(),
  visa_routes: z.array(z.looseObject({ id: z.string(), name: z.string() })),
  sponsor_register: z.looseObject({ exists: z.boolean().nullable() }),
  sponsorship_phrases: z.looseObject({
    positive: z.array(z.string()),
    negative: z.array(z.string()),
  }),
  ease_for_indian_nationals: z.looseObject({ score: z.number().min(1).max(5) }),
  job_sites: z.array(JobSiteSchema),
  scam_warnings: z.array(z.string()),
  sources: z.array(z.looseObject({ url: z.string() })),
});

export const CatalogSchema = z.object({
  updated: z.string(),
  countries: z.array(
    z.looseObject({
      code: z.string().length(2),
      name: z.string(),
      region: z.string(),
      status: z.enum(["available", "coming_soon"]),
    }),
  ),
});

export type Country = z.infer<typeof CountrySchema>;
export type Catalog = z.infer<typeof CatalogSchema>;
