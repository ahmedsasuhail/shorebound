import { BACKEND, FRONTEND, findSkills } from "./skills.js";

export type RoleFamily =
  "frontend" | "backend" | "fullstack" | "mobile" | "devops" | "data" | "qa" | "security" | "general";
export type Seniority = "intern" | "junior" | "mid" | "senior" | "lead" | "manager";
export const SENIORITY_RANK: Record<Seniority, number> = {
  intern: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  manager: 5,
};

export interface JobAnalysis {
  isSoftware: boolean;
  family: RoleFamily | null;
  seniority: Seniority;
  minYears: number | null;
  /** All skills found in title + description. */
  skills: string[];
  /** Skills named in the TITLE only (e.g. "Go Backend Developer"): the strongest stack signal. */
  titleSkills: string[];
  /** Platform/CMS specialist roles (WordPress, Salesforce, SAP...): software, but a different career track. */
  offStack: boolean;
}

/** Bump when extractProfile changes, so stored rule-derived profiles are re-read from the resume. */
export const PROFILE_VERSION = 2;

export interface Profile {
  skills: string[];
  yearsExperience: number | null;
  seniority: Seniority;
  families: RoleFamily[];
  title: string | null;
  version?: number;
  /** "rules" = extracted locally; "user" = edited in Settings; "claude" = refined by AI (later). */
  source: "rules" | "user" | "claude";
}

// ── Job side ────────────────────────────────────────────────────────────────

const TECH_WORD = String.raw`software|front[- ]?end|back[- ]?end|full[- ]?stack|web|mobile|ios|android|platform|cloud|devops|dev ops|site reliability|sre|data|ml|machine learning|ai|infrastructure|security|qa|test|automation|embedded|application|integration|api|javascript|typescript|node(?:\.?js)?|react|angular|vue|java|python|golang|go|ruby|php|\.net|c#|c\+\+|rust|scala|kotlin|swift|wordpress|salesforce|solutions`;
const SOFTWARE_TITLE = new RegExp(
  String.raw`\b(?:${TECH_WORD})\b[\w\s/&().,-]{0,30}\b(?:engineer|developer|architect|programmer|lead)\b|\b(?:developer|programmer|swe|sde|sre|d[ée]veloppeu(?:r|se)|ontwikkelaar|(?:software)?entwickler(?:in)?|ing[ée]nieur logiciel)\b|\bsoftware\b|\b(?:engineer|developer)\b[\s\w,/-]{0,25}\b(?:${TECH_WORD})\b`,
  "i",
);
const OFF_STACK_TITLE =
  /\b(?:wordpress|shopify|salesforce|sap|abap|servicenow|dynamics|magento|drupal|wix|webflow|sitecore|netsuite|workday|mainframe|cobol)\b/i;
const NON_SOFTWARE_TITLE =
  /\b(?:solutions? (?:architect|engineer|consultant)|sales engineer|customer engineer|business develop\w*|technical account|(?:technical|it|customer|application) support|support engineer|field engineer|pre-?sales|implementation (?:consultant|engineer|specialist)|quant\w*|researcher|data scientist|recruit\w*|talent acquisition|sales|account (?:executive|manager)|marketing|copywriter|writer|hr\b|human resources|accountant|finance|financial|legal|lawyer|nurse|chef|venture|consultant|customer (?:success|support|service)|designer|mechanical|civil|electrical|chemical|quantitative researcher|trader|analyst)\b/i;

function familyOf(title: string, skills: string[]): RoleFamily | null {
  const t = title.toLowerCase();
  // Specialties first, so "Platform QA Lead" is QA and "Data Platform Engineer" is data.
  if (/full[- ]?stack/.test(t)) return "fullstack";
  if (/\bqa\b|\btest|quality/.test(t)) return "qa";
  if (/security/.test(t)) return "security";
  if (/\bdata\b|machine learning|\bml\b|\bai\b|analytics/.test(t)) return "data";
  if (/\bios\b|android|mobile|react native|flutter/.test(t)) return "mobile";
  if (/devops|site reliability|\bsre\b|infrastructure|\bcloud\b/.test(t)) return "devops";
  if (/front[- ]?end|\bui engineer|\breact\b|\bangular\b|\bvue\b|\bweb developer/.test(t)) return "frontend";
  if (/back[- ]?end|\bapi\b|\bnode|\bjava\b|\bgo(?:lang)?\b|\bpython\b|\bplatform/.test(t)) return "backend";
  const fe = skills.filter((s) => FRONTEND.has(s)).length;
  const be = skills.filter((s) => BACKEND.has(s)).length;
  if (fe >= 2 && be >= 2) return "fullstack";
  return "general";
}

