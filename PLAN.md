# Shorebound — Plan

> Find recent, visa-sponsored software jobs abroad, rank them by how much you can trust them,
> and track your applications — all on your own machine.

Status: **planning** · Last updated: 2026-11-22 · Origin country supported: 🇮🇳 India (others later)

---

## 1. Problem & goals

Job hunting abroad from India means checking dozens of country-specific boards, guessing whether a
posting will sponsor a visa, and having no quick way to tell a solid employer from a risky one or a scam.

**Goals**

1. One feed of **recent** jobs (default: posted in the last **7 days**, newest first) across many countries and job sites.
2. **Visa sponsorship is required.** A job qualifies when *any* sponsorship signal is present (rules in §5).
3. **Paid relocation is a bonus.** It's flagged and ranked higher, but not required.
4. A **confidence meter** for each job, built from company reputation, real employee reviews, sponsorship evidence and how easy the move is from India.
5. **Local-first, no login:** your resume, settings and API key never leave your machine (except calls to the AI provider you configure).
6. **Free data sources only:** no paid job APIs. Free API keys are fine.
7. **Logged-out access only:** never use personal LinkedIn or other site accounts.
8. A polished, fast, interactive UI that runs both as a **desktop app** and in the **browser**.

**Non-goals (for now):** auto-applying or auto-sending email, multi-user hosting, family/dependant visa planning, origin countries other than India, and AI providers other than Claude.

---

## 2. Lessons from the prototype (`archive/prototype-v0`, not committed)

The prototype was a single Node script: Brave Search → regex → JSON with cold-email drafts. Kept as a reference only.

| Prototype issue | Fix in Shorebound |
|---|---|
| The sponsorship regex matched "we **cannot** provide visa sponsorship" | A classifier that handles negation, plus local-language phrase lists from `data/countries/*.json` |
| Skill matching used substrings (`go` matched "good", `hr` matched "through") | Word-boundary/token matching, with optional Claude resume parsing into a structured profile |
| It used the search engine's crawl date as the "posted" date | Use the source's real posting date (ATS APIs, schema.org `datePosted`), and drop jobs with no trustworthy date by default |
| Needed a paid search API and capped out at about 70 results | Direct connectors to free APIs, ATS boards and government portals |
| Scraped emails for cold outreach | Apply through the real application link; cover-letter drafts on demand, never sent automatically |

---

## 3. Architecture

**Stack:** TypeScript end-to-end, chosen so the owner (a TS/Node engineer) can maintain all of it.

```
shorebound/
  apps/
    web/          React 19 + Vite + TypeScript · Tailwind + shadcn/ui · TanStack Query/Table/Router · Framer Motion
    desktop/      Electron shell: starts the local server, loads the web UI, OS keychain via safeStorage
  packages/
    core/         domain model, sponsorship/relocation classifiers, dedupe, confidence scoring (pure, tested)
    server/       Fastify API + job scheduler + SQLite (better-sqlite3 + Drizzle ORM)
    sources/      one connector per source behind a common interface (plugin-style)
    ai/           Claude client (@anthropic-ai/sdk): resume parsing, match scoring, classification, letters
    data-schema/  zod schemas that validate everything in /data at startup
  data/           researched JSON data store (countries, sources, trust signals, origin requirements)
  docs/           PLAN.md, research report, ADRs
```

- **Desktop mode:** Electron runs the server in the main process and the UI in the window. Windows is the first build target.
- **Browser mode:** `npm run dev` / `npm start` serves the same UI at `http://localhost:<port>`.
- **Storage:** SQLite and files live in the OS app-data folder (`%APPDATA%/Shorebound`, `~/Library/Application Support/Shorebound`, `~/.config/shorebound`), never in the repo.
- **Secrets:**
  - The Claude API key is encrypted with the OS keychain (Electron `safeStorage`).
  - In browser-only mode it falls back to the `ANTHROPIC_API_KEY` env var.
  - It is never written to logs or exports, and never committed.
- **Workspace tooling:** npm workspaces (pnpm skipped to avoid an extra tool), Vitest, Playwright, ESLint and Prettier, GitHub Actions CI (typecheck, test, and validate `/data`).

### Source connector interface

