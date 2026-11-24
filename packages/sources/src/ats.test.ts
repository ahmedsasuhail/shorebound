import { describe, expect, it } from "vitest";
import { atsConnector, parseAshby, parseGreenhouse, parseLever, type SeedCompany } from "./ats.js";
import {
  fetchCanadaLmia,
  fetchIrelandPermits,
  parseNetherlandsRegister,
  parseIrelandPermitRows,
  fetchUkRegisterCsv,
  normalizeOrg,
  parseCsv,
  parseLmiaRows,
  parseUkRegister,
  type RegisterIndex,
} from "./registers.js";
import type { FetchLike } from "./types.js";

const now = new Date("2026-11-22T12:00:00Z");
const since = new Date(now.getTime() - 7 * 86_400_000);
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

const REGISTER: RegisterIndex = new Map([["GB", new Set([normalizeOrg("Acme UK Limited")])]]);
const getRegs = async () => REGISTER;

const gh = (over: object = {}) => ({
  id: 1,
  title: "Senior Backend Engineer",
  absolute_url: "https://boards.greenhouse.io/acme/jobs/1",
  first_published: daysAgo(1),
  updated_at: daysAgo(0),
  location: { name: "London, United Kingdom" },
  content: "&lt;p&gt;Build APIs with Node.js.&lt;/p&gt;",
  ...over,
});
const respond =
  (body: unknown): FetchLike =>
  async () => ({ ok: true, status: 200, json: async () => body, text: async () => "" });
const acme = (ats: SeedCompany["ats"] = "greenhouse"): SeedCompany => ({
  name: "Acme",
  ats,
  token: "acme",
  register: { GB: ["Acme UK Limited"] },
});
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
    const { jobs } = await run(acme(), {
      jobs: [
        gh({ location: { name: "Berlin, Germany" }, content: "We offer visa sponsorship and relocation support." }),
      ],
    });
    expect(jobs[0]!.sponsorship.status).toBe("confirmed_text");
    expect(jobs[0]!.relocation.status).toBe("offered");
  });

  it("drops jobs with no sponsorship signal, negatives, non-software, old and unknown-country jobs", async () => {
    const { jobs, stats } = await run(acme(), {
      jobs: [
        gh({ id: 1, location: { name: "Berlin, Germany" } }), // no register for DE, no text
        gh({ id: 2, content: "We cannot provide visa sponsorship." }), // explicit negative (GB, on register)
        gh({ id: 3, title: "Account Executive" }), // not software
        gh({ id: 4, first_published: daysAgo(30) }), // too old
        gh({ id: 5, location: { name: "Atlantis" } }), // unknown country
        gh({ id: 6 }), // good
      ],
    });
    expect(jobs.map((j) => j.sourceJobId)).toEqual(["6"]);
    expect(stats).toMatchObject({ seen: 6, tooOld: 1, notSoftware: 1, unknownCountry: 1, noSponsorshipSignal: 2 });
  });

  it("uses a metadata location when location.name is just 'Hybrid'", async () => {
    const { jobs } = await run(acme(), {
      jobs: [gh({ location: { name: "Hybrid" }, metadata: [{ name: "Job Posting Location", value: ["London, UK"] }] })],
    });
    expect(jobs[0]?.country).toBe("GB");
  });

  it("uses first_published, not updated_at, as the posting date", async () => {
    const { jobs } = await run(acme(), { jobs: [gh({ first_published: daysAgo(30), updated_at: daysAgo(0) })] });
    expect(jobs).toHaveLength(0);
  });

  it("parses Lever (createdAt in ms) and Ashby (publishedAt)", async () => {
    const lever = await run(acme("lever"), [
      {
        id: "a",
        text: "Staff Software Engineer",
        hostedUrl: "https://jobs.lever.co/acme/a",
        createdAt: Date.parse(daysAgo(2)),
        descriptionPlain: "Python services.",
        country: "GB",
        categories: { location: "London" },
      },
    ]);
    expect(lever.jobs[0]).toMatchObject({
      country: "GB",
      sourceId: "lever",
      sponsorship: { status: "confirmed_register" },
    });
    const ashby = await run(acme("ashby"), {
      jobs: [
        {
          id: "b",
          title: "Software Engineer",
          jobUrl: "https://jobs.ashbyhq.com/acme/b",
          publishedAt: daysAgo(1),
          descriptionPlain: "Go.",
          address: { postalAddress: { addressCountry: "United Kingdom" } },
        },
      ],
    });
    expect(ashby.jobs[0]).toMatchObject({ country: "GB", sourceId: "ashby" });
  });

  it("one failing board does not stop the others, and a missing register still allows text-based jobs", async () => {
    let n = 0;
    const flaky: FetchLike = async () =>
      ++n === 1
        ? { ok: false, status: 404, json: async () => ({}), text: async () => "" }
        : {
            ok: true,
            status: 200,
            json: async () => ({ jobs: [gh({ content: "Visa sponsorship available." })] }),
            text: async () => "",
          };
    const r = await atsConnector([acme(), { ...acme(), name: "Beta", token: "beta" }], async () => {
      throw new Error("offline");
    }).fetchJobs({ fetch: flaky, since, now, delayMs: 0 });
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
  const csv =
    "﻿Organisation Name,Town/City,County,Type & Rating,Route\r\n" +
    '"Acme UK Limited",London,,Worker (A rating),Skilled Worker\r\n' +
    '"Beta, Inc ""B""",Leeds,,Worker (A rating),Skilled Worker\r\n' +
    "Charity Org,York,,Worker (A rating),Charity Worker\r\n";

  it("parses quoted CSV and keeps only Skilled Worker licences", () => {
    expect(parseCsv('a,"b,c","d ""e"""\n1,2,3')).toEqual([
      ["a", "b,c", 'd "e"'],
      ["1", "2", "3"],
    ]);
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
        ? {
            ok: true,
            status: 200,
            json: async () => ({
              public_updated_at: "2026-11-19",
              details: { attachments: [{ url: "https://assets/x.csv", content_type: "text/csv" }] },
            }),
            text: async () => "",
          }
        : { ok: true, status: 200, json: async () => ({}), text: async () => csv };
    const r = await fetchUkRegisterCsv(f);
    expect(r.updatedAt).toBe("2026-11-19");
    expect(parseUkRegister(r.csv).size).toBe(2);
  });
});

