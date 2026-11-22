# Shorebound data store — schema (v1)

Curated research that drives the app: which countries exist, which job sites to pull from,
how to judge sponsorship / relocation / company trust. JSON only, hand-editable, versioned in git.

```
data/
  catalog.json             index of all destination countries: status "available" | "coming_soon"
  countries/<iso2>.json    one file per destination country (lowercase ISO 3166-1 alpha-2)
  origins/<iso2>.json      origin-country specifics (where the user moves FROM). v1: in.json (India)
  sources/global.json      sources that span countries: ATS APIs, aggregators, remote & relocation boards
  trust/signals.json       review sites, layoff trackers, company-data APIs, scam signals, scoring weights
```

Validate with `python scripts/validate_data.py` (also runs in CI on every push touching `data/`).

## Adding a country

1. Research and write `countries/<iso2>.json` following the shape below.
2. Flip its entry in `catalog.json` from `coming_soon` to `available`.
3. Run the validator.

## Rules for every file

- Top-level `_meta` block is **required** (provenance — who researched it, when, how).
- Every non-obvious fact must be traceable to an entry in that file's `sources` array.
- Unknown → `null` plus a note. **Never guess** numbers (salary, thresholds, fees, processing times).
- Money: `{ "amount": number, "currency": "ISO 4217", "period": "year|month", "as_of": "YYYY-MM" }`.
- Immigration rules change often: always set `as_of` and link the official government page.
- `verified`: `true` only when the fact was read on an official/primary page during research.

### `_meta` (all files)

```json
"_meta": {
  "schema_version": 1,
  "researched_on": "2026-11-22",
  "generated_by": {
    "model": "claude-opus-5-5",
    "harness": "Claude Code (research subagent)",
    "effort": "string — reasoning-effort setting if known, else \"not exposed to model\"",
    "method": "web search + page reads; official sources preferred"
  },
  "searches_run": 0,
  "pages_read": 0,
  "confidence": "high|medium|low",
  "open_questions": ["things that could not be confirmed"],
  "review_by": "YYYY-MM-DD — date after which this file should be re-researched"
}
```

## `countries/<iso2>.json`

