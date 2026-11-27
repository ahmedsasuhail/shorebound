/**
 * Staffing agencies and recruiters post on behalf of an unnamed client. For a visa move that matters: the sponsor is
 * the client (or the agency as employer of record on a contract), so the posting's sponsorship claim cannot be
 * checked against the employer, and register matches name the wrong company. Detected from the company name and
 * from phrases agencies use; returns the evidence so the UI can explain the decision.
 */

/** Well-known staffing / recruitment firms (normalized, word-bounded match on the company name). */
const KNOWN_AGENCIES = [
  "randstad",
  "adecco",
  "hays",
  "michael page",
  "page personnel",
  "robert walters",
  "robert half",
  "manpower",
  "manpowergroup",
  "kelly services",
  "harvey nash",
  "morgan mckinley",
  "kforce",
  "teksystems",
  "allegis",
  "aerotek",
  "modis",
  "akkodis",
  "experis",
  "gi group",
  "persolkelly",
  "persol",
  "recruit express",
  "jobstreet",
  "jac recruitment",
  "nityo",
  "trust recruit",
  "scientec",
  "achieve group",
  "talentvis",
  "frank recruitment",
  "nigel frank",
  "jefferson frank",
  "mason frank",
  "tenth revolution",
  "computer futures",
  "sthree",
  "progressive recruitment",
  "huxley",
  "real staffing",
  "spectrum it",
  "reed",
  "venturi",
  "oho group",
];

/** Company-name words that mark a recruitment business ("Acme Talent Pte Ltd", "XYZ Staffing"). */
const AGENCY_NAME =
  /\b(?:recruit(?:ment|ers?|ing)?|staffing|headhunt(?:ers?|ing)|talent (?:solutions|partners|acquisition|search)|executive search|personnel|manpower|resourcing)\b/i;

/** Phrases agencies use in postings. One strong phrase is enough. */
const AGENCY_TEXT: [RegExp, string][] = [
  [/\b(?:on behalf of|representing) (?:our|a|an) (?:client|customer)\b/i, "posted on behalf of a client"],
  [/\bour client(?:,| is| are| has| a\b| an\b| based| in\b| who| which)/i, 'describes the employer as "our client"'],
  [
    /\b(?:ea|e\.a\.) ?(?:licen[cs]e|lic|no|reg(?:istration)?)\.?\s*(?:no\.?|number|#)?\s*:?\s*\d{2}[a-z]\d{4,}/i,
    "quotes a Singapore employment-agency licence",
  ],
  [/\b(?:ea personnel|registration) (?:no|number)\.?\s*:?\s*r\d{6,}/i, "quotes a recruiter registration number"],
  [/\bacting as an? (?:employment|recruitment) (?:agency|business)\b/i, "states it is acting as a recruitment agency"],
];

export interface AgencyResult {
  agency: boolean;
  evidence?: string;
}

const norm = (s: string) =>
  ` ${s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

export function detectAgency(company: string, description: string): AgencyResult {
  const name = norm(company);
  const known = KNOWN_AGENCIES.find((a) => name.includes(` ${a} `));
  if (known) return { agency: true, evidence: `${company.trim()} is a staffing / recruitment firm.` };
  if (AGENCY_NAME.test(company))
    return { agency: true, evidence: `${company.trim()} looks like a recruitment business (company name).` };
  for (const [re, why] of AGENCY_TEXT)
    if (re.test(description)) return { agency: true, evidence: `The posting ${why}.` };
  return { agency: false };
}
