import { SENIORITY_RANK, type JobAnalysis, type Profile } from "./analyze.js";
import { CORE_SKILLS } from "./skills.js";

export interface MatchResult {
  score: number;
  reasons: string[];
}

const W = { family: 25, skills: 40, seniority: 20, years: 15 } as const;

/**
 * How well a job fits the user's profile (separate from confidence; PLAN.md, "Match score").
 *
 * Design: the TITLE and the CORE STACK (languages/frameworks) decide. Supporting skills
 * (SQL, AWS, Docker, CI/CD...) appear in almost every posting, so they only add a little.
 * Hard caps keep clearly wrong roles below any sensible threshold however many words overlap.
 */
export function matchScore(p: Profile, a: JobAnalysis): MatchResult {
  if (!a.isSoftware) return { score: 5, reasons: ["Not a software engineering role"] };
  const reasons: string[] = [];
  let cap = 100;

  // ── Role family ───────────────────────────────────────────────────────────
  let fam: number;
  const f = a.family ?? "general";
  const mine = new Set(p.families);
  if (f === "general")
    fam = 0.7; // "Software Engineer": fits if the stack does
  else if (mine.has(f)) fam = 1;
  else if (f === "fullstack" && (mine.has("frontend") || mine.has("backend"))) fam = 0.8;
  else if ((f === "frontend" || f === "backend") && mine.has("fullstack")) fam = 1;
  else {
    fam = 0.15;
    cap = Math.min(cap, 40);
    reasons.push(`Different specialty (${f})`);
  }
  if (fam >= 1) reasons.push(`Role fits your ${f === "general" ? "background" : f} experience`);

  // ── Stack ─────────────────────────────────────────────────────────────────
  const have = new Set(p.skills);
  const jobCore = a.skills.filter((s) => CORE_SKILLS.has(s));
  const jobSupport = a.skills.filter((s) => !CORE_SKILLS.has(s));
  const coreHit = jobCore.filter((s) => have.has(s));
  const supportHit = jobSupport.filter((s) => have.has(s));

  const titleCore = a.titleSkills.filter((s) => CORE_SKILLS.has(s));
  const titleMiss = titleCore.filter((s) => !have.has(s));
  const titleHit = titleCore.filter((s) => have.has(s));

  let sk: number;
  if (jobCore.length) {
    const coreShare = coreHit.length / Math.max(2, Math.min(jobCore.length, 5));
    const supportShare = jobSupport.length ? supportHit.length / Math.min(jobSupport.length, 5) : 0;
    sk = Math.min(1, coreShare * 0.85 + supportShare * 0.15);
  } else {
    sk = 0.3; // the posting names no stack: weak evidence either way, not "neutral"
  }
  if (titleHit.length) sk = Math.max(sk, 0.9);
  if (titleMiss.length && !titleHit.length) {
    // "Go Backend Developer" / "C++ Engineer" when you have none of those languages
    cap = Math.min(cap, 40);
    sk = Math.min(sk, 0.2);
    reasons.push(`Title asks for ${titleMiss.slice(0, 2).join(", ")}, which isn't on your resume`);
  }
  if (coreHit.length) reasons.push(`Your stack: ${coreHit.slice(0, 4).join(", ")}`);
  else if (jobCore.length) reasons.push(`Stack: ${jobCore.slice(0, 3).join(", ")}, none on your resume`);
  if (a.offStack) {
    cap = Math.min(cap, 35);
    reasons.push("Platform/CMS specialist role (e.g. WordPress, Salesforce)");
  }

  // ── Seniority ─────────────────────────────────────────────────────────────
  const diff = SENIORITY_RANK[a.seniority] - SENIORITY_RANK[p.seniority];
  let sen: number;
  if (a.seniority === "intern") sen = 0;
  else if (a.seniority === "manager") sen = p.seniority === "lead" || p.seniority === "manager" ? 0.8 : 0.4;
  else if (diff === 0 || diff === 1) sen = 1;
  else if (diff === -1) sen = 0.7;
  else if (diff >= 2) sen = 0.5;
  else sen = 0.15; // two or more levels below you
  if (sen <= 0.15) reasons.push(`Pitched at ${a.seniority} level`);
  if (a.seniority === "intern") cap = Math.min(cap, 20);
  else if (sen <= 0.15) cap = Math.min(cap, 45);

  // ── Years required ────────────────────────────────────────────────────────
  let yr = 0.7;
  if (a.minYears !== null && p.yearsExperience !== null) {
    yr = a.minYears <= p.yearsExperience ? 1 : a.minYears <= p.yearsExperience + 2 ? 0.6 : 0.2;
    if (yr < 1) reasons.push(`Asks for ${a.minYears}+ years`);
  }

  const raw = Math.round(fam * W.family + sk * W.skills + sen * W.seniority + yr * W.years);
  return { score: Math.min(raw, cap), reasons };
}
