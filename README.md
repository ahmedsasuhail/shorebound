# Shorebound

**Find recent, visa-sponsored software jobs abroad — ranked by how much you can trust them.**

Shorebound is a local-first desktop and web app for engineers planning a move overseas. It gathers
fresh job postings from dozens of free, reputable job sites in high-paying countries. It keeps only roles
with a real visa-sponsorship signal, flags paid relocation, and gives every job a confidence score
based on the company's reputation, employee reviews, sponsorship evidence and how easy the move is.

> **Status: planning → starting development (M1).** No runnable app yet. See [PLAN.md](PLAN.md) for the full design and roadmap.

## Planned features

- 🗓️ **Fresh jobs only.** Posted within the last 7 days by default, newest first, using real posting dates.
- 🛂 **Visa sponsorship required.** A job qualifies through explicit posting text, an official
  government sponsor register, a visa-focused job board, or country norms. Negative wording such as
  "no sponsorship" excludes it. The evidence is always shown.
- ✈️ **Relocation as a bonus.** Employer-paid relocation is detected and ranked higher.
- 📊 **Confidence meter (0–100).** Combines company reputation (size, age, layoffs, startup stage),
  employee reviews, sponsorship evidence strength, how easy the move is from India, posting quality,
  and scam checks. A breakdown shows why each job scored as it did.
- 🌏 **High-paying countries.** v1: US, Canada, UK, Ireland, Germany, UAE, Saudi Arabia, Qatar,
  Singapore, Malaysia and Thailand, each with researched visa routes, sponsor registers and local job sites. More of Europe,
  Oceania and East Asia are coming soon.
- 🤖 **Optional Claude AI.** Resume parsing, match scoring, unclear-sponsorship classification and
  cover-letter drafts, using your own API key with a monthly budget cap.
- 📋 **Application tracker.** A board that follows each job from Saved to Applied to Interviewing to Offer.
- 🔒 **Private by design.** No accounts and no telemetry. Your resume, settings and API key stay on
  your machine. Sites are only accessed while logged out, and we never use your personal accounts.

## Data store

Country, job-site and trust research lives in [`data/`](data/) as plain JSON ([schema](data/SCHEMA.md)).
Each file records which model researched it, when, from which sources, and when it should be re-checked.
The research notes and a per-file summary are in [`docs/research/`](docs/research/). Validate with `python scripts/validate_data.py`.
Immigration information changes often: always confirm on the official government pages linked in each file.

## Disclaimer

Shorebound is a job-discovery aid, not immigration or legal advice. Always check visa requirements
with official government sources and check every job posting yourself before applying. Never pay a
recruiter or employer to get a job.

## License

[PolyForm Strict 1.0.0](LICENSE) © 2026 Ahmed Suhail S A.

You may use this software for personal, noncommercial purposes. You may not redistribute it, publish
modified versions, or present it as your own work. For any other use, please open an issue to ask.