describe("Canada LMIA register", () => {
  const rows: unknown[][] = [
    ["Employers Who Were Issued a Positive LMIA ... April to June 2026", null, null, null, null, null, null, null],
    [
      "Province/Territory",
      "Program Stream",
      "Employer",
      "Address",
      "Occupation",
      "Incorporate Status",
      "Approved LMIAs",
      "Approved Positions",
    ],
    [
      "Ontario",
      "Global Talent Stream",
      "Stripe",
      "Toronto, ON",
      "21231-Software engineers and designers",
      "Unknown",
      1,
      2,
    ],
    [
      "Ontario",
      "High Wage",
      "Cohere Inc.",
      "Toronto, ON",
      "21232-Software developers and programmers",
      "Unknown",
      1,
      1,
    ],
    ["Ontario", "High Wage", "Cohere Inc.", "Toronto, ON", "21211-Data scientists", "Unknown", 1, 1],
    ["Alberta", "High Wage", "Farm Ltd.", "Red Deer, AB", "85100-Livestock labourers", "Unknown", 1, 5],
    [
      "Ontario",
      "High Wage",
      "Pixel Co",
      "Ottawa, ON",
      "2174-Computer programmers and interactive media developers",
      "Unknown",
      1,
      1,
    ],
    ["Ontario", "High Wage", "Shop Inc", "Toronto, ON", "21234-Web developers and programmers", "Unknown", 1, 1],
  ];

  it("keeps only employers with SOFTWARE occupations (by NOC code or title)", () => {
    expect([...parseLmiaRows(rows)].sort()).toEqual(["cohere inc.", "pixel co", "shop inc", "stripe"]);
  });

  it("rejects an unexpected sheet layout", () => {
    expect(() => parseLmiaRows([["nothing"]])).toThrow(/header row not found/);
  });

  it("downloads the latest N quarters (newest first) and merges them", async () => {
    const seen: string[] = [];
    const f: FetchLike = async (url) => {
      seen.push(url);
      return url.includes("package_show")
        ? {
            ok: true,
            status: 200,
            text: async () => "",
            json: async () => ({
              result: {
                resources: [
                  {
                    name: "2025Q4-Employers Who Were Issued...",
                    format: "XLSX",
                    language: ["en"],
                    url: "https://x/q4.xlsx",
                  },
                  {
                    name: "2026Q1-Employers Who Were Issued...",
                    format: "XLSX",
                    language: ["en"],
                    url: "https://x/q1.xlsx",
                  },
                  { name: "2026Q1-Employeurs...", format: "XLSX", language: ["fr"], url: "https://x/q1fr.xlsx" },
                  { name: "2020Q3-Employers...", format: "CSV", language: ["en"], url: "https://x/old.csv" },
                  {
                    name: "2025Q3-Employers Who Were Issued...",
                    format: "XLSX",
                    language: ["en"],
                    url: "https://x/q3.xlsx",
                  },
                ],
              },
            }),
          }
        : {
            ok: true,
            status: 200,
            text: async () => "",
            json: async () => ({}),
            arrayBuffer: async () => new ArrayBuffer(1),
          };
    };
    const read = async () => rows;
    const r = await fetchCanadaLmia(f, { quarters: 2, read });
    expect(r.quarters).toEqual(["2026Q1", "2025Q4"]);
    expect(seen.filter((u) => u.endsWith(".xlsx"))).toEqual(["https://x/q1.xlsx", "https://x/q4.xlsx"]);
    expect(r.names.has("stripe")).toBe(true);
  });

  it("a Canadian job at an LMIA employer becomes 'registered' with Canada-specific evidence", async () => {
    const co: SeedCompany = { name: "Stripe", ats: "greenhouse", token: "stripe", register: { CA: ["Stripe"] } };
    const regs = async () => new Map([["CA", new Set([normalizeOrg("Stripe")])]]);
    const { jobs } = await run(co, { jobs: [gh({ location: { name: "Toronto, Canada" } })] }, regs);
    expect(jobs[0]).toMatchObject({ country: "CA", sponsorship: { status: "confirmed_register" } });
    expect(jobs[0]!.sponsorship.evidence).toMatch(/Labour Market Impact Assessment/);
  });

  it("partial register failure still works: result may carry warnings", async () => {
    const regs = async () => ({ index: REGISTER, warnings: ["Canada register unavailable (offline)."] });
    const r = await run(acme(), { jobs: [gh()] }, regs);
    expect(r.jobs).toHaveLength(1);
    expect(r.warnings).toContain("Canada register unavailable (offline).");
  });
});