```json
{
  "_meta": { ... },
  "code": "DE",
  "name": "Germany",
  "region": "north_america|europe|oceania|east_asia|southeast_asia|middle_east",
  "tier": "high_pay|emerging_high_pay|moderate",
  "default_enabled": true,
  "currency": "EUR",
  "languages": {
    "official": ["German"],
    "english_only_tech_jobs": "common|possible|rare",
    "note": ""
  },
  "salary": {
    "senior_swe_annual_gross": { "low": 0, "high": 0, "currency": "EUR", "period": "year", "as_of": "2026-11" },
    "source_urls": [],
    "note": "range for ~5-10 yrs exp, product companies; approximate"
  },
  "income_tax_note": "short, e.g. 'progressive up to 45%; 0% personal income tax' (Gulf)",
  "cost_of_living_note": "",
  "visa_routes": [
    {
      "id": "de-blue-card",
      "name": "EU Blue Card",
      "type": "employer_sponsored|points_based|talent|self_sponsored|intra_company",
      "requires_job_offer": true,
      "requires_licensed_sponsor": false,
      "salary_threshold": { "amount": 0, "currency": "EUR", "period": "year", "as_of": "2026-01", "note": "IT shortage-occupation lower threshold, if any" },
      "degree_requirement": "",
      "three_year_indian_bachelors_note": "how a 3-year Indian bachelor's (e.g. BCA/BSc) is treated; experience-in-lieu-of-degree options",
      "processing_time": "",
      "lottery_or_quota": "",
      "path_to_pr": "",
      "employer_cost_note": "who pays fees / levies (e.g. UK Immigration Skills Charge)",
      "official_url": "",
      "verified": true
    }
  ],
  "sponsor_register": {
    "exists": true,
    "name": "",
    "url": "",
    "format": "csv|xlsx|pdf|html|api|none",
    "update_frequency": "",
    "how_to_use": "how the app can match a company name against it",
    "verified": true
  },
  "sponsorship_phrases": {
    "positive": ["local-language phrases meaning 'visa sponsorship provided'"],
    "negative": ["phrases meaning 'no sponsorship / must have right to work'"]
  },
  "ease_for_indian_nationals": {
    "score": 1,
    "scale": "1 (hard) – 5 (easy)",
    "rationale": "",
    "factors": {
      "degree_recognition": "",
      "language_barrier": "",
      "processing_speed": "",
      "quota_or_lottery": "",
      "employer_willingness": "how commonly employers there sponsor Indian engineers",
      "attestation_or_paperwork": ""
    }
  },
  "relocation_norms": "is employer-paid relocation common? typical package contents",
  "job_sites": [
    {
      "id": "stepstone-de",
      "name": "StepStone",
      "url": "https://www.stepstone.de",
      "kind": "government|job_board|aggregator|tech_niche|relocation_niche|community|recruiter",
      "reputation": "high|medium|low",
      "reputation_note": "",
      "access": {
        "method": "official_api|rss|public_json|html_scrape|link_only",
        "auth": "none|free_key|account_required",
        "docs_url": null,
        "rate_limit": null,
        "logged_out_works": true,
        "robots_or_tos": "allows|unclear|prohibits automated access",
        "notes": ""
      },
      "posted_date_available": true,
      "filters": { "visa_sponsorship": false, "relocation": false, "english": false, "remote": true, "date_posted": true },
      "english_listings": "most|some|few",
      "priority": 1,
      "verified": true
    }
  ],
  "review_sources": [ { "name": "kununu", "url": "", "access": "link_only|html_scrape|api", "note": "" } ],
  "communities": [ { "name": "r/germany", "url": "", "note": "useful threads / wiki" } ],
  "scam_warnings": [ "" ],
  "sources": [ { "url": "", "title": "", "used_for": "", "accessed": "2026-11-22" } ]
}
```

## `origins/<iso2>.json`

Origin-side requirements for leaving the country (passport categories, emigration clearance,
document attestation/apostille, police clearance, official scam advisories, tax-residency notes).
Shape: `_meta`, `code`, `name`, `ecr_countries[]` (India: destinations needing emigration clearance for ECR passports), `requirements[]` (`{id, name, applies_to_destinations[], description, official_url, typical_time, typical_cost, verified}`),
`scam_advisories[]`, `degree_evaluation[]` (credential evaluators by destination), `sources[]`.

## `sources/global.json`

`_meta`, then `sources[]` with the same shape as a country `job_sites[]` entry plus
`countries: ["*"] | ["GB","DE",...]` and `category: "ats_api|aggregator|remote_board|relocation_board|community|search"`.
ATS entries also carry `endpoint_template` (e.g. `https://boards-api.greenhouse.io/v1/boards/{token}/jobs`)
and `company_discovery` (how to find company board tokens).
Optional per-entry keys: `fields` (which response fields hold posted date / location), `endpoint_extras`, `countries_note`.
Top level also has `recommendations` (build order, LinkedIn/Indeed stance, polite-scraping defaults) and
`sources_cited[]` (citations; named this way because `sources[]` holds the catalogue itself).

## `trust/signals.json`

`_meta`, then:
- `review_sources[]` — employee-review sites (access method, free?, coverage by country).
- `layoff_trackers[]` — where layoff data can be read for free.
- `company_data_sources[]` — free registries / APIs (size, age, funding, filings).
- `scam_signals[]` — `{id, description, weight, detect: "how the app can detect it"}`.
- `entity_resolution` — steps to resolve a company name to a domain / registry entity.
- `confidence_model` — proposed scoring factors and weights (see PLAN.md §5.3).
- `sources[]`.
