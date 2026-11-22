# Research notes

Research behind the JSON data store in [`data/`](../../data/). It was run on 2026-11-22/23 by Claude Code
research subagents (model `claude-opus-5-5`; reasoning-effort setting not exposed to the model).
Each data file's `_meta` records its searches, pages read, confidence and open questions.

| Area | Data file | Confidence | Ease from India | Sources cited | Notes |
|---|---|---|---|---|---|
| United Arab Emirates | [`ae.json`](../../data/countries/ae.json) | medium | 4/5 | 23 | [gulf.md](gulf.md) |
| Canada | [`ca.json`](../../data/countries/ca.json) | medium | 3/5 | 11 | — (sources in JSON) |
| Germany | [`de.json`](../../data/countries/de.json) | medium | 4/5 | 19 | — (sources in JSON) |
| United Kingdom | [`gb.json`](../../data/countries/gb.json) | medium | 3/5 | 12 | — (sources in JSON) |
| Ireland | [`ie.json`](../../data/countries/ie.json) | medium | 4/5 | 10 | — (sources in JSON) |
| Malaysia | [`my.json`](../../data/countries/my.json) | medium | 3/5 | 11 | [southeast-asia.md](southeast-asia.md) |
| Qatar | [`qa.json`](../../data/countries/qa.json) | low | 3/5 | 21 | [gulf.md](gulf.md) |
| Saudi Arabia | [`sa.json`](../../data/countries/sa.json) | low | 3/5 | 29 | [gulf.md](gulf.md) |
| Singapore | [`sg.json`](../../data/countries/sg.json) | medium | 4/5 | 20 | [southeast-asia.md](southeast-asia.md) |
| Thailand | [`th.json`](../../data/countries/th.json) | low | 3/5 | 18 | [southeast-asia.md](southeast-asia.md) |
| United States | [`us.json`](../../data/countries/us.json) | medium | 2/5 | 19 | — (sources in JSON) |
| sources/global.json | [`global.json`](../../data/sources/global.json) | medium | — | 41 | [global-sources.md](global-sources.md) |
| trust/signals.json | [`signals.json`](../../data/trust/signals.json) | medium | — | 25 | [trust-and-india-origin.md](trust-and-india-origin.md) |
| origins/in.json | [`in.json`](../../data/origins/in.json) | medium | — | 17 | [trust-and-india-origin.md](trust-and-india-origin.md) |

**Gaps.** The US, Canada, UK, Ireland and Germany research was paused before its narrative notes were written.
Those JSON files are complete, and every fact links to an entry in that file's `sources` array.

**Coming soon.** Countries marked `coming_soon` in [`data/catalog.json`](../../data/catalog.json) have not been researched yet.

**Re-research** each file after its `_meta.review_by` date: immigration thresholds change every year.