describe("Ireland permits register", () => {
  const rows: unknown[][] = [
    [null, "January", "February", "Grand Total"],
    ["Grand Total", 3798, 2994, 31044],
    ["Stripe Technology Company Limited", 1, 1, 34],
    ["Datadog Ireland Limited", 1, null, 4],
    ["Empty Ltd", null, null, 0],
  ];

  it("keeps companies with at least one permit; skips header and total rows", () => {
    expect([...parseIrelandPermitRows(rows)].sort()).toEqual([
      "datadog ireland limited",
      "stripe technology company limited",
    ]);
  });

  it("falls back to last year when this year's file is not published yet", async () => {
    const urls: string[] = [];
    const f: FetchLike = async (url) => {
      urls.push(url);
      return url.includes("2026")
        ? { ok: false, status: 404, json: async () => ({}), text: async () => "" }
        : {
            ok: true,
            status: 200,
            json: async () => ({}),
            text: async () => "",
            arrayBuffer: async () => new ArrayBuffer(1),
          };
    };
    const r = await fetchIrelandPermits(f, { now: new Date("2026-11-25"), read: async () => rows });
    expect(r.year).toBe(2025);
    expect(urls.map((u) => u.slice(-9))).toEqual(["2026.xlsx", "2025.xlsx"]);
  });

  it("an Irish job at a permit-holding employer gets Ireland-specific evidence", async () => {
    const co: SeedCompany = {
      name: "Stripe",
      ats: "greenhouse",
      token: "stripe",
      register: { IE: ["Stripe Technology Company Limited"] },
    };
    const regs = async () => new Map([["IE", new Set([normalizeOrg("Stripe Technology Company Limited")])]]);
    const { jobs } = await run(co, { jobs: [gh({ location: { name: "Dublin, Ireland" } })] }, regs);
    expect(jobs[0]).toMatchObject({ country: "IE", sponsorship: { status: "confirmed_register" } });
    expect(jobs[0]!.sponsorship.evidence).toMatch(/Irish employment permits/);
  });
});