```ts
interface SourceConnector {
  id: string;                          // "greenhouse", "arbeitnow", "mycareersfuture" …
  countries: string[] | "*";
  kind: "official_api" | "rss" | "public_json" | "html_scrape";
  rateLimit: { requests: number; perSeconds: number };
  fetch(query: SearchQuery, since: Date): AsyncIterable<RawJob>;
  normalize(raw: RawJob): Job | null;  // must yield a real postedAt, or null
}
```

**Polite-scraping defaults:**
- Honour `robots.txt`.
- Identify ourselves with a `User-Agent` that names the app and links to its repo.
- Cache responses (ETag / If-Modified-Since).
- Use per-host rate limits and back off on 429/403.
- No logged-in sessions.
- A source whose terms prohibit automated access is set to `link_only` (the UI deep-links its search page instead).

### 3.1 LinkedIn & Indeed: links only

Research (`data/sources/global.json`) found that both forbid automated access, **including logged-out access**:
- LinkedIn's `robots.txt` disallows `/jobs-guest/`, and its User Agreement (§8.2, effective 2025-11-03) bans scraping by logged-out visitors too.
- The hiQ v. LinkedIn case ended in 2022 with a consent judgment and injunction against the scraper.
- Indeed's terms cover automated access.

So Shorebound never fetches them. Instead it builds **pre-filled search links** that the user opens in their own browser:
- LinkedIn: past 7 days, newest first (`f_TPR=r604800`, `sortBy=DD`).
- Indeed: country domain + `fromage=7&sort=date`.

JobSpy (scrapes both through proxies) stays out of the default build.

**Tier-1 sources to build first** (from the research):
1. ATS public APIs: Greenhouse, Lever, Ashby, SmartRecruiters. Companies are discovered by matching sponsor-register names to ATS slugs.
2. Arbeitnow, the only free, no-key source with a server-side `visa_sponsorship` filter.
3. HN "Who is hiring?" via the Algolia API.
4. Adzuna (free key).

### Pipeline

```
connectors → normalize → dedupe (company+title+city, fuzzy) → posting-date check (≤ lookback)
  → sponsorship classifier → relocation classifier → company enrichment (registers, reviews, layoffs, size)
  → scam checks → match score (resume vs job) → confidence score → store → UI feed
```

Refreshes run on a schedule (default every 6 hours, plus a "Refresh now" button) and are incremental: only new or changed postings get processed.

---

## 4. Data store (`/data`)

Researched, hand-editable JSON, validated at startup by zod schemas. Format: [`data/SCHEMA.md`](data/SCHEMA.md).

