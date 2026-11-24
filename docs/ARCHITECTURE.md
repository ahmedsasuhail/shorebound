# Architecture

TypeScript monorepo (npm workspaces). One local Node process serves the API and, in production, the UI.

```
apps/
  web/                 React 19 + Vite + Tailwind v4 + motion + TanStack Query
    src/pages/         FeedPage, SettingsPage
    src/components/    JobCard, JobDrawer, Meters (confidence ring, "why" panel), Onboarding, ResumeCard, …
    src/lib/format.ts  pure display helpers (timeAgo, country names, refresh summary)
    src/theme/         OKLCH→sRGB + WCAG contrast helpers; palette.test.ts guards the colour tokens in index.css
    src/hooks/         useNow (ticking clock so components stay pure)
    src/api.ts         typed fetch + React Query hooks for every endpoint
packages/
  core/                pure domain logic, no I/O
    job.ts             Job model and sponsorship/relocation statuses
    sponsorship/       rule-based sponsorship + relocation classifier, and its test table (cases.ts)
    scoring/           skills taxonomy, job + resume analysis, match score, confidence + scam signals
  sources/             one connector per job source (fetch → normalize → classify)
    arbeitnow.ts  ats.ts (Greenhouse/Lever/Ashby)  hackernews.ts  mycareersfuture.ts
    registers.ts       UK sponsor register (CSV) and Canada LMIA (XLSX) importers
    geo.ts html.ts     location → country, HTML → text
  server/              Fastify API, SQLite (node:sqlite), refresh pipeline
    app.ts             routes (documented at the top of the file)
    connectors.ts      wires sources + registers (with disk caches); SOURCE_INFO
    refresh.ts         runs enabled connectors; one failing source never stops the others
    feed.ts            scores, filters, sorts and caps the feed
    db.ts jobs.ts settings.ts resume.ts resumeText.ts http.ts paths.ts
  data-schema/         zod schemas + loader for /data (also `npm run validate:data`)
data/                  researched JSON: countries, catalog, companies seed, sources, trust signals, India origin
```

## Request flow

```
Refresh ─► connectors (polite: identifying User-Agent, 1 req/s per source, 30 s timeouts)
            ├─ fetch real postings within the lookback window
            ├─ normalize to Job (country from location, plain-text description)
            └─ sponsorship + relocation: classify(text) and/or register match
          ─► SQLite upsert (jobs older than 30 days pruned)

GET /api/jobs ─► needs a profile (from the resume) ─► SQL filters (countries, window, no "no sponsorship", relocation)
              ─► buildFeed: analyzeJob → matchScore (fit) + confidenceScore (trust) → merge cross-source duplicates → discard ≤5% matches, hide poor fits
                 → sort (newest | best fit | most trusted) → max N per company
```

## Key decisions

- **Rules, not AI, for v1.** Classification and scoring are deterministic, explainable and free. Every
  decision carries the sentence or register entry that produced it.
- **Sponsorship is required.** Each job needs a signal; explicit negatives ("no sponsorship", "must already
  be based in…") are dropped. Singapore's salary-based signal is a separate, clearly labelled status
  (`possible`) that users can hide.
- **Real posting dates only.** Never crawl dates; reposts keep their original date where the source has one.
- **Polite, permitted access.** Official/public APIs only; LinkedIn and Indeed are excluded by their terms.
- **Local-first.** Data lives in the OS app-data folder; the server binds to 127.0.0.1 only.
- **Data is reviewed, not guessed.** Register names in the company seed are exact matches verified against
  the live registers; unknown research facts are `null`, never invented.

## Colour system

Tokens live in `apps/web/src/index.css` as OKLCH (light and dark). `palette.test.ts` parses them and fails on any
WCAG AA text-contrast (4.5:1) or mark-contrast (3:1) regression, on out-of-gamut values, and on status colours that
would differ by hue alone. Status colours always ship with an icon and a label.

## Tests

`npm test` runs ~290 Vitest tests: the classifier table, scoring regressions taken from real feeds, each
connector against saved/synthetic responses (no network), register parsing and caching, and API routes via
Fastify's `inject`.
