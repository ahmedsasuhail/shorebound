import type { RelocationStatus } from "../job.js";

/**
 * Rule-based sponsorship & relocation classifier (PLAN.md §5.1–5.2).
 *
 * Text is split into clauses. Each clause gets a verdict per dimension
 * (negative rules first, then hedges, then positives). The LAST definite verdict wins,
 * so "we could not sponsor before, but now we can" ends positive.
 * Every result carries the clause that decided it, so the UI can show evidence.
 *
 * Deliberately not using the raw `sponsorship_phrases` lists from data/countries yet:
 * they contain weak cues ("Blue Card", "air ticket") that cause false positives.
 */

export type TextSponsorship = "confirmed_text" | "negative" | "unknown";

export interface Classification {
  sponsorship: TextSponsorship;
  sponsorshipEvidence?: string;
  relocation: RelocationStatus;
  relocationEvidence?: string;
}

type Verdict = "pos" | "neg" | "hedge" | "mention" | null;

const any = (res: RegExp[], s: string) => res.some((re) => re.test(s));

// ── Sponsorship rules ────────────────────────────────────────────────────────

const NEGATION = String.raw`(?:no|not|never|cannot|can't|couldn't|won't|don't|doesn't|didn't|unable|without)`;
const VISA_TERM = String.raw`(?:visas?|work[- ]?permits?|employment pass|employment visa|h-?1b|skilled worker|immigration|international hires|iqama|residence permit)`;

const SPONSOR_NEG: RegExp[] = [
  new RegExp(String.raw`\b${NEGATION}\b(?:\W+\w+){0,5}?\W+(?:visa\s+)?sponsor`, "i"),
  /\bsponsor\w*\s+(?:is\s+|are\s+|will\s+)?(?:not|no longer)\s+(?:be\s+)?(?:available|provided|offered|possible|supported)/i,
  /\b(?:requir|need)\w*\s+(?:visa\s+)?sponsorship\b[^.]{0,40}\b(?:not|cannot|ineligible|unable)\b/i,
  /\b(?:must|should|need to|required to)\s+(?:\w+\s+){0,3}(?:have|hold|possess)\s+(?:\w+\s+){0,3}right to work\b/i,
  /\bright to work\b[^.]{0,30}\b(?:required|essential|is a must)\b/i,
  /\b(?:must|should)\s+be\s+(?:legally\s+)?(?:authori[sz]ed|eligible)\s+to\s+work\b/i,
  /\b(?:citizens?|nationals?|permanent residents?|pr holders?|(?:work\s+)?permit holders?)\b[^.]{0,40}\bonly\b/i,
  /\b(?:must|should)\s+(?:currently\s+|already\s+)?(?:be\s+)?(?:currently\s+)?(?:based|located|residing|living|reside)\s+in\b/i,
  /\bonly\s+(?:candidates|applicants)\s+(?:currently\s+|already\s+)?(?:based|located|residing|living)\s+in\b/i,
  /\bmust be in the country\b/i,
  /\b(?:local|in-country|onshore)\s+(?:candidates|applicants|hires)\s+only\b/i,
  /\bown visa\b/i,
  /\bnot\s+(?:for|in)\s+this\s+(?:location|role|position|country|office)\b/i,
  // German
  /\bkein(?:e|en)?\s+(?:visa[- ]?\w*|sponsoring)/i,
  /arbeitserlaubnis[^.]{0,40}erforderlich/i,
  /gültige arbeitserlaubnis/i,
  // Arabic: "without / no" near visa or sponsorship
  /(?:بدون|لا)\s+.{0,10}(?:تأشير|كفالة)/,
];

const SPONSOR_HEDGE: RegExp[] = [
  /\bnot guaranteed\b/i,
  /\b(?:may|might)\b/i,
  /\bcase[- ]by[- ]case\b/i,
  /\b(?:considered|negotiable|depending|subject to)\b/i,
];

