import type { SponsorshipStatus } from "../job.js";

/**
 * Confidence meter (PLAN.md, "Confidence"; model from data/trust/signals.json `confidence_model`).
 * score = weighted mean over factors that HAVE data, × 100, then scam penalties; clamped 0..100.
 * Hard scam flags cap at 10; explicit "no sponsorship" caps at 5. `coverage` = share of weight with data.
 */

export interface ScamFlag {
  id: string;
  label: string;
  weight: number;
  hard: boolean;
}

const SCAMS: { id: string; label: string; weight: number; hard: boolean; re: RegExp }[] = [
  {
    id: "fee_demanded",
    label: "Asks you to pay a fee",
    weight: -60,
    hard: true,
    re: /\b(?:registration|processing|visa|placement|training|security|refundable|application)\s+(?:fee|deposit|charges?)\b[^.]{0,40}\b(?:pay|paid|payable|required|deposit|transfer|inr|rs\.?|usd|\$|₹)/i,
  },
  {
    id: "visa_for_fee",
    label: "Sells a visa or 'guaranteed' visa",
    weight: -50,
    hard: true,
    re: /\b(?:guaranteed visa|visa guarantee|100\s*%\s*visa|visa for sale)\b|\b(?:work permit|sponsorship)\b[^.]{0,30}\b(?:fee|cost)s?\b[^.]{0,20}\b(?:candidate|you|applicant)\b/i,
  },
  {
    id: "tourist_visa_convert",
    label: "Come on a tourist/visit visa and 'convert'",
    weight: -50,
    hard: true,
    re: /\b(?:tourist|visit|visitor)\s+visa\b[^.]{0,60}\b(?:convert|change|then|later|work permit)\b/i,
  },
  {
    id: "check_or_reshipping",
    label: "Cheque deposit or reshipping requests",
    weight: -40,
    hard: true,
    re: /\b(?:deposit|cash)\b[^.]{0,30}\bche(?:ck|que)\b|\breship\w*|\breceive packages\b|\bpurchase equipment from our vendor\b/i,
  },
  {
    id: "se_asia_lure",
    label: "Matches SE-Asia scam-compound lure pattern",
    weight: -45,
    hard: true,
    re: /\b(?:mae sot|myawaddy|shwe kokko|golden triangle|sihanoukville|poipet|bavet|kk park)\b/i,
  },
  {
    id: "messaging_only_contact",
    label: "Contact only via WhatsApp/Telegram",
    weight: -25,
    hard: false,
    re: /\bwa\.me\/|\bt\.me\/|\b(?:whatsapp|telegram)\b[^.]{0,30}\b(?:cv|resume|apply|contact|send)\b|\b(?:send|share)\b[^.]{0,20}\b(?:cv|resume)\b[^.]{0,20}\b(?:whatsapp|telegram)\b/i,
  },
  {
    id: "personal_email_domain",
    label: "Recruiter uses a personal email address",
    weight: -20,
    hard: false,
    re: /\b[\w.+-]+@(?:gmail|yahoo|hotmail|outlook|live|rediffmail|rediff|aol|proton(?:mail)?|icloud|ymail)\.[a-z.]{2,6}\b/i,
  },
  {
    id: "no_interview_instant_offer",
    label: "Instant offer without interview",
    weight: -15,
    hard: false,
    re: /\b(?:you have been selected|no interview|without interview|direct joining|offer letter within \d+\s*(?:hours|hrs|days))\b/i,
  },
  {
    id: "early_sensitive_data_request",
    label: "Asks for passport/ID/bank details up front",
    weight: -15,
    hard: false,
    re: /\b(?:send|share|upload|submit)\b[^.]{0,40}\b(?:passport|aadhaar|aadhar|pan card|bank (?:details|account)|otp)\b/i,
  },
  {
    id: "urgent_pressure",
    label: "Pressure language",
    weight: -5,
    hard: false,
    re: /\b(?:urgent(?:ly)? hiring|immediate joining|apply (?:now|today) or|limited seats|hurry)\b/i,
  },
];

export function detectScams(text: string): ScamFlag[] {
  return SCAMS.filter((s) => s.re.test(text)).map(({ id, label, weight, hard }) => ({ id, label, weight, hard }));
}

export interface ConfidenceInput {
  sponsorship: SponsorshipStatus;
  /** 1–5 from data/countries/<cc>.json, or null if unknown. */
  ease: number | null;
  postedAt: Date;
  now: Date;
  descriptionLength: number;
  hasCompany: boolean;
  text: string;
  /** Not available yet (no free data source wired): left null → reduces coverage, never guessed. */
  companyReputation?: number | null;
  reviews?: number | null;
}

export interface ConfidenceResult {
  score: number;
  band: "low" | "medium" | "high";
  coverage: number;
  factors: { id: string; label: string; weight: number; value: number | null }[];
  flags: ScamFlag[];
}

/**
 * How much each kind of sponsorship evidence is worth. Text in the posting itself ranks highest. A register match
 * is employer-level (the company is licensed/approved to sponsor, the posting may not mention visas), so it is
 * worth less than explicit text.
 */
const SPONSOR_VALUE: Record<SponsorshipStatus, number> = {
  confirmed_text: 0.9,
  confirmed_register: 0.7,
  visa_source: 0.6,
  possible: 0.3,
  unknown: 0.1,
  negative: 0,
};

export function confidenceScore(i: ConfidenceInput): ConfidenceResult {
  const ageDays = (i.now.getTime() - i.postedAt.getTime()) / 86_400_000;
  let quality = ageDays <= 1 ? 1 : ageDays <= 3 ? 0.85 : ageDays <= 7 ? 0.7 : ageDays <= 14 ? 0.5 : 0.3;
  if (i.descriptionLength < 300) quality -= 0.25;
  if (!i.hasCompany) quality -= 0.35;

  const factors = [
    { id: "sponsorship_evidence", label: "Sponsorship evidence", weight: 30, value: SPONSOR_VALUE[i.sponsorship] },
    { id: "company_reputation", label: "Company reputation", weight: 20, value: i.companyReputation ?? null },
    {
      id: "ease_of_move_from_india",
      label: "Ease of moving from India",
      weight: 20,
      value: i.ease === null ? null : (i.ease - 1) / 4,
    },
    { id: "posting_freshness", label: "Posting freshness & quality", weight: 15, value: Math.max(0, quality) },
    { id: "employee_reviews", label: "Employee reviews", weight: 15, value: i.reviews ?? null },
  ];
  const known = factors.filter((f) => f.value !== null);
  const total = factors.reduce((n, f) => n + f.weight, 0);
  const knownWeight = known.reduce((n, f) => n + f.weight, 0);
  const base = knownWeight ? known.reduce((n, f) => n + f.weight * f.value!, 0) / knownWeight : 0;

  const flags = detectScams(i.text);
  let score = Math.round(base * 100) + flags.reduce((n, f) => n + f.weight, 0);
  score = Math.max(0, Math.min(100, score));
  if (flags.some((f) => f.hard)) score = Math.min(score, 10);
  if (i.sponsorship === "negative") score = Math.min(score, 5);

  return {
    score,
    band: score >= 70 ? "high" : score >= 40 ? "medium" : "low",
    coverage: Math.round((knownWeight / total) * 100) / 100,
    factors,
    flags,
  };
}