describe("Netherlands IND register", () => {
  const page =
    "<table><tr><th>Organisation</th><th>KVK (Chamber of Commerce) number</th></tr><tr><td>Filler 0 B.V.</td><td>0</td></tr><tr><td>Filler 1 B.V.</td><td>1</td></tr><tr><td>Filler 2 B.V.</td><td>2</td></tr><tr><td>Filler 3 B.V.</td><td>3</td></tr><tr><td>Filler 4 B.V.</td><td>4</td></tr><tr><td>Filler 5 B.V.</td><td>5</td></tr><tr><td>Filler 6 B.V.</td><td>6</td></tr><tr><td>Filler 7 B.V.</td><td>7</td></tr><tr><td>Filler 8 B.V.</td><td>8</td></tr><tr><td>Filler 9 B.V.</td><td>9</td></tr><tr><td>Filler 10 B.V.</td><td>10</td></tr><tr><td>Filler 11 B.V.</td><td>11</td></tr><tr><td>Filler 12 B.V.</td><td>12</td></tr><tr><td>Filler 13 B.V.</td><td>13</td></tr><tr><td>Filler 14 B.V.</td><td>14</td></tr><tr><td>Filler 15 B.V.</td><td>15</td></tr><tr><td>Filler 16 B.V.</td><td>16</td></tr><tr><td>Filler 17 B.V.</td><td>17</td></tr><tr><td>Filler 18 B.V.</td><td>18</td></tr><tr><td>Filler 19 B.V.</td><td>19</td></tr><tr><td>Filler 20 B.V.</td><td>20</td></tr><tr><td>Filler 21 B.V.</td><td>21</td></tr><tr><td>Filler 22 B.V.</td><td>22</td></tr><tr><td>Filler 23 B.V.</td><td>23</td></tr><tr><td>Filler 24 B.V.</td><td>24</td></tr><tr><td>Filler 25 B.V.</td><td>25</td></tr><tr><td>Filler 26 B.V.</td><td>26</td></tr><tr><td>Filler 27 B.V.</td><td>27</td></tr><tr><td>Filler 28 B.V.</td><td>28</td></tr><tr><td>Filler 29 B.V.</td><td>29</td></tr><tr><td>Filler 30 B.V.</td><td>30</td></tr><tr><td>Filler 31 B.V.</td><td>31</td></tr><tr><td>Filler 32 B.V.</td><td>32</td></tr><tr><td>Filler 33 B.V.</td><td>33</td></tr><tr><td>Filler 34 B.V.</td><td>34</td></tr><tr><td>Filler 35 B.V.</td><td>35</td></tr><tr><td>Filler 36 B.V.</td><td>36</td></tr><tr><td>Filler 37 B.V.</td><td>37</td></tr><tr><td>Filler 38 B.V.</td><td>38</td></tr><tr><td>Filler 39 B.V.</td><td>39</td></tr><tr><td>Filler 40 B.V.</td><td>40</td></tr><tr><td>Filler 41 B.V.</td><td>41</td></tr><tr><td>Filler 42 B.V.</td><td>42</td></tr><tr><td>Filler 43 B.V.</td><td>43</td></tr><tr><td>Filler 44 B.V.</td><td>44</td></tr><tr><td>Filler 45 B.V.</td><td>45</td></tr><tr><td>Filler 46 B.V.</td><td>46</td></tr><tr><td>Filler 47 B.V.</td><td>47</td></tr><tr><td>Filler 48 B.V.</td><td>48</td></tr><tr><td>Filler 49 B.V.</td><td>49</td></tr><tr><td>Filler 50 B.V.</td><td>50</td></tr><tr><td>Filler 51 B.V.</td><td>51</td></tr><tr><td>Filler 52 B.V.</td><td>52</td></tr><tr><td>Filler 53 B.V.</td><td>53</td></tr><tr><td>Filler 54 B.V.</td><td>54</td></tr><tr><td>Filler 55 B.V.</td><td>55</td></tr><tr><td>Filler 56 B.V.</td><td>56</td></tr><tr><td>Filler 57 B.V.</td><td>57</td></tr><tr><td>Filler 58 B.V.</td><td>58</td></tr><tr><td>Filler 59 B.V.</td><td>59</td></tr><tr><td>Filler 60 B.V.</td><td>60</td></tr><tr><td>Filler 61 B.V.</td><td>61</td></tr><tr><td>Filler 62 B.V.</td><td>62</td></tr><tr><td>Filler 63 B.V.</td><td>63</td></tr><tr><td>Filler 64 B.V.</td><td>64</td></tr><tr><td>Filler 65 B.V.</td><td>65</td></tr><tr><td>Filler 66 B.V.</td><td>66</td></tr><tr><td>Filler 67 B.V.</td><td>67</td></tr><tr><td>Filler 68 B.V.</td><td>68</td></tr><tr><td>Filler 69 B.V.</td><td>69</td></tr><tr><td>Filler 70 B.V.</td><td>70</td></tr><tr><td>Filler 71 B.V.</td><td>71</td></tr><tr><td>Filler 72 B.V.</td><td>72</td></tr><tr><td>Filler 73 B.V.</td><td>73</td></tr><tr><td>Filler 74 B.V.</td><td>74</td></tr><tr><td>Filler 75 B.V.</td><td>75</td></tr><tr><td>Filler 76 B.V.</td><td>76</td></tr><tr><td>Filler 77 B.V.</td><td>77</td></tr><tr><td>Filler 78 B.V.</td><td>78</td></tr><tr><td>Filler 79 B.V.</td><td>79</td></tr><tr><td>Filler 80 B.V.</td><td>80</td></tr><tr><td>Filler 81 B.V.</td><td>81</td></tr><tr><td>Filler 82 B.V.</td><td>82</td></tr><tr><td>Filler 83 B.V.</td><td>83</td></tr><tr><td>Filler 84 B.V.</td><td>84</td></tr><tr><td>Filler 85 B.V.</td><td>85</td></tr><tr><td>Filler 86 B.V.</td><td>86</td></tr><tr><td>Filler 87 B.V.</td><td>87</td></tr><tr><td>Filler 88 B.V.</td><td>88</td></tr><tr><td>Filler 89 B.V.</td><td>89</td></tr><tr><td>Filler 90 B.V.</td><td>90</td></tr><tr><td>Filler 91 B.V.</td><td>91</td></tr><tr><td>Filler 92 B.V.</td><td>92</td></tr><tr><td>Filler 93 B.V.</td><td>93</td></tr><tr><td>Filler 94 B.V.</td><td>94</td></tr><tr><td>Filler 95 B.V.</td><td>95</td></tr><tr><td>Filler 96 B.V.</td><td>96</td></tr><tr><td>Filler 97 B.V.</td><td>97</td></tr><tr><td>Filler 98 B.V.</td><td>98</td></tr><tr><td>Filler 99 B.V.</td><td>99</td></tr><tr><td>Filler 100 B.V.</td><td>100</td></tr><tr><td>Filler 101 B.V.</td><td>101</td></tr><tr><td>Filler 102 B.V.</td><td>102</td></tr><tr><td>Filler 103 B.V.</td><td>103</td></tr><tr><td>Filler 104 B.V.</td><td>104</td></tr><tr><td>Filler 105 B.V.</td><td>105</td></tr><tr><td>Filler 106 B.V.</td><td>106</td></tr><tr><td>Filler 107 B.V.</td><td>107</td></tr><tr><td>Filler 108 B.V.</td><td>108</td></tr><tr><td>Filler 109 B.V.</td><td>109</td></tr><tr><td>Filler 110 B.V.</td><td>110</td></tr><tr><td>Filler 111 B.V.</td><td>111</td></tr><tr><td>Filler 112 B.V.</td><td>112</td></tr><tr><td>Filler 113 B.V.</td><td>113</td></tr><tr><td>Filler 114 B.V.</td><td>114</td></tr><tr><td>Filler 115 B.V.</td><td>115</td></tr><tr><td>Filler 116 B.V.</td><td>116</td></tr><tr><td>Filler 117 B.V.</td><td>117</td></tr><tr><td>Filler 118 B.V.</td><td>118</td></tr><tr><td>Filler 119 B.V.</td><td>119</td></tr><tr><td>Adyen N.V.</td><td>34259528</td></tr><tr><td>&quot;AAE&quot; Advanced &amp; Co B.V.</td><td>1</td></tr></table>";

  it("reads organisation names from the register table, decoding entities and skipping the header", () => {
    const names = parseNetherlandsRegister(page);
    expect(names.has("adyen n.v.")).toBe(true);
    expect(names.has('"aae" advanced & co b.v.')).toBe(true);
    expect(names.has("organisation")).toBe(false);
  });

  it("rejects a page that does not look like the register", () => {
    expect(() => parseNetherlandsRegister("<table><tr><td>Only one</td></tr></table>")).toThrow(/too few/);
  });

  it("a Dutch job at a recognised sponsor gets Netherlands-specific evidence", async () => {
    const co: SeedCompany = { name: "Adyen", ats: "greenhouse", token: "adyen", register: { NL: ["Adyen N.V."] } };
    const regs = async () => new Map([["NL", new Set([normalizeOrg("Adyen N.V.")])]]);
    const { jobs } = await run(co, { jobs: [gh({ location: { name: "Amsterdam" } })] }, regs);
    expect(jobs[0]).toMatchObject({ country: "NL", sponsorship: { status: "confirmed_register" } });
    expect(jobs[0]!.sponsorship.evidence).toMatch(/IND recognised sponsor/);
  });
});