const SPONSOR_POS: RegExp[] = [
  /\b(?:visa|work[- ]?permit|immigration)\s+(?:sponsorship|support|assistance)\b/i,
  /\blicensed sponsor\b/i,
  new RegExp(String.raw`\bsponsor(?:s|ed|ing)?\b[^.]{0,40}\b${VISA_TERM}`, "i"),
  new RegExp(String.raw`\b${VISA_TERM}\b[^.]{0,40}\b(?:sponsored|provided|arranged|handled|covered|supported|processed)\b`, "i"),
  new RegExp(String.raw`\b(?:handle|arrange|process|take care of)\w*\s+(?:\w+\s+){0,2}${VISA_TERM}`, "i"),
  /(?<!event |conference |meetup |hackathon |corporate |brand |sports |marketing )\bsponsorship\b/i,
  // German
  /visa[- ]?(?:unterstützung|sponsoring)|visasponsoring|unterstützung beim visum/i,
];

const ARABIC_VISA = /تأشير/;
const ARABIC_PROVIDED = /(?:مقدم|توفير|يوفر|توفر|على حساب الشركة|كفالة)/;

function sponsorshipVerdict(clause: string): Verdict {
  if (any(SPONSOR_NEG, clause)) return "neg";
  const mentionsSponsorship = any(SPONSOR_POS, clause) || (ARABIC_VISA.test(clause) && ARABIC_PROVIDED.test(clause));
  if (!mentionsSponsorship) return null;
  if (any(SPONSOR_HEDGE, clause)) return "hedge";
  return "pos";
}

// ── Relocation rules ─────────────────────────────────────────────────────────

const RELOC_NEG: RegExp[] = [
  new RegExp(String.raw`\b${NEGATION}\b(?:\W+\w+){0,5}?\W+relocat`, "i"),
  /\brelocation\s+(?:is\s+|will\s+)?not\s+(?:be\s+)?(?:provided|offered|available|covered|supported)/i,
];

const RELOC_HEDGE: RegExp[] = [/\b(?:may|might|possible|possibly|optional|depending|negotiable|case[- ]by[- ]case|subject to)\b/i];

const HOUSING = String.raw`(?:temporary\s+)?(?:housing|accommodation|flights?|air\s*tickets?)`;
const RELOC_POS: RegExp[] = [
  /\brelocation\s+(?:package|assistance|support|bonus|allowance|budget|stipend|help|reimbursement)\b/i,
  /\b(?:cover|pay|reimburse)\w*\s+(?:your\s+|for\s+|all\s+)?relocation\b/i,
  /\brelocation\s+(?:costs?|expenses?)\s+(?:are\s+)?(?:covered|paid|reimbursed)\b/i,
  new RegExp(String.raw`\b${HOUSING}\b[^.]{0,60}\b(?:provided|included|covered|paid|offered)\b`, "i"),
  new RegExp(String.raw`\b(?:provide|offer|cover|include)\w*\s+[^.]{0,30}\b${HOUSING}\b`, "i"),
  new RegExp(String.raw`\b\d+\s+(?:days|weeks|months)\s+(?:of\s+)?${HOUSING}`, "i"),
  // German
  /umzugszuschuss|umzugskosten|umzugshilfe|unterstützung beim umzug/i,
];

const ARABIC_HOUSING = /(?:سكن|تذكرة)/;
const ANNUAL_TICKET = /\b(?:annual|yearly)\s+(?:air\s*)?tickets?\b/gi;

function relocationVerdict(clause: string): Verdict {
  if (any(RELOC_NEG, clause)) return "neg";
  const perk = ANNUAL_TICKET.test(clause);
  const text = clause.replace(ANNUAL_TICKET, " ");
  ANNUAL_TICKET.lastIndex = 0;
  const offered = any(RELOC_POS, text) || (ARABIC_HOUSING.test(text) && ARABIC_PROVIDED.test(text));
  const mentioned = /\brelocat/i.test(text);
  if ((offered || mentioned) && any(RELOC_HEDGE, text)) return "hedge";
  if (offered) return "pos";
  if (mentioned || perk) return "mention";
  return null;
}

