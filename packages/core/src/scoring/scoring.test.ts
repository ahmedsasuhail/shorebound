import { describe, expect, it } from "vitest";
import { analyzeJob, extractProfile, type Profile } from "./analyze.js";
import { confidenceScore, detectScams } from "./confidence.js";
import { matchScore } from "./match.js";
import { findSkills } from "./skills.js";

// Fictional resume with the same shape as a typical senior full-stack resume.
const RESUME = `Jane Doe  Senior Software Engineer
jane@example.com | City, Country
Senior Software Engineer with 7+ years of experience building web applications and backend systems.
Skills
Languages: JavaScript, TypeScript, Python, PHP
Frontend: React.js, Next.js, React Native, HTML, CSS
Backend: Node.js, NestJS, Express.js, REST APIs, RabbitMQ
Databases: MySQL, Redis, MongoDB, OpenSearch
Cloud & DevOps: AWS, Docker, GitHub Actions, Jenkins
Professional Experience
Acme Corp, Senior Software Engineer 10/2023
Built pipelines with good test coverage using Jest and DataDog.
Beta Ltd, Senior Software Development Engineer 08/2021 – 09/2023
Gamma Inc, Software Engineer 08/2019 – 08/2021
Trainee 01/2019 – 08/2019
Education
Bachelor of Computer Applications 06/2016 – 05/2019`;

const now = new Date("2026-11-22T12:00:00Z");

describe("skills taxonomy", () => {
  it("uses word boundaries: no 'go' in 'good', no 'java' in 'javascript'", () => {
    const s = findSkills("Good knowledge of JavaScript and good communication.");
    expect(s).toContain("javascript");
    expect(s).not.toContain("go");
    expect(s).not.toContain("java");
  });
  it("finds canonical skills from aliases", () => {
    expect(findSkills("Experience with Golang, k8s and Postgres")).toEqual(expect.arrayContaining(["go", "kubernetes", "postgresql", "sql"]));
  });
});

describe("extractProfile", () => {
  const p = extractProfile(RESUME, now);
  it("reads skills, stated years, seniority and families", () => {
    expect(p.skills).toEqual(expect.arrayContaining(["typescript", "node.js", "nestjs", "react", "aws", "docker", "rabbitmq"]));
    expect(p.skills).not.toContain("java");
    expect(p.skills).not.toContain("go");
    expect(p.yearsExperience).toBe(7);
    expect(p.seniority).toBe("senior");
    expect(p.families).toEqual(expect.arrayContaining(["fullstack", "frontend", "backend"]));
    expect(p.title).toMatch(/senior software engineer/i);
  });
  it("handles PDF text where dates were moved away from the Experience section", () => {
    const pdfLike = `10/2023\n08/2021 – 09/2023\n08/2019 – 08/2021\n01/2019 – 08/2019\n06/2016 – 05/2019\nJane Doe Senior Software Engineer\nSkills TypeScript Node.js React\nProfessional Experience Acme Corp Senior Software Engineer\nEducation Bachelor of Computer Applications`;
    const q = extractProfile(pdfLike, now);
    expect(q.yearsExperience).toBeGreaterThan(7.5);
    expect(q.yearsExperience).toBeLessThan(8.2);
  });

  it("falls back to work dates (ignoring education) when years are not stated", () => {
    const q = extractProfile(RESUME.replace("with 7+ years of experience ", ""), now);
    expect(q.yearsExperience).toBeGreaterThan(7.5);
    expect(q.yearsExperience).toBeLessThan(8.2);
  });
});