| Path | Contents |
|---|---|
| `data/countries/<iso2>.json` | One file per destination (11 in v1): visa routes (thresholds, degree rules incl. 3-year Indian bachelor's), sponsor registers, job sites with access method & ToS stance, salaries, ease-from-India score, sponsorship phrases in local language, scams, communities |
| `data/sources/global.json` | Cross-country sources: ATS public APIs (Greenhouse, Lever, Ashby, SmartRecruiters…), free aggregators (Adzuna…), relocation/visa boards, remote boards, logged-out LinkedIn/Indeed assessment |
| `data/trust/signals.json` | Review sources, layoff trackers, free company-data APIs, scam signals, proposed confidence weights |
| `data/origins/in.json` | Leaving India: ECR/ECNR & eMigrate, apostille/attestation, PCC, credential evaluators, MEA scam advisories |

Every file carries `_meta`:
- **who** researched it: model, harness, effort;
- **when**: `researched_on`, `review_by`;
- **how**: searches and pages read;
- **confidence** and **open questions**.

The UI shows data freshness and warns when a file is past its `review_by` date. Immigration data is informational only; the UI always links the official page.

**Destination countries.** v1 covers the countries researched so far: markets that out-pay, or at least match, senior roles at Indian product companies. The full list is in `data/catalog.json`.

| Region | v1 (researched) | Coming soon |
|---|---|---|
| North America | 🇺🇸 US · 🇨🇦 CA | — |
| UK & Ireland | 🇬🇧 GB · 🇮🇪 IE | — |
| Western Europe | 🇩🇪 DE | NL · CH · AT · LU · BE · FR |
| Nordics | — | DK · SE · NO · FI |
| Central & Southern Europe | — | PL · CZ · EE · ES · PT |
| Oceania | — | AU · NZ |
| East Asia | — | JP · KR · TW · HK |
| Southeast Asia | 🇸🇬 SG · 🇲🇾 MY · 🇹🇭 TH | VN · ID · PH (usually pay less) |
| Middle East (GCC) | 🇦🇪 AE · 🇸🇦 SA · 🇶🇦 QA | BH · KW · OM (small tech markets) |

"Coming soon" countries appear greyed out in Settings until their `data/countries/<iso2>.json` exists. Adding a country means researching one JSON file; no code changes are needed.

---

## 5. Sponsorship, relocation & confidence

### 5.1 Sponsorship (required, any one signal counts)

A job **qualifies** when at least one of these is true:

| Signal | Strength | Example |
|---|---|---|
| **Explicit text:** a positive sponsorship phrase with no negation (EN plus local language) | strong | "We offer visa sponsorship and relocation" |
| **Official register:** the company appears on that country's licensed/recognised sponsor register | strong | UK Register of licensed sponsors, NL IND recognised sponsors |
| **Visa-focused source:** the job was listed on a board or filter that only carries sponsoring roles | medium | visa filter on a relocation board, HN "VISA" tag |
| **Country norm:** foreign hires are employer-sponsored by default | medium | GCC employment visas |
| **Talent route fits:** the country's route makes employer sponsorship routine for this salary/profile | weak | EU Blue Card at a salary above the threshold |

A **negative signal** ("no sponsorship", "must have the right to work", "citizens/PR only") **excludes** the job. A toggle in Settings can show these anyway.

Only **explicit text, official register and visa-focused source** count as "sponsorship confirmed". Every surfaced job shows the evidence (highlighted sentence, register entry, or rule).

### 5.2 Relocation (bonus)

Detected from text, e.g. "relocation package/assistance/support", "flights + temporary housing", "relocation allowance", and local-language equivalents. Shown as a badge and boosts ranking. It's also a filter.

### 5.3 Confidence meter (0–100)

Default factors are below. The weights are editable in Settings, and the final defaults will be tuned against the research in `data/trust/signals.json`.

| Factor | Default weight | Inputs |
|---|---|---|
| Sponsorship evidence strength | 30 | Signal type from 5.1 (explicit + register = max) |
| Company reputation | 20 | Size, age, listed/public or well-established, *not* early-stage, recent layoffs (penalty) |
| Ease of moving from India | 20 | `ease_for_indian_nationals.score`, degree recognition, processing time, lottery/quota |
| Posting quality & freshness | 15 | Real ATS/official URL, fresh real `datePosted`, salary disclosed, clear company identity |
| Employee reviews | 15 | Rating and review count. No review site offers a free API, so this is mostly link-out plus optional Claude summaries of pages the user opens |

- **Missing data:** weights are rescaled over the factors that have data, and the meter shows *coverage* (e.g. "based on 70% of signals").
- **Scam penalties** (`data/trust/signals.json`, 14 detectors) are subtracted afterwards.
- **Hard caps:** any hard flag caps the score at 10 (fee demanded, visa-for-fee, "come on a tourist visa and convert", the SE-Asia scam-compound pattern, cheque/reshipping). An explicit "no sponsorship" caps it at 5.

The meter shows a **breakdown tooltip**, so you can always see *why* a job scored the way it did.

### 5.4 Match score (separate from confidence)

How well the job fits *you*: skills overlap, seniority, role family, years required vs. yours, salary vs. your floor. It is rule-based by default; with Claude enabled, a structured evaluation includes a one-line rationale.

---

## 6. AI features (Claude)

The Claude API key is entered in **Settings → AI**. A Claude Pro/Max *subscription* does **not** include API usage: API calls are billed separately, pay-as-you-go, through the Claude Console. The app works without a key, using rule-based features only.

| Feature | When it runs | Default model |
|---|---|---|
| Resume → structured profile (skills, years, seniority, roles) | Once per resume upload | `claude-opus-5-5` |
| Ambiguous sponsorship/relocation classification | Only for jobs the rules can't decide | `claude-opus-5-5` |
| Job match evaluation + rationale | New jobs passing filters | `claude-opus-5-5` |
| Company review summary | On demand, cached for 30 days | `claude-opus-5-5` |
| Tailored cover letter / recruiter note | On demand from a job | `claude-opus-5-5` |

Settings let you pick the model (Opus 5.5 / Sonnet 5.5 / Haiku 5.5) and effort level. Haiku is far cheaper for bulk classification; that trade-off is the user's call.

**Cost controls:**
- **Monthly budget cap:** AI features pause when it's reached.
- **Estimated cost per refresh**, shown before running.
- **Result caching** by job content hash; prompt caching for the fixed system prompt.
- **Batch API** for non-urgent bulk scoring (50% cheaper).

**Implementation:**
- Official `@anthropic-ai/sdk`.
- Structured outputs via `output_config.format` with zod schemas.
- Refusal fallbacks enabled.
- Every AI-generated claim is shown next to its source text.

---

## 7. UI

Design direction: a calm, information-dense "flight-board" aesthetic in light and dark themes. Built with shadcn/ui, a command palette (Ctrl/Cmd+K), keyboard navigation (`j`/`k`, `s` save, `h` hide, `o` open) and virtualized lists. Accessible (WCAG AA contrast, full keyboard support).

| Screen | What it does |
|---|---|
| **Onboarding** | Upload resume → review parsed profile → pick countries (region presets: "Top-paying", "Gulf", "SE Asia") → optional Claude key → first refresh |
| **Feed** (home) | Newest-first job list:<br>• badges: sponsorship type, relocation, country flag, posted "3h ago"<br>• confidence meter and match score<br>• filters: country, posted within, sponsorship strength, relocation, confidence ≥, match ≥, source, remote/hybrid/onsite, salary<br>• saved filter views; "new since last visit" marker |
| **Job detail** (drawer) | • Description with highlighted sponsorship/relocation evidence<br>• confidence breakdown<br>• company card (register match, size, layoffs, reviews with links)<br>• country visa card (best route, threshold vs. offered salary, processing time)<br>• actions: open apply link, save, hide, mark applied, draft cover letter |
| **Tracker** | Kanban board: Saved → Applied → Interviewing → Offer → Closed, with notes, dates and reminders |
| **Companies** | Every company seen, with sponsorship history across countries, reviews, layoffs, open roles |
| **Atlas** | Country explorer from `/data`: visa routes, thresholds, ease score, salary bands, job sites, scams to watch for; data-freshness badge |
| **Settings** | See §8 |

---

## 8. Settings

All settings are local. Nothing needs a login.

- **Profile & resume:**
  - Upload PDF/DOCX/TXT; the file is copied to the app-data folder and remembered across sessions.
  - Replace or remove it; view and edit the parsed profile (skills, years, titles, education).
- **Countries:**
  - Checkbox list grouped by region, showing tier badges, ease score and data freshness.
  - Presets: *Top-paying*, *Emerging high-pay (Gulf + SE Asia)*, *English-friendly*, *Fastest visas*.
- **Search:**
  - Target roles/titles and must-have/exclude keywords.
  - Seniority levels and minimum years.
  - Lookback window (default 7 days; 1/3/7/14/30).
  - Minimum salary per currency; remote/hybrid/onsite.
  - Show jobs with unknown posting date (off by default).
- **Sponsorship & relocation:**
  - Which signals count as qualifying.
  - Exclude negative-signal jobs (on by default).
  - Relocation required / bonus / ignored.
- **Sources:**
  - Enable or disable each connector.
  - Per-source rate limits; show LinkedIn/Indeed quick-search links on/off.
  - Free API keys for sources that need them (e.g. Adzuna).
- **Scoring:** confidence-factor weights, scam strictness, company blocklist/allowlist.
- **AI (Claude):**
  - API key (encrypted), with a "Test key" button.
  - Model, effort, monthly budget cap, and which AI features are on.
- **Schedule & notifications:** refresh interval; desktop notification for new jobs above a confidence/match threshold.
- **Data:** export/import (JSON/CSV), clear caches, reset app, open app-data folder.
- **Appearance:** theme (system/light/dark), density, language (EN for now).

---

## 9. Data model (SQLite)

```
jobs(id, source_id, source_job_id, url, apply_url, title, company_id, country, city, remote,
     posted_at, first_seen_at, last_seen_at, description, salary_min, salary_max, salary_currency,
     sponsorship_status, sponsorship_evidence, relocation_status, relocation_evidence,
     match_score, match_rationale, confidence, confidence_breakdown, scam_flags, dedupe_key, content_hash)
companies(id, name, normalized_name, domain, size_band, founded_year, is_public, hq_country,
          register_matches, layoffs, review_summary, enriched_at)
user_job_state(job_id, status, saved_at, hidden_at, notes)
applications(id, job_id, stage, applied_at, next_action_at, cover_letter, notes)
runs(id, started_at, finished_at, source_stats, errors, ai_cost_usd)
settings(key, value)                -- non-secret settings
ai_cache(hash, model, purpose, output, created_at)
registers(country, company_normalized, raw_name, route, fetched_at)   -- sponsor registers, refreshed weekly
```

---

## 10. Roadmap

| Milestone | Scope | Done when |
|---|---|---|
| **M0 · Plan & research** | Repo, license, plan, schema, deep research → `/data` | `/data` validates; plan reviewed |
| **M1 · Foundation** | • Monorepo scaffold, CI, zod data validation, SQLite/Drizzle, settings + resume persistence<br>• First connectors: Greenhouse / Lever / Ashby (company lists seeded from sponsor registers), Arbeitnow, Adzuna, Remotive/Himalayas, HN "Who is hiring"<br>• Negation-aware sponsorship classifier with fixtures; 7-day newest-first feed in browser mode | `npm run dev` shows real, recent, sponsorship-qualified jobs with evidence |
| **M2 · Coverage** *(started: company job boards + UK sponsor register done)* | • Government portal APIs (e.g. Germany BA Jobsuche, Singapore MyCareersFuture) and top boards per country where allowed<br>• Pre-filled LinkedIn/Indeed search links (see §3.1); cross-source dedupe; sponsor-register importers | ≥ 1 working source for every enabled country |
| **M3 · Intelligence** | • Claude integration: resume parsing, match scoring, ambiguous classification<br>• Company enrichment (registers, Wikidata/Companies House, layoffs, reviews); confidence meter; scam detection | Every job shows match score + confidence breakdown |
| **M4 · Workflow** | Tracker kanban, cover-letter drafts, scheduled refresh, desktop notifications, export/import | Full loop: discover → evaluate → apply → track |
| **M5 · Desktop & polish** | Electron packaging (Windows first, then macOS/Linux), onboarding, Atlas, accessibility pass, performance | Installable build from GitHub Releases |
| **Later** | Other AI providers, other origin countries, family/dependant visas, mobile-friendly PWA, public release | — |

Quality bar for each milestone:
- unit tests for classifiers and scoring;
- contract tests for each connector against recorded fixtures;
- Playwright smoke test of the feed.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Sites block or prohibit scraping | Prefer official APIs, ATS feeds and government portals; respect robots/ToS; `link_only` fallback; caching and low request rates |
| Immigration rules change | `as_of` + `review_by` on every fact; links to official pages; staleness warnings; re-run research every 6 months |
| False "sponsorship" positives | Negation-aware classifier, official-register cross-check, evidence always shown, users can report misclassifications |
| Scams targeting Indian job seekers | Scam-signal penalties, MEA advisory links, hard warnings for SE-Asia scam-compound patterns and fee requests |
| AI cost overruns | Budget cap, caching, batch API, AI only for jobs that pass the rule filters |
| Privacy | Local-only storage, encrypted key, no telemetry, resume never committed (`.gitignore` blocks PDFs/DOCX) |
| Not legal advice | Disclaimer in the UI and README; always link official sources |

---

## 12. Repository & licensing

- GitHub: `ahmedsasuhail/shorebound`. It's **private** for now, because GitHub has no "unlisted public" option; flip it to public whenever you're ready.
- License: **PolyForm Strict 1.0.0**. It allows personal, noncommercial use; it does **not** allow redistribution or modified/derivative versions. Copyright notice: Ahmed Suhail S A.
- Commits use the GitHub no-reply email address.
- Secrets, resumes and `archive/` are git-ignored.

## 13. Open questions

1. Desktop packaging: Electron (all-JS, larger install, about 100 MB) vs Tauri (small, but needs a Rust toolchain). Current pick: **Electron**.
2. Should "country norm" (e.g. GCC) count as qualifying sponsorship by default, or only as a weaker signal?
3. Minimum salary floors per country/currency: set them yourself, or derive them from the visa threshold + market data?
