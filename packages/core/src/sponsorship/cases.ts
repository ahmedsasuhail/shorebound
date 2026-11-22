import type { RelocationStatus, SponsorshipStatus } from "../job.js";

/**
 * Test table for the sponsorship/relocation classifier. Written BEFORE the classifier.
 * Review each row: is `sponsorship` / `relocation` what a careful human would conclude?
 *
 * sponsorship: "confirmed_text" = explicit positive, no negation
 *              "negative"       = explicitly ruled out
 *              "unknown"        = text says nothing reliable either way
 * relocation:  "offered"   = employer provides/pays
 *              "mentioned" = vague, conditional or optional
 *              "none"      = absent or explicitly not provided
 */
export interface Case {
  text: string;
  country?: string;
  sponsorship: Extract<SponsorshipStatus, "confirmed_text" | "negative" | "unknown">;
  relocation: RelocationStatus;
  why: string;
}

export const cases: Case[] = [
  // ── Clear positives (English) ──────────────────────────────────────────────
  { text: "We offer visa sponsorship and a relocation package for the right candidate.", sponsorship: "confirmed_text", relocation: "offered", why: "both explicit" },
  { text: "Visa sponsorship is available for this role.", sponsorship: "confirmed_text", relocation: "none", why: "explicit, no relocation" },
  { text: "We will sponsor your work visa and cover relocation costs.", sponsorship: "confirmed_text", relocation: "offered", why: "'will sponsor' + covers costs" },
  { text: "Sponsorship provided. Relocation assistance included.", sponsorship: "confirmed_text", relocation: "offered", why: "terse form" },
  { text: "We are a licensed sponsor and can support Skilled Worker visa applications.", country: "GB", sponsorship: "confirmed_text", relocation: "none", why: "licensed sponsor statement" },
  { text: "Visa support and flights + 2 weeks temporary housing provided for international hires.", sponsorship: "confirmed_text", relocation: "offered", why: "'visa support' + concrete relocation" },
  { text: "H-1B transfers and new H-1B sponsorship supported.", country: "US", sponsorship: "confirmed_text", relocation: "none", why: "route named" },
  { text: "Employment visa will be provided by the company, along with an annual air ticket.", country: "AE", sponsorship: "confirmed_text", relocation: "mentioned", why: "Gulf style; annual air ticket is a perk, not relocation" },

  // ── Clear negatives ────────────────────────────────────────────────────────
  { text: "We cannot provide visa sponsorship for this position.", sponsorship: "negative", relocation: "none", why: "the prototype bug: it matched 'visa sponsorship'" },
  { text: "Unfortunately we are unable to offer sponsorship.", sponsorship: "negative", relocation: "none", why: "negation via 'unable'" },
  { text: "No visa sponsorship available.", sponsorship: "negative", relocation: "none", why: "'no' directly before" },
  { text: "This role does not offer visa sponsorship or relocation.", sponsorship: "negative", relocation: "none", why: "negation covers both" },
  { text: "Candidates must already have the right to work in the UK.", country: "GB", sponsorship: "negative", relocation: "none", why: "right-to-work required = no sponsorship" },
  { text: "You must be authorized to work in the United States without sponsorship now or in the future.", country: "US", sponsorship: "negative", relocation: "none", why: "classic US phrasing" },
  { text: "Applicants requiring sponsorship will not be considered.", sponsorship: "negative", relocation: "none", why: "indirect" },
  { text: "UAE nationals only. Candidates must be in the country.", country: "AE", sponsorship: "negative", relocation: "none", why: "country-specific negative phrase" },
  { text: "EU citizens or existing work permit holders only.", sponsorship: "negative", relocation: "none", why: "restricts to existing right to work" },

  // ── Tricky: negation placement and scope ───────────────────────────────────
  { text: "We do not require candidates to be local - visa sponsorship is available.", sponsorship: "confirmed_text", relocation: "none", why: "negation applies to 'local', not sponsorship" },
  { text: "There is no need to worry about visas: we sponsor all international hires.", sponsorship: "confirmed_text", relocation: "none", why: "'no need' is not a sponsorship negative" },
  { text: "We previously could not sponsor visas, but now we can.", sponsorship: "confirmed_text", relocation: "none", why: "later clause wins" },
  { text: "Visa sponsorship is not guaranteed.", sponsorship: "unknown", relocation: "none", why: "hedged; neither a yes nor a no" },
  { text: "Visa sponsorship may be considered for exceptional candidates.", sponsorship: "unknown", relocation: "none", why: "conditional / discretionary" },
  { text: "Sponsorship available for senior hires only.", sponsorship: "confirmed_text", relocation: "none", why: "restricted but still a yes; seniority fit is the match score's job" },
  { text: "We sponsor visas for roles in the US but not for this location.", country: "CA", sponsorship: "negative", relocation: "none", why: "explicitly excludes this location" },

  // ── Silent / irrelevant (must NOT be classified positive) ──────────────────
  { text: "Senior Node.js engineer. Great benefits, flexible hours, 28 days leave.", sponsorship: "unknown", relocation: "none", why: "nothing about visas" },
  { text: "Sponsor of the annual hackathon and local coding meetups.", sponsorship: "unknown", relocation: "none", why: "'sponsor' unrelated to visas" },
  { text: "Our team sponsors a Kubernetes conference every year.", sponsorship: "unknown", relocation: "none", why: "same" },
  { text: "Experience with Visa payment APIs required.", sponsorship: "unknown", relocation: "none", why: "'Visa' the card network" },
  { text: "Join our Blue Card payments platform team.", country: "DE", sponsorship: "unknown", relocation: "none", why: "'Blue Card' is in the DE phrase list but is weak alone" },

  // ── Relocation only ────────────────────────────────────────────────────────
  { text: "Relocation support is offered to candidates moving from abroad.", sponsorship: "unknown", relocation: "offered", why: "relocation without a visa statement" },
  { text: "Relocation bonus of 5,000 EUR and 30 days of accommodation.", country: "DE", sponsorship: "unknown", relocation: "offered", why: "concrete" },
  { text: "Relocation may be possible depending on circumstances.", sponsorship: "unknown", relocation: "mentioned", why: "vague" },
  { text: "Relocation is not provided.", sponsorship: "unknown", relocation: "none", why: "negated relocation" },
  { text: "Remote role; relocation to our Berlin hub possible but optional.", country: "DE", sponsorship: "unknown", relocation: "mentioned", why: "optional" },

  // ── Local language ─────────────────────────────────────────────────────────
  { text: "Wir bieten Visa-Unterstützung und einen Umzugszuschuss.", country: "DE", sponsorship: "confirmed_text", relocation: "offered", why: "German positive" },
  { text: "Visasponsoring möglich.", country: "DE", sponsorship: "confirmed_text", relocation: "none", why: "German short" },
  { text: "Gültige Arbeitserlaubnis für Deutschland erforderlich.", country: "DE", sponsorship: "negative", relocation: "none", why: "German negative" },
  { text: "Kein Visa-Sponsoring.", country: "DE", sponsorship: "negative", relocation: "none", why: "German negative, short" },
  { text: "التأشيرة والسكن وتذكرة الطيران مقدمة من الشركة", country: "SA", sponsorship: "confirmed_text", relocation: "offered", why: "Arabic: visa, housing and air ticket provided by the company" },

  // ── Presence / residency requirements (employer expects you to already be there) ──
  { text: "Only candidates currently residing in Singapore will be considered.", country: "SG", sponsorship: "negative", relocation: "none", why: "must already live there" },
  { text: "Local candidates only.", sponsorship: "negative", relocation: "none", why: "local only" },
  { text: "Must currently be based in Dubai.", country: "AE", sponsorship: "negative", relocation: "none", why: "presence required" },
  { text: "Candidates must have their own visa; visit visa holders welcome.", country: "AE", sponsorship: "negative", relocation: "none", why: "Gulf: 'own visa' = no sponsorship" },
  { text: "Must be eligible to work in Canada.", country: "CA", sponsorship: "negative", relocation: "none", why: "eligibility required up front" },
  { text: "Must be willing to relocate to Berlin.", country: "DE", sponsorship: "unknown", relocation: "mentioned", why: "asks you to move, says nothing about paying for it" },
  { text: "We handle the Employment Pass application for international hires.", country: "SG", sponsorship: "confirmed_text", relocation: "none", why: "employer handles the pass" },
  { text: "Accommodation provided for the first month.", sponsorship: "unknown", relocation: "offered", why: "employer-provided housing" },

  // ── Real-world messy formats ───────────────────────────────────────────────
  { text: "Benefits: Health insurance | Visa sponsorship | Learning budget", sponsorship: "confirmed_text", relocation: "none", why: "benefits list" },
  { text: "VISA SPONSORSHIP: YES | RELOCATION: YES", sponsorship: "confirmed_text", relocation: "offered", why: "structured form, all caps" },
  { text: "Visa sponsorship: No. Relocation: No.", sponsorship: "negative", relocation: "none", why: "structured form negative" },
  { text: "Location: Singapore. Employment Pass sponsored by company. Remote candidates welcome.", country: "SG", sponsorship: "confirmed_text", relocation: "none", why: "passive voice 'sponsored by company'" },
  { text: "Visa sponsorship (yes for UK roles, no for US roles)", country: "US", sponsorship: "negative", relocation: "none", why: "country-specific answer: pick the one matching the job's country" },
];
