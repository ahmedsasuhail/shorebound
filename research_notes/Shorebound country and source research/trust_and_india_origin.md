# Company trust signals and India-side emigration requirements (Shorebound)

Researched 2026-11-22. 20 web searches; 8 pages read in full (several key pages returned 403/404, noted below). Data files: `data/trust/signals.json`, `data/origins/in.json`.

## Employee-review sources: what a free, logged-out app can use

### Takeaway
None of the major employee-review sites offers a free, logged-out API an app can use. Glassdoor's API is closed. Reddit now needs approval for new API apps. Trustpilot's API needs a key that is likely paid. Treat every review site as link-only (deep links) in v1, and give reviews a low weight in scoring, renormalized when the data is missing.

### Cited Findings
- Glassdoor closed its partner Job Search / Employer Reviews API to new applications in 2021. Current access is sales-led for ATS, programmatic-recruitment and employer-brand partners, and there is no self-serve developer portal. — [APIs.io Glassdoor provider](https://apis.io/providers/glassdoor/) (secondary); [Zuplo](https://zuplo.com/blog/2024/09/30/what-is-glassdoor-api)
- Glassdoor Terms of Use: the India-site version shows a revision date of 2026-06-30. The automated-access clause could not be read because the page returned HTTP 403. — [Glassdoor Terms](https://www.glassdoor.co.in/about/terms.htm)
- Reddit free tier: 100 queries/minute per OAuth client id and 10 QPM without OAuth, from 2023-07-01. The limit is averaged over 10 minutes and shared by all users of one app. Free access is for non-commercial use. — [data365 (secondary)](https://data365.co/blog/reddit-api-limits); [Zuplo](https://zuplo.com/blog/2024/10/01/reddit-api-guide). The official Data API Wiki returned 403.
- Reddit's Responsible Builder Policy (announced Nov 2025) ended self-service API access. New apps must request approval, with a target of about 7 days. Developers are pointed to Devvit and researchers to r/reddit4researchers. — [r/redditdev thread (mirror)](https://r.datuan.dev/r/redditdev/comments/1oug31u/introducing_the_responsible_builder_policy_new/)
- Trustpilot's Business Units API (public) has find-by-name and public-reviews endpoints and needs an API key. — [Trustpilot developers](https://developers.trustpilot.com/business-units-api-(public)). A secondary source says API access is a paid add-on for Premium/Enterprise. — [dataimpulse](https://dataimpulse.com/blog/trustpilot-api/)
- Levels.fyi has a Terms of Use page dated 2023-08-22. No official public API was found, and third-party scraper listings claim its internal API needs session cookies. — [Levels.fyi Terms](https://levels.fyi/about/terms.html); [Apify listing](https://apify.com/glassventures/levelsfyi-salary-scraper)
- Indeed company reviews, AmbitionBox, kununu, Blind, Comparably, Google Maps: no API or ToS information was gathered. They are set to link_only in the data file (see Gaps).

### Inferences
- Deep-link templates (company-name search URLs) give users the review context without the app fetching anything. AmbitionBox is the India-specific link to show. Use kununu for DACH countries and Glassdoor/Indeed elsewhere.
- Trustpilot measures customer experience, so it suits recruiters, job boards and relocation agencies, not employers.
- Google Maps is mainly useful to check that a physical office exists.

### Gaps
- The ToS automated-access clauses for Glassdoor, Indeed, AmbitionBox, kununu, Blind, Comparably and Levels.fyi were not read.
- Reddit's official policy text and current rate limits were not read because of the 403.
- No information was gathered on whether Trustpilot has any free key tier.

## Layoff data: free access methods

### Takeaway
Layoffs.fyi is the best free per-company source for tech layoffs. It has no API but does have a company sitemap and per-company pages. US WARN data is free but split state by state. WARNTracker is paid. UK HR1 data is not public.

### Cited Findings
- Layoffs.fyi covers 3,005 companies and 4,704 events from Mar-2020 to present. Fields: company, date, employees laid off, % of workforce, source URL, industry, funding stage, HQ city, country. It has a company sitemap at `https://layoffs.fyi/company-sitemap/` and pages at `https://layoffs.fyi/company/{slug}/`. No API or bulk download is mentioned. — [layoffs.fyi llms.txt](https://layoffs.fyi/llms.txt)
- Layoffs.fyi data is "free to use for editorial, research, and educational purposes" with attribution and a link. Full exports go through the maintainer. — [Layoffs.fyi press](https://layoffs.fyi/press/)
- There is no national WARN API. NY DOL has a WARN dashboard with filters and PDF downloads. The Krolikowski/Lunsford multistate panel on OpenICPSR gives monthly state-level CSVs. — [NY DOL](https://dol.ny.gov/warn-dashboard); [OpenICPSR 155161](https://www.openicpsr.org/openicpsr/project/155161)
- WARNTracker sells its data ($250 then $250/month). — [WARNTracker data](https://www.warntracker.com/data)
- API Ninjas has a free-key Layoff Notices API (WARN JSON). The free plan has no notice_url. — [API Ninjas](https://api-ninjas.com/api/layoffnotices)

### Inferences
- In v1, fetch the layoffs.fyi company page for resolved companies, cached weekly with attribution. Apply a penalty in company_reputation for layoffs in the last 12 months. Use links for everything else.
- UK HR1 forms go to the government and no public dataset was found. Treat UK layoff data as news/layoffs.fyi only.

### Gaps
- TrueUp layoffs: access and terms were not researched.
- Whether automated fetching by an app falls within layoffs.fyi's "research/educational" permission is unconfirmed.
- No source was found on UK HR1 public availability (absence of evidence, not confirmation).

## Free company-data APIs and name-to-entity resolution

### Takeaway
Wikidata (no key, CC0) is the best global resolver: name → entity → official website, inception, employees, stock listing, LEI. Add country registries: Companies House for GB (free key, 600 requests per 5 minutes), SEC EDGAR for US-listed firms (no key), and GLEIF for global legal-entity checks. OpenCorporates is free only for public-benefit projects. Crunchbase is paid. The Clearbit logo API is gone.

### Cited Findings
- Wikidata Query Service: 60 s hard query timeout. Each client (User-Agent + IP) gets 60 s of processing per 60 s and 30 error queries/min. A descriptive User-Agent is required, and enforcement tightened in 2025-26. — [Wikidata: Data access](https://www.wikidata.org/wiki/Wikidata:Data_access); [Phabricator T402959](https://phabricator.wikimedia.org/T402959)
- Companies House: "up to 600 requests within a five-minute period". Requests over that get 429, and regular abusers may be banned. — [Companies House rate limiting](https://developer-specs.company-information.service.gov.uk/guides/rateLimiting)
- SEC EDGAR: data.sec.gov submissions/companyfacts/companyconcept/frames endpoints need no authentication or API keys. Bulk companyfacts.zip and submissions.zip are rebuilt nightly. Automated access must follow the SEC Privacy and Security Policy. — [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- GLEIF API offers search by entity name with "fuzzy" matching on names and addresses, parent/child relationships, and BIC/ISIN mapping. Docs are at api.gleif.org/docs. — [GLEIF API](https://www.gleif.org/en/lei-data/gleif-api)
- OpenCorporates requires an API key. Data is free for open-data projects under its open licence, and commercial use is paid. — [OpenCorporates API docs](https://api.opencorporates.com/documentation/Home); [Bellingcat guide](https://bellingcat.com/resources/2023/08/24/following-the-money-a-beginners-guide-to-using-the-opencorporates-api)
- The Clearbit Logo API was sunset on 2025-12-08 (first announced for 2025-12-01). Logo.dev is the successor and requires a key. — [Clearbit changelog](https://clearbit.com/changelog/2025-11-24); [HubSpot community](https://community.hubspot.com/t/clearbit-logo-api-will-be-sunset-on-december-1-2025/134244)

### Inferences
- Resolution order: posting/ATS domain → Wikidata label search, accepted only if the P856 website matches the domain → country registry (GB: Companies House, US: EDGAR, else GLEIF) → sponsor-register name match. If nothing resolves, raise the `vague_company` scam signal.
- For stock-listed status, the Wikidata P414/P249 properties and EDGAR tickers avoid any paid market-data API.

### Gaps
- GLEIF rate limit, licence and auth were not confirmed on the page read.
- The SEC numeric fair-access limit (commonly cited as 10 requests/s) was not confirmed.
- Companies House key cost was not stated on the page read.
- GitHub unauthenticated limits were not checked.

## Job-scam signals the app can detect automatically

### Takeaway
Official sources (FTC, MEA/PGE) agree on the core red flags: paying for a job, WhatsApp-only contact, tourist visa instead of work visa, no proper contract, too-good pay, and unregistered agents. Southeast-Asia cyber-scam compounds are a specific, high-severity India-origin threat.

### Cited Findings
- FTC: "Honest employers, including the federal government, will never ask you to pay to get a job". Fake-check, reshipping and "lots of money for little work" offers are scams. Look the company up with "scam/review/complaint". — [FTC Job Scams](https://consumer.ftc.gov/articles/job-scams)
- MEA (Dec 2023): big rise in people cheated by unregistered agents, with overcharging of Rs 2-5 lakh. Illegal agents usually communicate only via WhatsApp. A genuine offer has a contract signed by the employer, the RA and the emigrant, and an employment visa rather than a tourist visa. RA service charge is capped at Rs 30,000 + 18% GST. Verify agents via the "List of active RA" on emigrate.gov.in. — [Careers360 copy of MEA advisory](https://news.careers360.com/dont-fall-prey-fake-employment-offers-ministry-of-external-affairs-job-seekers-abroad); original [PIB release](https://pib.gov.in/PressReleasePage.aspx?PRID=1985025) returned 403
- 3,505 illegal agents had been notified on eMigrate as of 2026-04-09. Complaints referred to states: 1006 (2023), 1378 (2024), 1541 (2025). The table layout in the PDF is ambiguous about which column is which. — [MEA OE&PGE overview 21-04-2026](https://www.mea.gov.in/images/pdf/01-Overview-of-work-of-Overseas-Employment-21-04-2026.pdf)
- Cambodia/Laos (May 2024): fake agents working with counterparts in India lure people to cyber-scam firms as "Digital Sales and Marketing Executives" or "Customer Support", including via Thailand into Laos. — [AIR News](https://www.newsonair.gov.in/government-issues-advisory-to-nationals-travelling-to-cambodia-for-jobs-to-be-wary-of-fake-agents)
- 2022 Thailand → Myanmar fake IT jobs advisory: verify foreign employers through Indian Missions. — [ThePrint](https://theprint.in/india/verify-credentials-of-foreign-employers-mea-advisory-following-fake-job-offers-in-myanmar/1141182)
- 6,998 Indians rescued from cybercrime centres in Cambodia, Myanmar and Laos, 2022-2025 (government reply as reported). — [Scroll](https://scroll.in/latest/1090539/scroll_in)

### Inferences
- The automatable detectors are listed in `scam_signals[]` with penalty weights. Hard flags (fee demanded, visa-for-fee, tourist-to-work conversion, SE-Asia lure pattern, check/reshipping) cap the score at 10.
- The 1.5× market-salary threshold and all penalty values are my heuristics, not sourced figures.

### Gaps
- The full text of any 2025-26 MEA scam advisory was not found. The latest confirmed advisories are from 2023-24.

## Proposed confidence model (0-100)

### Takeaway
Five weighted factors: sponsorship evidence 30, company reputation 20, ease of move from India 20, freshness 15, employee reviews 15. Weights are renormalized over the factors that have data, so v1 usually runs without reviews. Scam penalties are subtracted afterwards, with hard caps. Details are in `confidence_model` in signals.json.

### Cited Findings
- No source was consulted for the weights. They are a design proposal (see Inferences).

### Inferences
- Sponsorship evidence gets the most weight because it is the factor that most often makes a lead useless to an Indian applicant. Explicit posting text (1.0) ranks above a sponsor-register match (0.8 exact, 0.6 fuzzy), because a register entry only proves the employer can sponsor, not that this role will. Inferred evidence scores 0.2. An explicit "no sponsorship" caps the score at 5.
- Company reputation (age, size, listed/active status, 12-month layoffs) protects against offers being withdrawn and failures before the visa lands. Early-stage startups get partial credit, not zero.
- Ease of move maps the country file's 1-5 score to 0-1. It captures degree recognition, lotteries and ECR/attestation burden.
- Freshness reflects the user's "recent jobs" goal and the risk of stale re-posts.
- Reviews are useful but usually unavailable to a logged-out app, so the UI should show a coverage percentage.

### Gaps
- No labelled data exists to calibrate the weights. They should be tuned after use.

## India origin: ECR/ECNR, eMigrate, Emigration Act and the 2025 Bill

### Takeaway
As of April 2026 MEA lists 19 ECR countries; Iran is now included, while older pages say 17 or 18. ECR passport holders need Emigration Clearance via eMigrate for employment there. ECNR holders, which covers most degree-holding software engineers, need nothing, though they can register voluntarily. The Overseas Mobility Bill 2025 is still a draft, and the Emigration Act 1983 still applies.

### Cited Findings
- The 19 ECR countries are Afghanistan, Bahrain, Indonesia, Iraq, Jordan, Kuwait, Lebanon, Libya, Malaysia, Oman, Qatar, Saudi Arabia, Iran, South Sudan, Sudan, Syria, Thailand, UAE and Yemen. EC for Libya and Yemen is suspended. There are 16 PoE offices. eMigrate (launched 2015) is integrated with Passport Seva and the Bureau of Immigration. Foreign employers must register on eMigrate. — [MEA OE&PGE overview 21-04-2026](https://www.mea.gov.in/images/pdf/01-Overview-of-work-of-Overseas-Employment-21-04-2026.pdf)
- ECNR registration for ECR countries is voluntary. A 2018 advisory to make it mandatory from 2019-01-01 was put in abeyance. — same source
- PBBY insurance is mandatory for ECR workers going to ECR countries. Cover is INR 10 lakh, with premiums of INR 275 for 2 years or INR 375 for 3 years. — same source
- Older sources conflict on the count: a 2021 High Commission list has 16 countries and an MEA FAQ says 17. — [HCI Kuala Lumpur 2021](https://hcikl.gov.in/pdf/SPDC_list_of_ECR_countries_2021_sep5_8.pdf); [MEA FAQ](https://www.mea.gov.in/issues-of-intending-emigrants.htm)
- The draft Overseas Mobility (Facilitation and Welfare) Bill, 2025 "will replace the existing Emigration Act 1983". Comments closed 2025-11-07, and the page was last updated 2026-03-19. — [MEA bill page](https://www.mea.gov.in/overseasmobilitybill2025.htm). A July-2026 report still calls it "proposed". — [The Policy Edge](https://www.policyedge.in/p/government-releases-stakeholder-recommendations-on-proposed-overseas-mobility-bill)
- Female domestic-worker recruitment is restricted to state-run agencies. The PDF says 11, but its list contains 17 names (a document inconsistency). — MEA overview above

### Inferences
- The app should ask for passport category once and show EC/PBBY steps only to ECR holders going to the 8 Shorebound ECR destinations (AE, SA, QA, KW, BH, OM, MY, TH).

### Gaps
- No evidence was found of the bill being introduced in or passed by Parliament up to 2026-11-22.
- Exact ECNR eligibility criteria were not re-verified.
- No machine-readable RA or illegal-agent list was confirmed.

## Attestation / apostille, PCC, credential evaluators

### Takeaway
Most Western and East-Asian destinations, plus Saudi Arabia, Bahrain and Oman, accept an MEA apostille. The UAE, Qatar, Kuwait and Malaysia need MEA attestation plus embassy legalisation, and Thailand does too until its accession takes effect on 2027-02-28. PCC costs Rs 500 via Passport Seva. Credential evaluation depends on the destination: WES (CA/US), ACS (AU), anabin/ZAB (DE), UK ENIC, NZQA.

### Cited Findings
- HCCH status table: India party since 2005-07-14. Saudi Arabia 2022-12-07, China 2023-11-07, Canada 2024-01-11, Singapore 2021-09-16, Indonesia 2022-06-04, Bahrain 2013-12-31, Oman 2012-01-30. Thailand deposited 2026-06-30, in force 2027-02-28. UAE, Qatar, Kuwait and Malaysia are not listed. Hong Kong is not listed separately. India's entry is marked with an objection. — [HCCH Apostille status](https://www.hcch.net/en/instruments/conventions/status-table/?cid=41)
- MEA apostille fee is Rs 50 per document, and normal attestation is free. Outsourced agency charges are Rs 84 service + Rs 3/page scanning. Older pages cite Rs 22/18/16. e-Sanad works only for documents in a digital repository. — [MEA apostille menu](https://www.mea.gov.in/apostille-menu.htm) (snippet); [MEA attestation matters](https://www.mea.gov.in/attestation-and-apostille-matters.htm) (snippet); [Vikaspedia e-Sanad](https://en.vikaspedia.in/viewcontent/e-governance/online-citizen-services/government-to-citizen-services-g2c/business-related-services/e-sanad-portal)
- PCC fee is Rs 500, applied for on the Passport Seva portal. The PSK pays in cash per the form instructions. — [Passport Seva FAQ](https://portal2.passportindia.gov.in/AppOnlineProject/online/faqFeePayment); [PCC instructions](https://passportindia.gov.in/AppOnlineProject/pdf/PCC_Application_Form_Instructions_V2.0.pdf). Processing-time estimates range from about 10 working days to 2-4 weeks and are secondary only. — [ClearTax](https://cleartax.in/s/police-clearance-certificate)
- Germany: if a university is H+ in anabin but the degree is not listed, a ZAB Statement of Comparability is required. — [Make it in Germany](https://www.make-it-in-germany.com/en/visa-recognition/recognition/evaluation-academic-degrees). ZAB fee is about €208 and takes 2-3 months (secondary, unverified). — [study-abroad.org](https://www.study-abroad.org/blog/anabin-zab-credential-recognition/)
- ACS revised its MSA fees from Nov 2025: AUD 625 qualification-only, AUD 1,498 general skills (secondary, unverified). — [ACS fees page](https://acs.org.au/msa/infohub/fees-and-payment.html); [novenai](https://novenai.com/en/post/top-5-acs-australia-skill-assessment-fees-20252026-guide)

### Inferences
- The typical attestation path for non-Apostille Gulf destinations is: university/state verification → MEA attestation → destination embassy in India → destination MOFA. This is general knowledge and was not verified this session.

### Gaps
- The MEA apostille page returned 404, so the procedure was not read in full.
- UAE, Qatar, Kuwait and Malaysia embassy-attestation fees and steps were not checked.
- WES, NZQA, UK ENIC, Nuffic and Saudi Council of Engineers fees and requirements were not verified.
- Hong Kong's apostille status was not verified.

## Official advisories and helplines

### Takeaway
MEA's PBSK runs the 24x7 multilingual helpline. Use eMigrate for agent checks and grievances.

### Cited Findings
- PBSK: toll-free 1800 11 3090; overseas +91-11-26885021; WhatsApp +91 74283 21144; helpline@mea.gov.in; X @helplinePBSK; 11 languages. KPSK walk-in centres are in Delhi, Lucknow, Hyderabad, Chennai, Patna and Kochi. — [MEA OE&PGE overview 21-04-2026](https://www.mea.gov.in/images/pdf/01-Overview-of-work-of-Overseas-Employment-21-04-2026.pdf)
- PGE contact is pge@mea.gov.in. — [Careers360 copy of MEA advisory](https://news.careers360.com/dont-fall-prey-fake-employment-offers-ministry-of-external-affairs-job-seekers-abroad)

### Inferences
- Show the PBSK numbers on every job card that scores low or triggers an India-relevant scam signal.

### Gaps
- MADAD (madad.gov.in) and the 1930 / cybercrime.gov.in helpline are in the file but were not re-verified this session.

## Tax residency when leaving India (short)

### Takeaway
An Indian citizen leaving for employment abroad is resident only if in India for 182 days or more in the financial year. Otherwise they are an NRI, taxed only on India-sourced income. The Rs 15 lakh / 120-day deemed-resident and RNOR rules apply to people with large Indian income.

### Cited Findings
- 182-day rule for citizens leaving for employment abroad. — [Income Tax Dept chart](https://incometaxindia.gov.in/Charts%20%20Tables/Residence-in-India-for-the-purpose-of-Income-Tax-Act.htm) (snippet)
- RNOR / deemed residence when Indian income is above Rs 15 lakh: the 120-day test plus 365 days in the preceding 4 years. — [PwC Tax Summaries](https://taxsummaries.pwc.com/india/individual/residence); [ClearTax](https://cleartax.in/s/nri-status-and-taxation)

### Inferences
- In the year of departure the person is often still resident if they have already spent 182 days or more in India. The app should show this as informational only, not tax advice.

### Gaps
- Sources disagree on whether the 120-day limb applies to people leaving for employment.
- The impact of the Income-tax Act, 2025 (renumbering or changes from tax year 2026-27) was not verified.
