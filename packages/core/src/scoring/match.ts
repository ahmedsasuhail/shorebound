import { SENIORITY_RANK, type JobAnalysis, type Profile } from "./analyze.js";

export interface MatchResult {
  score: number;
  reasons: string[];
}

const W = { family: 25, skills: 40, seniority: 20, years: 15 } as const;

/**
 * How well a job fits the user's profile (separate from confidence; PLAN.md §5.4).
 * Non-software roles are capped at 5 so they sink out of view.
 */
export function matchScore(p: Profile, a: JobAnalysis): MatchResult {
  if (!a.isSoftware) return { score: 5, reasons: ["Not a software engineering role"] };
  const reasons: string[] = [];

  // Role family
  let fam = 0.8; // generic "Software Engineer" fits most profiles
  if (a.family && a.family !== "general") {
    if (p.families.includes(a.family)) fam = 1;
    else if (p.families.includes("fullstack") && (a.family === "frontend" || a.family === "backend")) fam = 1;
    else if (a.family === "fullstack" && (p.families.includes("frontend") || p.families.includes("backend"))) fam = 0.7;
    else fam = 0.3;
  }
  if (fam >= 1) reasons.push(`Role fits your ${a.family === "general" ? "background" : a.family} experience`);
  else if (fam <= 0.3) reasons.push(`Different specialty (${a.family})`);

  // Skills: share of the job's skills you have; neutral if the job lists none.
  let sk = 0.5;
  if (a.skills.length) {
    const mine = new Set(p.skills);
    const hit = a.skills.filter((s) => mine.has(s));
    // Denominator is at least 3: one matching skill out of one listed is weak evidence, not 100%.
    sk = Math.min(1, hit.length / Math.max(3, Math.min(a.skills.length, 8)));
    if (hit.length) reasons.push(`Skills you have: ${hit.slice(0, 5).join(", ")}`);
    const miss = a.skills.filter((s) => !mine.has(s));
    if (miss.length && sk < 0.6) reasons.push(`Missing: ${miss.slice(0, 3).join(", ")}`);
  }

  // Seniority
  const diff = SENIORITY_RANK[a.seniority] - SENIORITY_RANK[p.seniority];
  let sen: number;
  if (a.seniority === "intern") sen = 0;
  else if (a.seniority === "manager") sen = p.seniority === "lead" || p.seniority === "manager" ? 0.8 : 0.4;
  else if (diff === 0 || diff === 1) sen = 1;
  else if (diff === -1) sen = 0.7;
  else if (diff >= 2) sen = 0.5;
  else sen = 0.15; // two or more levels below you (e.g. graduate roles for a senior)
  if (sen <= 0.15) reasons.push(`Pitched at ${a.seniority} level`);

  // Years required
  let yr = 0.7;
  if (a.minYears !== null && p.yearsExperience !== null) {
    yr = a.minYears <= p.yearsExperience ? 1 : a.minYears <= p.yearsExperience + 2 ? 0.6 : 0.2;
    if (yr < 1) reasons.push(`Asks for ${a.minYears}+ years`);
  }

  let score = Math.round(fam * W.family + sk * W.skills + sen * W.seniority + yr * W.years);
  // A role two or more levels below you is a poor fit however well the stack matches.
  if (a.seniority === "intern") score = Math.min(score, 20);
  else if (sen <= 0.15) score = Math.min(score, 45);
  return { score, reasons };
}
