import { describe, expect, it } from "vitest";
import { atsConnector, parseAshby, parseGreenhouse, parseLever, type SeedCompany } from "./ats.js";
import { fetchUkRegisterCsv, normalizeOrg, parseCsv, parseUkRegister, type RegisterIndex } from "./registers.js";
import type { FetchLike } from "./types.js";

const now = new Date("2026-11-22T12:00:00Z");
const since = new Date(now.getTime() - 7 * 86_400_000);
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

const REGISTER: RegisterIndex = new Map([["GB", new Set([normalizeOrg("Acme UK Limited")])]]);
const getRegs = async () => REGISTER;

const gh = (over: object = {}) => ({
  id: 1, title: "Senior Backend Engineer", absolute_url: "https://boards.greenhouse.io/acme/jobs/1",
  first_published: daysAgo(1), updated_at: daysAgo(0), location: { name: "London, United Kingdom" },
  content: "&lt;p&gt;Build APIs with Node.js.&lt;/p&gt;", ...over,
});
const respond = (body: unknown): FetchLike => async () => ({ ok: true, status: 200, json: async () => body, text: async () => "" });
const acme = (ats: SeedCompany["ats"] = "greenhouse"): SeedCompany => ({ name: "Acme", ats, token: "acme", register: { GB: ["Acme UK Limited"] } });
const run = (co: SeedCompany, body: unknown, regs = getRegs) =>
  atsConnector([co], regs).fetchJobs({ fetch: respond(body), since, now, delayMs: 0 });

describe("company boards connector", () => {
  it("a UK job at a licensed sponsor becomes 'registered sponsor' with evidence", async () => {
    const { jobs } = await run(acme(), { jobs: [gh()] });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.sponsorship.status).toBe("confirmed_register");
    expect(jobs[0]!.sponsorship.evidence).toMatch(/Acme UK Limited/);
    expect(jobs[0]!.country).toBe("GB");
    expect(jobs[0]!.description).toBe("Build APIs with Node.js."); // escaped HTML decoded to text
  });

  it("explicit sponsorship text wins even without a register", async () => {
    const { jobs } = await run(acme(), { jobs: [gh({ location: { name: "Berlin, Germany" }, content: "We offer visa sponsorship and relocation support." })] });
    expect(jobs[0]!.sponsorship.status).toBe("confirmed_text");
    expect(jobs[0]!.relocation.status).toBe("offered");
  });

  it("drops jobs with no sponsorship signal, negatives, non-software, old and unknown-country jobs", async () => {
    const { jobs, stats } = await run(acme(), { jobs: [
      gh({ id: 1, location: { name: "Berlin, Germany" } }),                       // no register for DE, no text
      gh({ id: 2, content: "We cannot provide visa sponsorship." }),               // explicit negative (GB, on register)
      gh({ id: 3, title: "Account Executive" }),                                   // not software
      gh({ id: 4, first_published: daysAgo(30) }),                                 // too old
      gh({ id: 5, location: { name: "Atlantis" } }),                               // unknown country
      gh({ id: 6 }),                                                               // good
    ] });
    expect(jobs.map((j) => j.sourceJobId)).toEqual(["6"]);
    expect(stats).toMatchObject({ seen: 6, tooOld: 1, notSoftware: 1, unknownCountry: 1, noSponsorshipSignal: 2 });
  });

  it("uses a metadata location when location.name is just 'Hybrid'", async () => {
    const { jobs } = await run(acme(), { jobs: [gh({ location: { name: "Hybrid" }, metadata: [{ name: "Job Posting Location", value: ["London, UK"] }] })] });
    expect(jobs[0]?.country).toBe("GB");
  });

  it("uses first_published, not updated_at, as the posting date", async () => {
    const { jobs } = await run(acme(), { jobs: [gh({ first_published: daysAgo(30), updated_at: daysAgo(0) })] });
    expect(jobs).toHaveLength(0);
  });

  it("parses Lever (createdAt in ms) and Ashby (publishedAt)", async () => {
    const lever = await run(acme("lever"), [{ id: "a", text: "Staff Software Engineer", hostedUrl: "https://jobs.lever.co/acme/a", createdAt: Date.parse(daysAgo(2)), descriptionPlain: "Python services.", country: "GB", categories: { location: "London" } }]);
    expect(lever.jobs[0]).toMatchObject({ country: "GB", sourceId: "lever", sponsorship: { status: "confirmed_register" } });
    const ashby = await run(acme("ashby"), { jobs: [{ id: "b", title: "Software Engineer", jobUrl: "https://jobs.ashbyhq.com/acme/b", publishedAt: daysAgo(1), descriptionPlain: "Go.", address: { postalAddress: { addressCountry: "United Kingdom" } } }] });
    expect(ashby.jobs[0]).toMatchObject({ country: "GB", sourceId: "ashby" });
  });

  it("one failing board does not stop the others, and a missing register still allows text-based jobs", async () => {
    let n = 0;
    const flaky: FetchLike = async () => (++n === 1 ? { ok: false, status: 404, json: async () => ({}), text: async () => "" } : { ok: true, status: 200, json: async () => ({ jobs: [gh({ content: "Visa sponsorship available." })] }), text: async () => "" });
    const r = await atsConnector([acme(), { ...acme(), name: "Beta", token: "beta" }], async () => { throw new Error("offline"); }).fetchJobs({ fetch: flaky, since, now, delayMs: 0 });
    expect(r.jobs).toHaveLength(1);
    expect(r.jobs[0]!.company).toBe("Beta");
    expect(r.warnings?.some((w) => w.startsWith("Acme: HTTP 404"))).toBe(true);
    expect(r.warnings?.some((w) => /register unavailable/i.test(w))).toBe(true);
  });
});

describe("parsers", () => {
  it("tolerate empty or odd bodies", () => {
    expect(parseGreenhouse({})).toEqual([]);
    expect(parseLever({})).toEqual([]);
    expect(parseAshby(null as never)).toEqual([]);
  });
});

describe("UK register", () => {
  const csv = '﻿Organisation Name,Town/City,County,Type & Rating,Route\r\n' +
    '"Acme UK Limited",London,,Worker (A rating),Skilled Worker\r\n' +
    '"Beta, Inc ""B""",Leeds,,Worker (A rating),Skilled Worker\r\n' +
    'Charity Org,York,,Worker (A rating),Charity Worker\r\n';

  it("parses quoted CSV and keeps only Skilled Worker licences", () => {
    expect(parseCsv('a,"b,c","d ""e"""\n1,2,3')).toEqual([["a", "b,c", 'd "e"'], ["1", "2", "3"]]);
    const names = parseUkRegister(csv);
    expect(names.has("acme uk limited")).toBe(true);
    expect(names.has('beta, inc "b"')).toBe(true);
    expect(names.has("charity org")).toBe(false);
  });

  it("rejects an unexpected format", () => {
    expect(() => parseUkRegister("a,b\n1,2")).toThrow(/Unexpected UK register format/);
  });

  it("finds the current CSV through the GOV.UK content API", async () => {
    const f: FetchLike = async (url) =>
      url.includes("gov.uk/api/content")
        ? { ok: true, status: 200, json: async () => ({ public_updated_at: "2026-11-19", details: { attachments: [{ url: "https://assets/x.csv", content_type: "text/csv" }] } }), text: async () => "" }
        : { ok: true, status: 200, json: async () => ({}), text: async () => csv };
    const r = await fetchUkRegisterCsv(f);
    expect(r.updatedAt).toBe("2026-11-19");
    expect(parseUkRegister(r.csv).size).toBe(2);
  });
});
