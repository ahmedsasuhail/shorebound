# Global job data sources for Shorebound (free, logged-out, multi-country)

Research date: 2026-11-22. Method: web search, vendor docs pages, and live logged-out HTTP probes (curl, one request each, identifying User-Agent). "Verified live" means the endpoint returned the described JSON/RSS/XML on 2026-11-22. Machine-readable catalogue: `data/sources/global.json`.

## Public ATS job-board APIs (no auth): endpoints, dates, locations, limits, terms, company discovery

### Takeaway
Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, Personio (XML), Teamtailor (RSS), Breezy and Workday (POST cxs) all return logged-out job lists with a posting date and location data. Only Greenhouse, Lever, Ashby and SmartRecruiters document their public endpoints, and none publishes a numeric rate limit. BambooHR and JazzHR could not be verified. For company discovery, the best approach is to match names from government sponsor registers against probed ATS slugs.

### Cited Findings
- Greenhouse: `GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs`; `content=true` adds description, departments and offices; GET endpoints need no auth (only application POST uses Basic Auth); "Requests may be rate limited for security and traffic reasons" (no number given) — [Greenhouse Job Board API docs](https://docs.greenhouse.io/job-board.html)
- Greenhouse live response includes `first_published`, `updated_at`, `location.name`, `absolute_url`, `application_deadline`, `meta.total` (Stripe: 777 jobs in one unpaginated call) — [live probe](https://boards-api.greenhouse.io/v1/boards/stripe/jobs)
- boards.greenhouse.io robots.txt has `User-agent: *` and no Disallow lines — [robots.txt](https://boards.greenhouse.io/robots.txt)
- Lever: `GET https://api.lever.co/v0/postings/{SITE}?skip=X&limit=Y` with an EU instance at `https://api.eu.lever.co/v0/postings/`; `mode=json`; filters location/commitment/team/department/level are case-sensitive; published postings are publicly viewable and "may be scraped by third parties"; the only stated rate limit is on application POSTs (>2/s gives 429) — [lever/postings-api README](https://github.com/lever/postings-api)
- Lever live response includes `createdAt` (epoch ms), `country` (ISO2), `workplaceType`, `categories.location/allLocations`. The README field table does not document `createdAt`. An unknown slug returns 404 `{"ok":false,"error":"Document not found"}` — [live probe](https://api.lever.co/v0/postings/spotify?mode=json&limit=1)
- jobs.lever.co (the HTML host) robots.txt: `User-agent: * Disallow: /` — [robots.txt](https://jobs.lever.co/robots.txt)
- Ashby: `GET https://api.ashbyhq.com/posting-api/job-board/{JOB_BOARD_NAME}?includeCompensation=true`; `publishedAt` = "ISO DateTime when the job was last published"; fields include location, secondaryLocations with postalAddress.addressCountry, isRemote, workplaceType (OnSite/Remote/Hybrid), employmentType — [Ashby docs](https://developers.ashbyhq.com/docs/public-job-posting-api)
- Ashby responses are large because full descriptions are always included (Ramp ~3.4 MB); jobs.ashbyhq.com robots.txt disallows `/api/` on that host (the documented API is on api.ashbyhq.com) — [live probe](https://api.ashbyhq.com/posting-api/job-board/ramp), [robots.txt](https://jobs.ashbyhq.com/robots.txt)
- SmartRecruiters: the Posting API exposes postings a customer made public; docs say "The Public Posting API supports both API Key and OAuth" — [SmartRecruiters docs](https://developers.smartrecruiters.com/docs/posting-api). However, `GET https://api.smartrecruiters.com/v1/companies/{id}/postings` returned data with no auth (fields `releasedDate`, `location.country/city/remote/hybrid`). A wrong id returns 200 with `totalFound: 0` — [live probe](https://api.smartrecruiters.com/v1/companies/smartrecruiters/postings?limit=1)
- Workable: help center documents `https://www.workable.com/api/accounts/<account_subdomain>?details=true` — [Workable help (via search)](https://help.workable.com/hc/en-us/articles/115012771647). Third parties also cite the widget endpoint `apply.workable.com/api/v1/widget/accounts/{slug}`. No official widget docs were found — [search summary of dev.to/Apify](https://dev.to/zsevic/integration-with-workable-public-jobs-api-3nk4)
- Workable verified live: the v1 widget returns `published_on`, `created_at`, `country`, `city`, `telecommuting`. v3 `POST https://apply.workable.com/api/v3/accounts/{sub}/jobs` returns `published` (ISO), `location.countryCode`, `remote`, and a `nextPage` token. An unknown subdomain returns 404 — [live probe](https://apply.workable.com/api/v1/widget/accounts/huggingface)
- Recruitee: `https://{company}.recruitee.com/api/offers/` returns `published_at`, `created_at`, `locations[].country_code`, `remote`, `hybrid`, `on_site`, `salary` — [live probe](https://bunq.recruitee.com/api/offers/)
- Personio: `https://{company}.jobs.personio.de/xml?language=en` returns XML `<workzag-jobs>` with `<createdAt>`, `<office>`, `<employmentType>`, `<seniority>`, `<schedule>`. Location is the city only — [live probe](https://personio.jobs.personio.de/xml?language=en)
- Teamtailor: `https://{company}.teamtailor.com/jobs.rss` returns RSS with `pubDate`, `tt:city`, `tt:country`, `remoteStatus` — [live probe](https://tibber.teamtailor.com/jobs.rss)
- Breezy: `https://{company}.breezy.hr/json` returns `published_date`, `location.country.id`, `location.is_remote` — [live probe](https://breezy.breezy.hr/json)
- Workday: `POST https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs` with body `{"appliedFacets":{},"limit":20,"offset":0,"searchText":""}` returns `total`, `jobPostings[].title/externalPath/locationsText/postedOn` ("Posted Today") and facets. A GET on the same URL returns HTTP 400 — [live probe](https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs)
- Slug datasets surfaced: LastRound AI ATS directory on DataHub (its maintainers warn slugs go stale) and ConorsCode/open-jobs-data (`companies.json`, a fixed list). Lever slugs are reported as case-sensitive; Greenhouse and Ashby as case-insensitive. All of this is from a search summary; neither dataset was opened — [DataHub](https://datahub.io/lastroundai-hiring-data/lastroundai-hiring-data/ats-directory), [GitHub](https://github.com/ConorsCode/open-jobs-data)
- The Common Crawl index lists CC-MAIN-2026-43 as the latest crawl, but a wildcard CDX query for `jobs.ashbyhq.com/*` returned 504 Gateway Time-out — [collinfo](https://index.commoncrawl.org/collinfo.json)

### Inferences
- An ATS-first pipeline works well: one GET per company per day, filtered locally on the date field to the last 7 days. Date semantics differ, though. Greenhouse `first_published` is closest to "originally posted". Ashby `publishedAt` is "last published", so a re-published job looks new. Workday gives only relative text.
- Discovery: take names from sponsor registers (UK, NL, IE, etc.; covered by the country researchers), generate slug candidates (lowercase, strip punctuation and legal suffixes), and probe each ATS in turn: Greenhouse 404, Lever 404 (global then EU), Ashby, Workable 404, SmartRecruiters totalFound=0, Recruitee, Personio, Teamtailor. Cache hits and misses. A sponsor-register match is itself a strong sponsorship signal.
- The endpoints are undocumented for Workable widget/v3, Recruitee, Personio XML, Teamtailor RSS, Breezy and Workday cxs. They are what the vendors' own career pages use, so expect breakage and keep the adapters isolated.

### Gaps
- No numeric rate limits for any ATS public GET endpoint.
- BambooHR `careers/list` was not verified (test subdomains redirected to the marketing site). JazzHR has no public no-auth list endpoint found.
- Workday job-detail date field not verified; other `postedOn` phrasings not observed.
- License and freshness of slug datasets not checked; Common Crawl slug discovery unproven.

## Free aggregators and APIs

### Takeaway
The most useful no-key feeds are Arbeitnow (server-side `visa_sponsorship=true`), HN Who-is-hiring via Algolia, Himalayas, WWR RSS, Remotive, RemoteOK, Jobicy and Working Nomads. Adzuna and Careerjet need free keys. Adzuna's exact country list could not be confirmed. The Muse public API path returns 404.

### Cited Findings
- Adzuna: every call needs `app_id` and `app_key` (free registration). Example path `/v1/api/jobs/gb/search/1` — [Adzuna overview](https://developer.adzuna.com/overview). Documented search params: what, what_exclude, where, sort_by, results_per_page, salary_min, full_time, permanent. The example response has `"created": "2013-11-08T18:07:39Z"`. `max_days_old` is not on that page — [Adzuna search docs](https://developer.adzuna.com/docs/search)
- Third-party Adzuna wrapper: `sort_by=date`, `max_days_old`, `created` field, and 12 countries (gb, us, de, fr, au, nz, ca, in, pl, br, at, za). Another third-party source claims 19 countries. This conflicts and is unconfirmed — [glama MCP wrapper](https://glama.ai/mcp/servers/@folathecoder/adzuna-job-search-mcp/blob/2a1dccf28f89db8e9b261456bd103b5108fd6ded/server.py)
- Careerjet v4: `https://search.api.careerjet.net/v4/query`; Basic auth with the API key as username and an empty password; params locale_code, keywords, location, contract_type, work_hours, sort (relevance|date|salary), page 1-10, page_size 1-100; `user_ip` and `user_agent` of the end user are required (403 if missing) — [Careerjet API docs](https://www.careerjet.com/partners/api); without a key the API returns 401 with that message — [probe](https://search.api.careerjet.net/v4/query)
- Jooble: register at jooble.org/api/about for a key; requests are POSTs with JSON (keywords, location, radius, salary, page). One third party claims a 500-request lifetime limit per key (unconfirmed) — [Jooble help center (via search)](https://jooblehelpcenter.freshdesk.com/en/support/solutions/articles/60001448238-rest-api-documentation). jooble.org/api/about served a Cloudflare challenge to curl.
- Arbeitnow: `https://www.arbeitnow.com/api/job-board-api`. Terms: "free public API for jobs, please do not abuse. I would appreciate linking back... By using the API, you agree to the terms of service present on Arbeitnow.com"; "Jobs are updated every hour and order by the created_at timestamp"; 300 per page; fields include `created_at` (unix), `remote`, `location`, `tags` — [live probe](https://www.arbeitnow.com/api/job-board-api)
- Arbeitnow: "To find jobs with visa sponsorship, you can use the parameter visa_sponsorship and set it to true or false"; a UK version of the API launched in 2026 — [Arbeitnow blog](https://www.arbeitnow.com/blog/job-board-api)
- Remotive: the response's legal notice requires a link back and Remotive credit; forbids submitting jobs to third parties (Jooble, Google Jobs, LinkedIn); says jobs are delayed 24 hours; advises max 4 requests/day; "excessive requests will be blocked"; paid private API from $5k/mo — [live probe](https://remotive.com/api/remote-jobs)
- Remote OK: "API Terms of Service: Please link back (with follow, and without nofollow!) to the URL on Remote OK and mention Remote OK as a source... If you do not we'll have to suspend API access" — [live probe](https://remoteok.com/api); its robots.txt says `User-agent: * Disallow: /` — [robots.txt](https://remoteok.com/robots.txt)
- We Work Remotely: category RSS `https://weworkremotely.com/categories/remote-programming-jobs.rss` with `<ttl>60</ttl>` and a `<region>` field; robots.txt has no Disallow for * — [RSS](https://weworkremotely.com/categories/remote-programming-jobs.rss)
- Himalayas: free public JSON API with no key required; a free key gives "60 requests per minute and 10,000 per day"; cached responses don't count; `/jobs/api` (cursor, limit max 20, offset deprecated), `/jobs/api/search` (q, country, seniority, employment_type, company, timezone, sort=recent, page), and a single-job check endpoint — [Himalayas API docs](https://himalayas.app/api)
- Jobicy: public API returns listings published in the last 7 days; new listings appear 3 hours after publication; "Allow at least 1 second between requests from the same IP"; honour Retry-After on 429; credit Jobicy and keep the Jobicy URL; direct ATS links cost $0.01/job on the commercial tier — [Jobicy API docs](https://jobicy.com/jobs-rss-feed)
- Working Nomads: `https://www.workingnomads.com/api/exposed_jobs/` returns a JSON array with `pub_date`, `location`, `tags` — [live probe](https://www.workingnomads.com/api/exposed_jobs/)
- The Muse: `https://www.themuse.com/api/public/jobs?page=1` and `/api/public/v2/jobs` both returned 404 on 2026-11-22 — [probe](https://www.themuse.com/api/public/jobs?page=1)
- HN: `search_by_date?tags=story,author_whoishiring` lists "Ask HN: Who is hiring? (November 2026)", objectID 50338728, created 2026-11-02. Thread rules: "include REMOTE... ONSITE"; "Please only post if you personally are part of the hiring company—no recruiting firms or job boards" — [Algolia HN probe](https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=3); `tags=comment,story_50338728` gives 381 comments, of which 35 match "visa" — [probe](https://hn.algolia.com/api/v1/search?tags=comment,story_50338728&query=VISA)

### Inferences
- Arbeitnow is the only free source found with a server-side visa filter, so it is a tier-1 source for Germany/EU.
- HN text search for "visa" also matches negative mentions, so the app must classify each comment (positive vs "no visa sponsorship").
- The remote boards are low volume for visa jobs. They mainly help with remote and international-hiring roles. Attribution and link-back terms are mandatory.

### Gaps
- Adzuna country list, rate limits and terms; Jooble quota; Careerjet locale list and job fields; The Muse API status; Levels.fyi, Wellfound, WTTJ/Otta and Built In have no public jobs API (only robots.txt and sitemaps were seen).

## Relocation and visa-focused boards

### Takeaway
Arbeitnow (visa filter) and Landing.jobs (`relocation_paid` field) expose structured relocation/visa data. Landing.jobs' robots.txt disallows `/api/`. Relocate.me and Japan Dev have no API but publish sitemaps; Japan Dev pages contain JSON-LD. Treat those as link_only, or ask for permission.

### Cited Findings
- Landing.jobs `/api/v1/jobs` returns `relocation_paid`, `published_at`, `expires_at`, `locations[].country_code`, `remote`, and salary range — [probe](https://landing.jobs/api/v1/jobs?limit=1); robots.txt: `Disallow: /api/` — [robots.txt](https://landing.jobs/robots.txt)
- Relocate.me robots.txt has no Disallow for * and lists sitemap.xml; `/rss` returns 404 — [robots.txt](https://relocate.me/robots.txt)
- Japan Dev robots.txt has no Disallow for * and lists sitemap.xml; the /jobs page contains `application/ld+json` blocks — [robots.txt](https://japan-dev.com/robots.txt)
- Wellfound robots.txt disallows `/_jobs/` and jobSlug query URLs — [robots.txt](https://wellfound.com/robots.txt); Welcome to the Jungle disallows `*/jobs?query=*` — [robots.txt](https://www.welcometothejungle.com/robots.txt)

### Inferences
- For a personal local app, sitemap + JSON-LD parsing of Japan Dev and Relocate.me is technically feasible and robots-compliant. Their terms were not read, so default to link_only until the terms are checked or permission is given.

### Gaps
- Reputation data, terms of service and job volume for Relocate.me, Japan Dev and Landing.jobs. Dedicated UK/NL "sponsor jobs" boards were not researched (no time).

## Logged-out LinkedIn and Indeed feasibility, and JobSpy

### Takeaway
Both LinkedIn and Indeed technically answer logged-out requests. Both prohibit automated access: LinkedIn through robots.txt and its User Agreement (which covers Visitors); Indeed through its terms. hiQ ended in a loss for the scraper. Recommendation: link_only deep links that the user opens in their own browser. Never automated fetching. JobSpy (MIT) should not be bundled as a default.

### Cited Findings
- The LinkedIn guest endpoint `jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=...&location=...&f_TPR=r604800&start=0` returned 200 logged-out with job cards containing `<time class="job-search-card__listdate" datetime="2026-11-19">` — [probe](https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=software%20engineer%20visa%20sponsorship&location=Germany&f_TPR=r604800&start=0)
- LinkedIn robots.txt: "The use of robots or other automated means to access LinkedIn without the express permission of LinkedIn is strictly prohibited... email whitelist-crawl@linkedin.com"; `Disallow: /jobs-guest/`, `Disallow: /` — [robots.txt](https://www.linkedin.com/robots.txt)
- LinkedIn User Agreement (effective November 3, 2025) s.8.2 forbids using "software, devices, scripts, robots or any other means" to "scrape or copy the Services" and using "bots or other unauthorized automated methods". s.1.2: "This Contract applies to Members and Visitors" — [LinkedIn User Agreement](https://www.linkedin.com/legal/user-agreement)
- hiQ v. LinkedIn: on Dec 6, 2022 the parties filed a stipulated consent judgment with $500,000 against hiQ, a permanent injunction to stop scraping, and destruction of the data/code. In November 2022 the court held that user-agreement anti-scraping provisions are enforceable as contract. The settlement has no precedential value — [Proskauer](https://newmedialaw.proskauer.com/2022/12/08/hiq-and-linkedin-reach-proposed-settlement-in-landmark-scraping-case/), [Morgan Lewis](https://www.morganlewis.com/blogs/sourcingatmorganlewis/2022/12/linkedin-v-hiq-landmark-data-scraping-suit-provides-guidance-to-data-scrapers-and-web-operators) (from search summaries; pages not opened)
- Indeed terms (Last Updated September 29, 2026) bind anyone accessing "any part of our Site, including via an API"; "Use of any automation, scripting, or bots to automate the Indeed Apply process" outside official tooling "is prohibited" — [Indeed legal](https://www.indeed.com/legal) (first 100k characters read). A third-party tracker lists a high-severity "Prohibition on Scraping Automated Access and Bot Activity" — [ConductAtlas](https://conductatlas.com/platform/indeed/indeed-terms-of-service/provision/CA-P-028619/prohibition-on-scraping-automated-access-and-bot-activity/). A scraping vendor claims Indeed uses IP rate limiting rather than DataDome/Cloudflare (vendor claim) — [ScrapeOps](https://scrapeops.io/websites/indeed)
- An Indeed logged-out search page (`/jobs?q=software+engineer&fromage=7`) returned 200 to curl — [probe](https://www.indeed.com/jobs?q=software+engineer&fromage=7)
- JobSpy: sites linkedin, indeed, zip_recruiter, glassdoor, seek, naukri, hellowork, bayt, bdjobs, google (FAQ: Google Jobs currently unavailable). Indeed supports 58 countries via `country_indeed`. Glassdoor covers 20 countries (AR, AU, AT, BE, BR, CA, FR, DE, HK, IN, IE, IT, MX, NL, NZ, SG, ES, CH, GB, US). MIT license. "LinkedIn rate limits bursts of requests with a 429, which clears within about a minute"; "Glassdoor rate limits above about 2 requests a second"; "Indeed is the best scraper currently with no rate limiting"; ~1000-job cap per search; `hours_old` filter; returns `date_posted`; recommends proxies for 429s; 403 commits, 20 open issues, 17 open PRs, no releases listed — [JobSpy README](https://github.com/speedyapply/JobSpy)

### Inferences
- The low-risk route is to generate deep links (LinkedIn `f_TPR=r604800`, Indeed `fromage=7&sort=date`) for the user to open manually, and optionally let the user paste job URLs for local JSON-LD enrichment. Automated fetching of LinkedIn guest endpoints breaches the explicit robots.txt rule and contract terms. Using JobSpy's proxy advice to evade 429s is adversarial.
- Ninth Circuit CFAA reasoning makes criminal/CFAA exposure for public pages lower, but contract and trespass claims remain (as in the hiQ end-state). Not legal advice.

### Gaps
- Exact Indeed anti-scraping clause text; Indeed's full robots.txt; JobSpy last-commit date; post-2022 cases (e.g. Meta v. Bright Data) not researched.

## Google for Jobs / schema.org JobPosting

### Takeaway
JobPosting JSON-LD reliably carries `datePosted` (required), `validThrough`, `jobLocation`, `employmentType`, `jobLocationType` and `applicantLocationRequirements`, so it makes a good enrichment parser. Google provides no free API to search job postings. Discovery has to come from sitemaps or ATS APIs.

### Cited Findings
- Required: datePosted ("The original date that employer posted the job"), description, hiringOrganization, jobLocation (not required when applicantLocationRequirements is present), title. Recommended: applicantLocationRequirements, baseSalary, directApply, employmentType (FULL_TIME, PART_TIME, CONTRACTOR, TEMPORARY, INTERN, VOLUNTEER, PER_DIEM, OTHER), identifier, jobLocationType=TELECOMMUTE, validThrough. The docs mention the Indexing API for publishers only and no search API — [Google JobPosting docs](https://developers.google.com/search/docs/appearance/structured-data/job-posting)
- Sites publishing sitemaps in robots.txt include himalayas.app (jobs sitemaps), relocate.me, japan-dev.com, builtin.com (job-board-sitemap.xml) and wellfound.com — [Himalayas robots](https://himalayas.app/robots.txt), [Built In robots](https://builtin.com/robots.txt)

### Inferences
- Use JSON-LD as a fallback parser for arbitrary career-page URLs (from HN comments, sponsor-register company sites, or user-pasted links) to get a reliable posted date and country.

### Gaps
- Whether Greenhouse's hosted job pages carry JobPosting JSON-LD (a grep of one job-boards.greenhouse.io page found none in the raw HTML; it may be rendered client-side).

## Polite scraping best practices

### Takeaway
Use the vendor-stated limits as defaults: Remotive at most 4/day, WWR ttl 60 minutes, Jobicy at least 1s between requests, Himalayas 60/min with a key. Apply conservative defaults elsewhere: 1 request in flight per host, daily ATS refresh, conditional GETs, Retry-After backoff, an honest User-Agent and attribution links.

### Cited Findings
- Vendor-stated cadences: Remotive "max. 4 times a day" — [Remotive API](https://remotive.com/api/remote-jobs); WWR `<ttl>60</ttl>` — [WWR RSS](https://weworkremotely.com/categories/remote-programming-jobs.rss); Jobicy ">= 1 second" and Retry-After — [Jobicy docs](https://jobicy.com/jobs-rss-feed); Himalayas key limits and cache-free hits — [Himalayas docs](https://himalayas.app/api); Arbeitnow updates hourly and asks "please do not abuse" — [Arbeitnow API](https://www.arbeitnow.com/api/job-board-api)
- Attribution requirements: Remotive, Remote OK and Jobicy (links above); Arbeitnow requests a link back.

### Inferences
- Recommended defaults (in `recommendations.polite_scraping_defaults`): an identifying UA with a project URL; robots.txt cached for 24h and obeyed for crawl paths; one in-flight request per host, at most 1 req/s, with jitter; ETag/If-Modified-Since; a local store keyed by source+id; negative-cache slug probes for 30 days; stop on 403/captcha; no proxies or IP rotation.

### Gaps
- No general authoritative polite-scraping standard (e.g. RFC 9309 for robots.txt) was read during this session.
