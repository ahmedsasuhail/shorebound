# Shorebound: plan and roadmap

Last updated: 2026-11-24 · Version: **1.0** · Origin country: India (others later)

## Goal

One feed of **recent** software jobs abroad where the **employer sponsors the visa** (relocation is a bonus),
ranked by **fit to your resume** and **trustworthiness**, from free and permitted sources, running entirely on
your machine.

## v1: what is built (stable)

| Area | In v1 |
|---|---|
| Profile | Resume upload (PDF/DOCX/TXT/MD) → local rule-based profile (skills, years, level, role families); editable; re-read automatically when the extractor improves. No resume → no feed. |
| Sources | Arbeitnow, Hacker News "Who is hiring?", MyCareersFuture (Singapore), TokyoDev (Japan), company job boards (Greenhouse/Lever/Ashby, 38 employers). Each can be switched off. |
| Registers | UK Home Office Skilled Worker sponsor register; Canada positive-LMIA employers for software occupations (last 4 quarters); Ireland companies issued employment permits (latest year); Netherlands IND recognised sponsors. Disk-cached, fall back to old copies. |
| Countries | 14 researched: US, CA, GB, IE, DE, NL, FR, JP, AE, SA, QA, SG, MY, TH. |
| Sponsorship | Rule-based classifier (negation-aware, English plus common German/Arabic phrases); register matches; Singapore salary signal shown as *unconfirmed*. |
| Ranking | Match score (title + core stack led, hard caps for wrong roles); confidence meter with scam signals and visible coverage; sort by newest / best fit / most trusted; strictness; max 3 per company. |
| UI | Feed with filters and animated cards, detail drawer with evidence and "why" panel, onboarding, settings (resume, profile, countries, search, sources, appearance), light/dark. |
| Ops | `npm run build && npm start` (one process); CI: typecheck, lint, format, tests, data validation, build. |

## How decisions are made

### Sponsorship (a job needs one signal)

| Signal | Status | Example |
|---|---|---|
| Posting text says so (no negation) | `confirmed_text` | "We offer visa sponsorship" |
| Employer on an official register | `confirmed_register` (employer-level: the posting itself may not mention visas; shown as "Employer on sponsor register", ranks below explicit text, can be hidden) | UK Skilled Worker licence; Canada LMIA for a software occupation |
| Board only lists sponsoring jobs | `visa_source` | Arbeitnow visa filter |
| Salary clears the visa threshold | `possible` (marked *unconfirmed*, can be hidden) | Singapore: ≥ S$7,750/month |
| Text rules it out | `negative`: **always discarded**, no option | "No sponsorship", "must already be based in Dubai" |

Register and salary signals are company- or role-level indications, not proof that a specific role is sponsored;
the UI says so.

### Match score (fit, 0–100)

Role family 25 · stack 40 (core languages/frameworks lead; databases/cloud/tooling add little) · seniority 20 ·
years 15. Caps: not software → 5; intern → 20; two levels below you → 45; different specialty or a title naming a
language you lack → 40; platform/CMS roles (WordPress, Salesforce, SAP…) → 35. Hidden below the strictness
threshold (Balanced = 55).

### Confidence (trust, 0–100)

Weighted over the factors that have data, with coverage shown: sponsorship evidence 30, ease of moving from
India 20, posting freshness/quality 15; company reputation 20 and employee reviews 15 have no free source yet.
Scam penalties apply afterwards; hard scam flags cap at 10, explicit "no sponsorship" at 5.
Model: [`data/trust/signals.json`](data/trust/signals.json).

## Future (add-ons, not in v1)

Ordered roughly by value. Each is independent of the v1 core.

1. **TODO: Adzuna connector** (free API key per user; ~20 countries including Australia; keyword search for
   "visa sponsorship"; returns real `created` dates). Needs a Settings field for the user's app id and key.
2. **Staffing-agency filter**: many Singapore results are contract/agency postings.
3. **More registers**: US (DOL LCA data; the USCIS H-1B hub was unreliable in 2026). (Ireland and the Netherlands
   were added in Nov 2026.)
4. **More countries**: research the *coming soon* entries in `data/catalog.json` (Australia needs a free source
   first: none is permitted today); free sources for the Gulf, Malaysia and Thailand. Considered and skipped:
   Germany's federal Jobsuche API (no descriptions in results, German postings rarely mention visas).
5. **Keyword filters**: target roles, must-have and excluded keywords, work mode (remote/hybrid/onsite).
6. **Scheduled refresh and notifications** for new high-fit jobs.
7. **Application tracker** (saved → applied → interviewing → offer).
8. **LinkedIn/Indeed quick-search links** (pre-filled, opened in your own browser; never fetched).
9. **Company reputation and reviews** (Wikidata, Companies House, layoff trackers; review sites are link-only).
10. **Desktop app** (Electron) with OS-keychain secret storage.
11. **Optional AI (Claude)**: profile refinement, unclear-posting classification, cover-letter drafts, with the
    user's own API key and a budget cap.
11. Other origin countries; family/dependant visa planning.

## Principles

- Official or public APIs only; respect robots.txt and terms; identify ourselves; rate-limit; cache.
- Never guess facts: unknown data is `null` with an open question; register names are exact matches.
- Every surfaced job shows the evidence behind it.
- Local-first and private; no accounts, no telemetry.
- Not legal or immigration advice; always link official sources.

## Repository

Public at `ahmedsasuhail/shorebound`, PolyForm Strict 1.0.0. Work happens on feature branches with pull
requests; `main` is protected by CI. Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
