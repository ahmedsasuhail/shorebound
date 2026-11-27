# Shorebound

**Find recent, visa-sponsored software jobs abroad, ranked by how well they fit you and how much you can trust them.**

Shorebound is a local web app for engineers planning a move overseas (built first for people moving from India).
It collects fresh postings from free, reputable sources, keeps only jobs that show a real sponsorship signal,
scores each one against your resume, and explains every decision with evidence. Everything runs on your machine:
no account, no telemetry, no API keys.

> **Status: v1.0** (stable). See [PLAN.md](PLAN.md) for what is in v1 and what comes next.

## Quick start

Requires **Node.js 22+** (24 recommended).

```sh
npm install
npm run build
npm start            # → http://127.0.0.1:8787
```

Then:

1. **Upload your resume** (PDF, DOCX, TXT or MD). It is read on this machine and turned into a profile
   (skills, years, level) that you can edit in Settings. Without a resume no jobs are shown, because there
   is nothing to rank them against.
2. **Press Refresh.** The first run takes 1–2 minutes: it politely fetches every source and downloads the
   UK and Canadian sponsor registers (cached afterwards).
3. **Browse the feed.** Click a job for the evidence, the fit breakdown and the confidence factors.

For development (hot reload): `npm run dev` and open http://localhost:5173.

## What it does

| | |
|---|---|
| **Fresh only** | Real posting dates, default last 7 days, newest first (or sort by best fit / most trusted). |
| **Sponsorship signal required** | Explicit posting text; a visa-filtered board; an **employer** on an official sponsor register (UK Skilled Worker licence, Canadian LMIA for software roles: the posting itself may not mention visas, so these are marked and can be hidden); or, for Singapore, a salary above the Employment Pass bar (marked *unconfirmed*). "No sponsorship" / "must already live there" jobs are always discarded. |
| **Relocation** | Employer-paid relocation is detected and can be a bonus or a requirement. |
| **Fit to your resume** | Match score led by the job title and your core stack; wrong specialty, other languages, junior roles and platform/CMS roles are capped. Strictness: Broad / Balanced / Strict. Non-engineering roles (recruiters, sales...) are discarded outright. Optional must-have and excluded keywords. |
| **Confidence meter** | Sponsorship evidence, ease of moving from India, posting freshness, plus scam checks (fees, WhatsApp-only contact, "come on a visit visa"...). Factors without free data are shown as missing, never guessed. |
| **Direct employers first** | Postings from staffing agencies and recruiters ("on behalf of our client", Singapore EA licence numbers, known agency names) are hidden by default: the real employer, and so the sponsor, is unnamed. They can be shown, marked "Recruiter posting". |
| **Private** | Resume, settings and jobs live in your OS app-data folder (`%APPDATA%\Shorebound`, `~/Library/Application Support/Shorebound`, `~/.config/shorebound`). |

### Sources

| Source | Covers | Signal |
|---|---|---|
| [Arbeitnow](https://www.arbeitnow.com) API | Mostly UK and EU | Board's visa-sponsorship filter + posting text |
| Company job boards (Greenhouse, Lever, Ashby) | 38 employers in [`data/companies/seed.json`](data/companies/seed.json) | Official registers (UK sponsor licences, Canada LMIA for software roles, Ireland employment permits, Netherlands IND recognised sponsors), or posting text |
| Hacker News "Who is hiring?" | Global | "VISA" tag or posting text (strongest early in each month) |
| MyCareersFuture | Singapore | Posting text, or salary above the Employment Pass bar (*unconfirmed*) |
| TokyoDev | Japan | Its "Apply from abroad" listing; only jobs that also need no Japanese. Japanese jobs stay listed for months, so few are new each week |

LinkedIn and Indeed are **not** fetched: their terms forbid automated access, even logged out.
Sources can be switched off in Settings.

### Countries

14 destinations have researched visa data (US, CA, GB, IE, DE, NL, FR, JP, AE, SA, QA, SG, MY, TH); the rest
are listed as *coming soon* in [`data/catalog.json`](data/catalog.json). Job coverage is strongest for the UK,
Germany, the Netherlands, France, Ireland, Canada and Singapore; Japan gets a few new jobs a month; Gulf countries,
Malaysia and Thailand have researched data but almost no free, permitted job sources yet. Newly added countries
are not switched on automatically for existing users: tick them in Settings → Countries.

## Development

```sh
npm run dev           # API (:8787) + Vite UI (:5173) with hot reload
npm run check         # typecheck + lint + format check + tests + data validation
npm test              # unit/integration tests (Vitest)
npm run lint:fix      # ESLint
npm run format        # Prettier
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organised.

**Windows notes:** run tests from PowerShell or CMD. In Git Bash, Vitest can fail because the drive letter
case differs (`d:` vs `D:`). `.npmrc` sets `legacy-peer-deps` to work around an npm bug on fresh installs.

## Data store

Country, source and trust research lives in [`data/`](data/) as JSON ([schema](data/SCHEMA.md)), validated at
startup and in CI (`npm run validate:data`). Each file records which model researched it, when, from which
sources, and when to re-check. Research notes: [`docs/research/`](docs/research/).

## Disclaimer

Shorebound is a job-discovery aid, not immigration or legal advice. Visa rules change often: always confirm
with official government sources and check every posting yourself. A sponsor licence or LMIA approval is a
company-level signal, not proof a specific role is sponsored. Never pay a recruiter or employer for a job.

## License

[PolyForm Strict 1.0.0](LICENSE) © 2026 Ahmed Suhail S A. Personal, noncommercial use only; no redistribution
or modified versions.
