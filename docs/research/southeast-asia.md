# Shorebound: Southeast Asia country research (scope reduced to Singapore)

Scope note: the coordinator reduced scope mid-task to Singapore only. Malaysia, Thailand, Vietnam, Indonesia and the Philippines were partly researched but no files were written for them. The region-wide cyber-scam findings are included because they target Indians applying anywhere in the region.

## Which work-visa routes realistically apply to a senior SWE from India (Singapore)?

### Takeaway
The Employment Pass is the realistic route. The candidate must meet an age-graded qualifying salary and then score 40 COMPASS points, or earn at least S$22,500/month fixed to skip COMPASS. Thresholds rise on 1 Jan 2027. ONE Pass and Tech.Pass need at least S$22,500-30,000/month, and Tech.Pass closes on 28 Jan 2027.

### Cited Findings
- EP qualifying salary is S$5,600 (age 23 or below) to S$10,700 (age 45+), with an age-30 example of S$7,223. Financial services: S$6,200 to S$11,800 — [MOM EP eligibility](https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility)
- From 1 Jan 2027 (new applications; renewals expiring from 1 Jan 2028) it rises to S$6,000 to S$11,500 (age-30 example S$7,750). Financial services: S$6,600 to S$12,700 — [MOM EP eligibility](https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility); [MOM factsheet 3 Mar 2026](https://www.mom.gov.sg/-/media/mom/documents/press-releases/2026/factsheet-on-foreign-workforce-policies-03032026.pdf)
- COMPASS requires 40 points. The criteria are C1 salary (20/10/0 vs 90th/65th percentile), C2 qualifications (20 top-tier / 10 other degree-equivalent / 0), C3 nationality diversity, C4 local employment, C5 Shortage Occupation List bonus and C6 strategic priorities bonus. Exempt: fixed salary of at least S$22,500, intra-corporate transferees, or roles of 1 month or less — [MOM EP eligibility](https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility)
- Online EP applications are processed within 10 business days (6 weeks for overseas sponsors). Fees are S$105 application and S$225 issuance. The job must first be advertised on MyCareersFuture — [MOM apply page](https://www.mom.gov.sg/passes-and-permits/employment-pass/apply-for-a-pass)
- ONE Pass requires S$30,000/month fixed salary. An AI and Tech track opens 28 Jan 2027: at least S$22,500 fixed plus vested non-cash components. Renewal is for 5 years each time — [MOM ONE Pass](https://www.mom.gov.sg/passes-and-permits/overseas-networks-expertise-pass/eligibility)
- Tech.Pass requires S$22,500 last-drawn salary and 5 years in a leading role. No new or renewal applications are accepted from 28 Jan 2027 — [EDB Tech.Pass](https://www.edb.gov.sg/en/how-we-help/incentives-and-facilitation/tech-pass) (search snippet)

### Inferences
- A typical senior IC applies through the EP. The salary needed to score C1 = 20 points is likely far above the Stage 1 floor.

### Gaps
- Whether software roles are on the Shortage Occupation List, the minimum FCF advertising period, EP validity, and PR criteria were not confirmed.

## How is a 3-year Indian bachelor's treated (Singapore)?

### Takeaway
There is no hard degree requirement. A degree-equivalent qualification earns 10 COMPASS points, or 20 points from listed top-tier institutions. Whether a 3-year Indian BCA counts as degree-equivalent is unconfirmed.

### Cited Findings
- MOM benchmarks foreign qualifications against bodies such as UK ENIC. Verification proof is required (background screening company, institution portal or OpenCerts). C2 lists change on 1 Jan 2027 — [MOM C2 list](https://www.mom.gov.sg/maintenance/-/media/mom/documents/work-passes-and-permits/compass/compass-c2-list-of-degree-equivalent-qualifications.pdf); [MOM EP eligibility](https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility)

### Inferences
- A state-university BCA would at best score 10 points. The rest has to come from salary (C1) and the employer's profile (C3/C4). C3 may be weak at large firms with many Indian PMETs.

### Gaps
- There is no explicit MOM statement on 3-year Indian degrees.

## Employer registers (Singapore)

### Takeaway
There is no positive sponsor register. The FCF watchlist was discontinued in 2023, and no firm names were found.

### Cited Findings
- Nearly 1,000 firms were watchlisted in 2016-2023 (mostly ICT, professional services and construction). The criteria were folded into COMPASS and the watchlist was discontinued in 2023 — [MOM PQ 24 Feb 2026](https://www.mom.gov.sg/newsroom/parliament-questions-and-replies/2026/0224-written-answer-to-pq-on-fair-consideration-framework-watchlist)

### Inferences
- The app should match companies by the UEN that the MyCareersFuture API returns, and treat an MCF posting as neutral (not proof of sponsorship).

### Gaps
- I found no public list of employers penalised under FCF.

## Job sites (Singapore)

### Takeaway
MyCareersFuture has a working, keyless public JSON API. LinkedIn and JobStreet prohibit crawling in robots.txt, so they should be link-only. NodeFlair, Tech in Asia and foundit block bots.

### Cited Findings
- `GET https://api.mycareersfuture.gov.sg/v2/jobs?search=...&limit=&page=` returns 817 "software engineer" results with salary, UEN, newPostingDate and expiryDate (tested 2026-11-22). robots.txt allows `*` — [MCF API](https://api.mycareersfuture.gov.sg/v2/jobs?search=software%20engineer&limit=2&page=0); [robots](https://www.mycareersfuture.gov.sg/robots.txt)
- LinkedIn robots.txt is `Disallow: /` — [robots](https://www.linkedin.com/robots.txt). JobStreet disallows query strings and /api/jobsearch/ — [robots](https://sg.jobstreet.com/robots.txt). NodeFlair allows / but marks ai-train=no — [robots](https://nodeflair.com/robots.txt). Glints publishes job sitemaps — [robots](https://glints.com/robots.txt)

### Inferences
- Glints sitemaps are the cleanest logged-out discovery path after MCF.

### Gaps
- MCF terms of use could not be read. Indeed ToS was not checked.

## Salary, tax, relocation, communities (Singapore)

### Takeaway
Levels.fyi senior SWE total compensation is SGD 136.5K to 233.7K (25th to 75th percentile), with a median of SGD 178K.

### Cited Findings
- Median SGD 178K, 90th percentile SGD 287K, 377 data points, updated 2026-11-22 — [Levels.fyi](https://www.levels.fyi/t/software-engineer/levels/senior/locations/singapore)

### Inferences
- Levels.fyi skews toward big tech, so local SME pay is likely lower.

### Gaps
- Tax brackets (IRAS), relocation norms and NodeFlair salary data (blocked with 403) were not researched.

## Scam warnings (region-wide)

### Takeaway
Indian missions repeatedly warn that fake Thailand/SE-Asia "IT/data entry" jobs lead to trafficking into scam compounds in Myanmar (Myawaddy), Laos (Golden Triangle SEZ) and Cambodia.

### Cited Findings
- Bangkok embassy advisory, 19 Sep 2024: victims are lured by "dubious/non-existent firms in Thailand", recruitment runs through social media and agents, and visa-free entry does not permit employment — [Embassy of India Bangkok](https://embassyofindiabangkok.gov.in/public/assets/pdf/advisory_sep20_bangkok.pdf)
- Yangon embassy, Jul 2024: the Hpa Lu area south of Myawaddy is flagged — [Embassy of India Yangon](https://embassyofindiayangon.gov.in/public_files/assets/pdf/yangon_3july2024_popup.pdf)
- 549 Indians were repatriated via Mae Sot on 10-11 Mar 2025 — [Tribune](https://www.tribuneindia.com/news/world/india-secures-repatriation-of-283-indians-from-myanmar-thailand-lured-on-pretext-of-fake-jobs)
- May 2024 Cambodia/Laos advisory: lure roles are "Digital Sales and Marketing Executives" and "Customer Support Service"; use only MEA-authorised agents — [AIR](https://www.newsonair.gov.in/government-issues-advisory-to-nationals-travelling-to-cambodia-for-jobs-to-be-wary-of-fake-agents)
- Just over 1,000 Indians have been rescued in Cambodia since 2022 — [Phnom Penh Post](https://phnompenhpost.com/post-in-depth/india-implements-airport-warnings-to-caution-citizens-about-job-scams-)

### Inferences
- Detectable flags: border or Golden Triangle locations, tourist-visa entry, chat-only recruiting, upfront fees, and no verifiable registry ID.

### Gaps
- I did not find the mea.gov.in advisory text itself or a 2025-26 MEA advisory.

## Sponsorship phrases and ease score (Singapore)

### Takeaway
English phrases suffice. Negatives include "Singaporeans/PRs only" and "SC/PR only". Ease is 4/5: fast and transparent, but COMPASS is a hurdle for 3-year degrees and nationality concentration.

### Cited Findings
- Ease rests on the MOM processing time and COMPASS rules cited above — [MOM](https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility)

### Inferences
- The phrases are standard job-ad usage, not taken from a source.

### Gaps
- None beyond those above.

## Malaysia: visa routes, degree rule, register, job sites, salary, ease

### Takeaway
The Employment Pass is the route. From 1 Jun 2026 salary floors roughly doubled: Cat I RM20,000+, Cat II RM10,000-19,999, Cat III RM5,000-9,999 basic salary. Cat II/III need a succession plan. A degree plus 3 years of related experience suffices, so a 3-year BCA with 7+ years should qualify. Ease 3/5.

### Cited Findings
- Category thresholds and tenure caps (10/10/5 years) apply to new and renewal applications from 1 Jun 2026 — [MIDA](https://www.mida.gov.my/media-release/announcement-implementation-of-new-expatriate-employment-policy/)
- Term posts: Certificate/Diploma/Degree with 7/5/3 years related experience. MyFutureJobs advert required unless basic salary is at least RM15,000 (plus other exemptions). JTK Section 60K approval required — [MIDA EP guideline 1 Jun 2026](https://www.mida.gov.my/wp-content/uploads/2026/06/Guidelines-EP_1-June-2026_latest-1.pdf)
- Salary concession only for MDEC-regulated companies; succession plan postponed for GBS to 1 Jun 2027 — [EY](https://taxnews.ey.com/news/2026-1256) (search snippet). One EY alert instead says succession plans apply from 1 Jan 2027 (conflict).
- DE Rantau: USD 24,000/yr for tech talent; 3-12 months, up to 24 months total — [MDEC FAQ v10](https://www.mdec.my/api/media/file/DE-Rantau_Pass_FAQ_v10.pdf) (search snippet)
- Senior SWE total compensation MYR 116.7K-201.7K (P25-P75), median MYR 162K, n=39 — [Levels.fyi](https://www.levels.fyi/t/software-engineer/levels/senior/locations/malaysia)
- JobStreet MY robots.txt disallows */job/ and query strings — [robots](https://my.jobstreet.com/robots.txt)

### Inferences
- High-salary (RM15,000+) EP roles may not appear on MYFutureJobs because of the advert exemption.

### Gaps
- EP processing time (sources conflict), whether ESD/MDEC apply the same degree rule as MIDA, RP-T criteria, fees, and MYFutureJobs access (unreachable from the research environment).

## Thailand: visa routes, register, job sites, salary, scams, ease

### Takeaway
The realistic route is a Non-B visa plus work permit at a BOI-promoted or large tech employer. SMART-T needs THB 100K/month in a targeted industry. LTR-HSP needs USD 80K/yr (or USD 40K plus a master's). Thailand is the main transit point for scam-compound trafficking of Indians. Ease 3/5, confidence low.

### Cited Findings
- Non-BOI employers need about THB 2M paid-up capital and 4 Thai staff per work permit; BOI firms are reportedly exempt — [ThaiLawOnline](https://www.thailawonline.com/glossary/four-to-one-ratio/); [ASEAN Briefing](https://www.aseanbriefing.com/news/hiring-foreign-employees-in-thailand-work-permit-rules/) (search snippets)
- Nationality-tiered income test for extensions (Order 327/2557); India tier unconfirmed (Expatica says THB 35,000) — [Expatica](https://expatica.com/th/work/law/thailand-minimum-wage-2172841)
- SMART T: THB 100,000/month (THB 50,000 for startups) — [BOI SMART T](https://smart-visa.boi.go.th/smart/pages/smart_t.html); [Bangkok Post](https://www.bangkokpost.com/business/2077587) (search snippets)
- LTR-HSP: USD 80K average over 2 years, or USD 40K plus a master's in science/technology; experience requirement removed in 2025 — [BOI LTR brochure 2025](https://ltr.boi.go.th/documents/BOI-brochure 2025-LTR.pdf) (search snippet)
- Senior SWE total compensation THB 1.23M-2.87M (P25-P75), median THB 2.07M, n=106 — [Levels.fyi](https://www.levels.fyi/t/software-engineer/levels/senior/locations/thailand)
- JobThai robots allows all; JobsDB TH disallows */job/ and query strings — [JobThai robots](https://www.jobthai.com/robots.txt); [JobsDB robots](https://th.jobsdb.com/robots.txt)
- Scam advisories (Bangkok embassy 19 Sep 2024; MEA 2022 Myawaddy; Yangon Jul 2024 Hpa Lu; Mae Sot repatriation Mar 2025; Laos/Cambodia May 2024) are cited in the scam section above.

### Inferences
- The typical senior median (about USD 60K, not computed from an official rate) is below LTR's USD 80K bar. The LTR route is therefore unrealistic for most candidates.

### Gaps
- Indian-national salary floor, degree rule for the work permit, processing times, fees, PR route, and the official SMART eligibility page (404).