export function seniorityOf(title: string): Seniority {
  const t = title.toLowerCase();
  // English, German, Dutch (stagiair) and French (stage, stagiaire, alternance) internship wording.
  if (
    /\bintern(?:ship)?\b|werkstudent|working student|praktik(?:um|ant)|stagiai?re?\b|\balternan(?:ce|t)\b|^stage\b|\bstage\s*[-–:(]/.test(
      t,
    )
  )
    return "intern";
  if (/graduate|\bgrad\b|new grad|entry[- ]level|junior|\bjr\.?\b|trainee|apprentice|\b20\d\d\b/.test(t))
    return "junior";
  if (/head of|director|\bvp\b|vice president|engineering manager|manager/.test(t)) return "manager";
  if (/\bstaff\b|principal|\blead\b|tech lead|architect/.test(t)) return "lead";
  if (/senior|\bsr\.?\b|\bii{1,2}\b|\blevel [3-5]\b/.test(t)) return "senior";
  return "mid";
}

export function minYearsOf(text: string): number | null {
  const m =
    /\b(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*)?\+?\s*(?:years?|yrs?)\b[^.]{0,40}\b(?:experience|exp\b)/i.exec(
      text,
    ) ?? /\b(?:minimum|at least|min\.?)\s+(?:of\s+)?(\d{1,2})\s*(?:years?|yrs?)/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n <= 25 ? n : null;
}

export function analyzeJob(title: string, description: string): JobAnalysis {
  const skills = findSkills(`${title}\n${description}`);
  const isSoftware =
    SOFTWARE_TITLE.test(title) && !NON_SOFTWARE_TITLE.test(title.replace(/\b(?:data|business|systems) analyst\b/i, ""));
  return {
    isSoftware,
    family: isSoftware ? familyOf(title, skills) : null,
    seniority: seniorityOf(title),
    minYears: minYearsOf(description),
    skills,
    titleSkills: findSkills(title),
    offStack: OFF_STACK_TITLE.test(title),
  };
}

// ── Resume side ─────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function experienceSection(text: string): string {
  const start = /\b(?:professional|work)?\s*experience\b|\bemployment history\b|\bcareer history\b/i.exec(text);
  if (!start) return text;
  const rest = text.slice(start.index + start[0].length);
  // PDF text often loses line breaks, so match capitalised headings rather than requiring "\n".
  const end =
    /(?:^|\n|\s)(?:Education|EDUCATION|Certificat\w*|CERTIFICAT\w*|Skills|SKILLS|Projects|PROJECTS|Awards|AWARDS)\b/.exec(
      rest,
    );
  return end ? rest.slice(0, end.index) : rest;
}

/** Earliest month/year in the experience section → years until `now`. */
function yearsFromDates(section: string, now: Date): number | null {
  const starts: Date[] = [];
  for (const m of section.matchAll(/\b(0?[1-9]|1[0-2])\s*\/\s*((?:19|20)\d{2})\b/g))
    starts.push(new Date(Number(m[2]), Number(m[1]) - 1));
  for (const m of section.matchAll(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+((?:19|20)\d{2})\b/gi,
  )) {
    starts.push(new Date(Number(m[2]), MONTHS[m[1]!.toLowerCase().slice(0, 3)]!));
  }
  const valid = starts.filter((d) => d <= now && d.getFullYear() > 1980);
  if (!valid.length) return null;
  const earliest = Math.min(...valid.map((d) => d.getTime()));
  return Math.round(((now.getTime() - earliest) / (365.25 * 86_400_000)) * 10) / 10;
}

const MMYYYY = String.raw`(0?[1-9]|1[0-2])\s*\/\s*((?:19|20)\d{2})`;
const RANGE = new RegExp(String.raw`${MMYYYY}\s*(?:-|–|—|to)\s*(?:${MMYYYY}|(present|current|now|today))`, "gi");

/**
 * Fallback when dates are not inside an "Experience" section (PDF extraction often moves
 * right-aligned dates to the top). Uses all MM/YYYY ranges; if the text mentions a degree,
 * the earliest range is treated as education when it lasts 2.5–5.5 years.
 */