// ── Structured & country-specific forms (checked on the whole text) ─────────

const COUNTRY_ALIASES: Record<string, string> = {
  uk: "GB", "united kingdom": "GB", britain: "GB", us: "US", usa: "US", "united states": "US",
  canada: "CA", ireland: "IE", germany: "DE", uae: "AE", dubai: "AE", "saudi arabia": "SA", saudi: "SA",
  qatar: "QA", singapore: "SG", malaysia: "MY", thailand: "TH",
};

function structured(text: string, label: RegExp): "yes" | "no" | null {
  const m = new RegExp(String.raw`(?:${label.source})\s*:\s*(yes|no)\b`, "i").exec(text);
  return m ? (m[1]!.toLowerCase() as "yes" | "no") : null;
}

function perCountryAnswer(text: string, country?: string): { answer: "yes" | "no"; evidence: string } | null {
  if (!country) return null;
  const re = /\b(yes|no)\s+for\s+(?:the\s+)?([a-z][a-z ]*?)\s+(?:roles|positions|jobs|candidates|applicants)\b/gi;
  for (const m of text.matchAll(re)) {
    if (COUNTRY_ALIASES[m[2]!.toLowerCase().trim()] === country.toUpperCase()) {
      return { answer: m[1]!.toLowerCase() as "yes" | "no", evidence: m[0] };
    }
  }
  return null;
}

// ── Clause splitting & combination ───────────────────────────────────────────

const normalize = (s: string) => s.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

function clauses(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+|\s*[|•;]\s*|\s+[-–—]\s+|:\s+|,?\s+but\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);
}

/** "…could not sponsor visas, but now we can." — a bare affirmation reverses the previous negative. */
const BARE_AFFIRMATION = /^(?:and\s+)?(?:now\s+)?(?:we|they|the company)\s+(?:now\s+)?(?:can|do|will|does)(?:\s+now)?[.!]?$/i;

function decide(list: string[], verdictFn: (c: string) => Verdict) {
  let definite: { v: "pos" | "neg"; clause: string } | null = null;
  let soft: string | undefined;
  let prev: Verdict = null;
  for (const clause of list) {
    let v = verdictFn(clause);
    if (v === null && prev === "neg" && BARE_AFFIRMATION.test(clause)) v = "pos";
    if (v === "pos" || v === "neg") definite = { v, clause };
    else if ((v === "hedge" || v === "mention") && soft === undefined) soft = clause;
    if (v !== null) prev = v;
  }
  return { definite, soft };
}

export function classify(rawText: string, opts: { country?: string } = {}): Classification {
  const text = normalize(rawText);
  const list = clauses(text);
  const result: Classification = { sponsorship: "unknown", relocation: "none" };

  // Sponsorship
  const perCountry = perCountryAnswer(text, opts.country);
  const structS = structured(text, /visa sponsorship|sponsorship/);
  if (perCountry) {
    result.sponsorship = perCountry.answer === "yes" ? "confirmed_text" : "negative";
    result.sponsorshipEvidence = perCountry.evidence;
  } else if (structS) {
    result.sponsorship = structS === "yes" ? "confirmed_text" : "negative";
    result.sponsorshipEvidence = text;
  } else {
    const { definite } = decide(list, sponsorshipVerdict);
    if (definite) {
      result.sponsorship = definite.v === "pos" ? "confirmed_text" : "negative";
      result.sponsorshipEvidence = definite.clause;
    }
  }

  // Relocation
  const structR = structured(text, /relocation/);
  if (structR) {
    result.relocation = structR === "yes" ? "offered" : "none";
    result.relocationEvidence = text;
  } else {
    const { definite, soft } = decide(list, relocationVerdict);
    if (definite) {
      result.relocation = definite.v === "pos" ? "offered" : "none";
      result.relocationEvidence = definite.clause;
    } else if (soft) {
      result.relocation = "mentioned";
      result.relocationEvidence = soft;
    }
  }

  return result;
}