describe("analyzeJob", () => {
  it.each([
    ["Senior Backend Engineer (Node.js)", true, "backend", "senior"],
    ["Frontend Engineer (f/m/d)", true, "frontend", "mid"],
    ["Wordpress Web Developer at United Media", true, "frontend", "mid"],
    ["Staff Software Engineer", true, "general", "lead"],
    ["Software Engineering Intern", true, "general", "intern"],
    ["Data Engineer", true, "data", "mid"],
    ["Graduate Quantitative Researcher 2028 – Expression of Interest", false, null, "junior"],
    ["Talent Acquisition Specialist at United-Media", false, null, "mid"],
    ["UX Designer at United Media", false, null, "mid"],
    ["Mechanical Engineer", false, null, "mid"],
    ["Senior Venture Associate", false, null, "senior"],
    ["Platform QA Chapter Lead (all genders)", true, "qa", "lead"],
    ["Lead Systems Engineer (Orbital Launch)", false, null, "lead"],
    ["Senior Data Platform Engineer", true, "data", "senior"],
  ])("%s → software=%s family=%s level=%s", (title, sw, fam, lvl) => {
    const a = analyzeJob(title, "");
    expect(a.isSoftware).toBe(sw);
    expect(a.family).toBe(fam);
    expect(a.seniority).toBe(lvl);
  });
  it("reads minimum years", () => {
    expect(analyzeJob("x", "You have 5+ years of professional experience").minYears).toBe(5);
    expect(analyzeJob("x", "Minimum 3 years in backend").minYears).toBe(3);
    expect(analyzeJob("x", "Founded 12 years ago").minYears).toBeNull();
  });
});

describe("matchScore", () => {
  const p: Profile = extractProfile(RESUME, now);
  const score = (title: string, desc: string) => matchScore(p, analyzeJob(title, desc)).score;
  it("ranks a senior Node/TypeScript backend role high", () => {
    expect(score("Senior Backend Engineer", "TypeScript, Node.js, NestJS, AWS, Docker, PostgreSQL. 5+ years experience.")).toBeGreaterThanOrEqual(80);
  });
  it("ranks a graduate role low even with matching skills", () => {
    expect(score("Graduate Software Engineer 2027", "React and TypeScript")).toBeLessThan(65);
  });
  it("sinks non-software roles", () => {
    expect(score("Talent Acquisition Specialist", "Recruit engineers")).toBe(5);
  });
  it("penalises roles asking for far more experience", () => {
    expect(score("Senior Backend Engineer", "Node.js. 12+ years of experience")).toBeLessThan(score("Senior Backend Engineer", "Node.js. 5+ years of experience"));
  });
  it("one matching skill out of one listed is not a perfect skills score", () => {
    expect(score("Platform QA Chapter Lead", "CI/CD pipelines")).toBeLessThan(75);
  });
  it("prefers matching stack over a different one", () => {
    expect(score("Senior Software Engineer", "Node.js TypeScript React AWS")).toBeGreaterThan(score("Senior Software Engineer", "Scala Spark Kafka Rust C++"));
  });
});

describe("confidence", () => {
  const base = { ease: 4, postedAt: new Date(now.getTime() - 3_600_000), now, descriptionLength: 2000, hasCompany: true, text: "Great team." };
  it("explicit sponsorship + easy country + fresh posting → high, with partial coverage", () => {
    const r = confidenceScore({ ...base, sponsorship: "confirmed_text" });
    expect(r.band).toBe("high");
    expect(r.coverage).toBe(0.65);
    expect(r.factors.find((f) => f.id === "company_reputation")?.value).toBeNull();
  });
  it("visa-filtered board scores below explicit text", () => {
    expect(confidenceScore({ ...base, sponsorship: "visa_source" }).score).toBeLessThan(confidenceScore({ ...base, sponsorship: "confirmed_text" }).score);
  });
  it("caps explicit no-sponsorship at 5", () => {
    expect(confidenceScore({ ...base, sponsorship: "negative" }).score).toBeLessThanOrEqual(5);
  });
  it("hard scam flags cap at 10", () => {
    const r = confidenceScore({ ...base, sponsorship: "confirmed_text", text: "Pay the visa processing fee of Rs 50,000 to confirm." });
    expect(r.score).toBeLessThanOrEqual(10);
    expect(r.flags.map((f) => f.id)).toContain("fee_demanded");
  });
  it.each([
    ["Send your CV on WhatsApp to +971 50 000 0000", "messaging_only_contact"],
    ["Email hr.dubaijobs@gmail.com", "personal_email_domain"],
    ["Come on a visit visa, we will convert it to a work permit later", "tourist_visa_convert"],
    ["You have been selected, no interview needed", "no_interview_instant_offer"],
    ["Share your passport copy and Aadhaar to proceed", "early_sensitive_data_request"],
  ])("detects: %s", (text, id) => expect(detectScams(text).map((f) => f.id)).toContain(id));
  it("does not flag ordinary postings", () => {
    expect(detectScams("We offer visa sponsorship, relocation support and a learning budget. Apply via our careers page.")).toEqual([]);
  });
});