function yearsFromAllRanges(text: string, now: Date): number | null {
  const ranges: { start: Date; end: Date }[] = [];
  for (const m of text.matchAll(RANGE)) {
    const start = new Date(Number(m[2]), Number(m[1]) - 1);
    const end = m[5] ? now : new Date(Number(m[4]), Number(m[3]) - 1);
    ranges.push({ start, end });
  }
  const covered = new Set(ranges.map((r) => `${r.start.getMonth() + 1}/${r.start.getFullYear()}`));
  for (const m of text.matchAll(new RegExp(MMYYYY, "g"))) {
    const key = `${Number(m[1])}/${m[2]}`;
    const d = new Date(Number(m[2]), Number(m[1]) - 1);
    // A lone start date (e.g. current job "10/2023") counts as running until now.
    if (!covered.has(key) && !ranges.some((r) => r.end.getTime() === d.getTime())) ranges.push({ start: d, end: now });
  }
  const valid = ranges
    .filter((r) => r.start <= now && r.start.getFullYear() > 1980)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (!valid.length) return null;
  const years = (r: { start: Date; end: Date }) => (r.end.getTime() - r.start.getTime()) / (365.25 * 86_400_000);
  if (
    /\b(?:bachelor|master|b\.?\s?tech|b\.?\s?e\b|bca|mca|b\.?sc|m\.?sc|degree|university|college)\b/i.test(text) &&
    valid.length > 1
  ) {
    const first = valid[0]!;
    if (years(first) >= 2.5 && years(first) <= 5.5) valid.shift();
  }
  return Math.round(((now.getTime() - valid[0]!.start.getTime()) / (365.25 * 86_400_000)) * 10) / 10;
}

export function extractProfile(text: string, now = new Date()): Profile {
  const skills = findSkills(text);
  const stated =
    /\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:professional\s+|industry\s+|hands-on\s+)?experience\b/i.exec(
      text,
    );
  const yearsExperience = stated
    ? Number(stated[1])
    : (yearsFromDates(experienceSection(text), now) ?? yearsFromAllRanges(text, now));
  const head = text.split(/\r?\n/).slice(0, 6).join(" ");
  const titleMatch =
    /\b((?:senior|staff|lead|principal|junior)?\s*(?:software|full[- ]?stack|front[- ]?end|back[- ]?end|web|mobile|devops|data|cloud)?\s*(?:engineer|developer|architect))\b/i.exec(
      head,
    );
  const titleSeniority = titleMatch ? seniorityOf(titleMatch[1]!) : "mid";
  const byYears: Seniority =
    yearsExperience === null
      ? "mid"
      : yearsExperience >= 9
        ? "lead"
        : yearsExperience >= 5
          ? "senior"
          : yearsExperience >= 2
            ? "mid"
            : "junior";
  const seniority = SENIORITY_RANK[titleSeniority] > SENIORITY_RANK[byYears] ? titleSeniority : byYears;

  const fe = skills.filter((s) => FRONTEND.has(s)).length;
  const be = skills.filter((s) => BACKEND.has(s)).length;
  // Primary families come from front/back-end skills. Secondary ones need stronger evidence, otherwise
  // a full-stack resume that lists AWS/Docker would also "fit" every infrastructure role.
  const families: RoleFamily[] = [];
  if (fe >= 2 && be >= 2) families.push("fullstack", "frontend", "backend");
  else if (fe >= 2) families.push("frontend");
  else if (be >= 2) families.push("backend");
  if (skills.includes("react native") && /b(?:mobile|ios|android)b/i.test(head)) families.push("mobile");
  if (
    skills.filter((s) => ["aws", "docker", "kubernetes", "terraform", "ci/cd"].includes(s)).length >= 3 &&
    (families.length === 0 || /b(?:devops|sre|site reliability|infrastructure|platform)b/i.test(head))
  )
    families.push("devops");
  if (
    (skills.includes("machine learning") || skills.includes("data engineering")) &&
    /b(?:data|machine learning|ml|ai)b/i.test(head)
  )
    families.push("data");

  return {
    skills,
    yearsExperience,
    seniority,
    families,
    title: titleMatch?.[1]?.trim() ?? null,
    source: "rules",
    version: PROFILE_VERSION,
  };
}
