import { existsSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FetchLike } from "@shorebound/sources";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canadaRegisterLoader,
  combineRegisters,
  irelandRegisterLoader,
  netherlandsRegisterLoader,
  loadSeed,
  ukRegisterLoader,
} from "./connectors.js";

const dataDir = fileURLToPath(new URL("../../../data", import.meta.url));
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shorebound-reg-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const CSV =
  "Organisation Name,Town/City,County,Type & Rating,Route\nAcme UK Limited,London,,Worker (A rating),Skilled Worker\n";
const counting = (fail = false) => {
  const calls: string[] = [];
  const f: FetchLike = async (url) => {
    calls.push(url);
    if (fail) return { ok: false, status: 500, json: async () => ({}), text: async () => "" };
    return url.includes("api/content")
      ? {
          ok: true,
          status: 200,
          json: async () => ({ details: { attachments: [{ url: "https://x/r.csv", content_type: "text/csv" }] } }),
          text: async () => "",
        }
      : { ok: true, status: 200, json: async () => ({}), text: async () => CSV };
  };
  return { f, calls };
};

describe("seed companies", () => {
  it("the real seed file is valid and every register name is non-empty", () => {
    const seed = loadSeed(dataDir);
    expect(seed.length).toBeGreaterThanOrEqual(20);
    for (const c of seed) {
      expect(c.token, c.name).toBeTruthy();
      const names = Object.values(c.register ?? {}).flat();
      expect(names.length, `${c.name} needs at least one verified register name`).toBeGreaterThan(0);
      expect(
        names.every((n) => n.trim() === n && n.length > 1),
        c.name,
      ).toBe(true);
    }
  });
});

describe("UK register cache", () => {
  it("downloads once, then serves from disk for a week", async () => {
    const { f, calls } = counting();
    const load = ukRegisterLoader(dir, f);
    expect((await load()).get("GB")?.has("acme uk limited")).toBe(true);
    await load();
    expect(calls).toHaveLength(2); // content API + CSV, only on the first load
    expect(existsSync(join(dir, "registers", "gb.csv"))).toBe(true);
  });

  it("refreshes a stale cache, but falls back to the old copy if the download fails", async () => {
    await ukRegisterLoader(dir, counting().f)();
    const old = new Date(Date.now() - 10 * 86_400_000);
    utimesSync(join(dir, "registers", "gb.csv"), old, old);
    const failing = counting(true);
    expect((await ukRegisterLoader(dir, failing.f)()).get("GB")?.size).toBe(1);
    expect(failing.calls.length).toBeGreaterThan(0);
  });

  it("throws when there is no cache and the download fails", async () => {
    await expect(ukRegisterLoader(dir, counting(true).f)()).rejects.toThrow(/HTTP 500/);
  });
});

describe("Canada register cache and combined registers", () => {
  const pkg = {
    result: { resources: [{ name: "2026Q2-Employers", format: "XLSX", language: ["en"], url: "https://x/q2.xlsx" }] },
  };
  const rows = [
    ["Province/Territory", "Program Stream", "Employer", "Address", "Occupation"],
    ["ON", "GTS", "Acme Corp", "Toronto", "21231-Software engineers and designers"],
  ];
  const net = (fail = false) => {
    const calls: string[] = [];
    const f: FetchLike = async (url) => {
      calls.push(url);
      if (fail) return { ok: false, status: 503, json: async () => ({}), text: async () => "" };
      return url.includes("package_show")
        ? { ok: true, status: 200, json: async () => pkg, text: async () => "" }
        : {
            ok: true,
            status: 200,
            json: async () => ({}),
            text: async () => "",
            arrayBuffer: async () => new ArrayBuffer(1),
          };
    };
    return { f, calls };
  };
  const read = async () => rows;

  it("downloads once, then uses the cache; falls back to an old cache if the download fails", async () => {
    const a = net();
    expect((await canadaRegisterLoader(dir, a.f, undefined, read)()).get("CA")?.has("acme corp")).toBe(true);
    await canadaRegisterLoader(dir, a.f, undefined, read)();
    expect(a.calls.filter((u) => u.includes("package_show"))).toHaveLength(1);

    const old = new Date(Date.now() - 30 * 86_400_000);
    utimesSync(join(dir, "registers", "ca.json"), old, old);
    expect((await canadaRegisterLoader(dir, net(true).f, undefined, read)()).get("CA")?.size).toBe(1);
  });

  it("combined loader keeps working when one register fails, and says so", async () => {
    const r = await combineRegisters([
      {
        label: "UK",
        load: async () => {
          throw new Error("boom");
        },
      },
      { label: "Canada", load: async () => new Map([["CA", new Set(["acme corp"])]]) },
    ])();
    expect(r.index.get("CA")?.size).toBe(1);
    expect(r.warnings[0]).toMatch(/UK register unavailable \(boom\)/);
  });

  it("throws only when every register fails", async () => {
    await expect(
      combineRegisters([
        {
          label: "UK",
          load: async () => {
            throw new Error("a");
          },
        },
      ])(),
    ).rejects.toThrow(/UK register unavailable/);
  });
});

describe("Ireland register cache", () => {
  const rows = [["Acme Ireland Limited", 1, 1]];
  const ok: FetchLike = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
    arrayBuffer: async () => new ArrayBuffer(1),
  });
  const down: FetchLike = async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => "" });

  it("downloads, caches, and falls back to the cached copy when the site is down", async () => {
    expect(
      (await irelandRegisterLoader(dir, ok, undefined, async () => rows)()).get("IE")?.has("acme ireland limited"),
    ).toBe(true);
    const old = new Date(Date.now() - 30 * 86_400_000);
    utimesSync(join(dir, "registers", "ie.json"), old, old);
    expect((await irelandRegisterLoader(dir, down, undefined, async () => rows)()).get("IE")?.size).toBe(1);
  });

  it("throws when there is no cache and the site is down", async () => {
    await expect(irelandRegisterLoader(dir, down)()).rejects.toThrow(/not found/);
  });
});

describe("Netherlands register cache", () => {
  const page =
    "<table><tr><th>Organisation</th><th>KVK (Chamber of Commerce) number</th></tr><tr><td>Filler 0 B.V.</td><td>0</td></tr><tr><td>Filler 1 B.V.</td><td>1</td></tr><tr><td>Filler 2 B.V.</td><td>2</td></tr><tr><td>Filler 3 B.V.</td><td>3</td></tr><tr><td>Filler 4 B.V.</td><td>4</td></tr><tr><td>Filler 5 B.V.</td><td>5</td></tr><tr><td>Filler 6 B.V.</td><td>6</td></tr><tr><td>Filler 7 B.V.</td><td>7</td></tr><tr><td>Filler 8 B.V.</td><td>8</td></tr><tr><td>Filler 9 B.V.</td><td>9</td></tr><tr><td>Filler 10 B.V.</td><td>10</td></tr><tr><td>Filler 11 B.V.</td><td>11</td></tr><tr><td>Filler 12 B.V.</td><td>12</td></tr><tr><td>Filler 13 B.V.</td><td>13</td></tr><tr><td>Filler 14 B.V.</td><td>14</td></tr><tr><td>Filler 15 B.V.</td><td>15</td></tr><tr><td>Filler 16 B.V.</td><td>16</td></tr><tr><td>Filler 17 B.V.</td><td>17</td></tr><tr><td>Filler 18 B.V.</td><td>18</td></tr><tr><td>Filler 19 B.V.</td><td>19</td></tr><tr><td>Filler 20 B.V.</td><td>20</td></tr><tr><td>Filler 21 B.V.</td><td>21</td></tr><tr><td>Filler 22 B.V.</td><td>22</td></tr><tr><td>Filler 23 B.V.</td><td>23</td></tr><tr><td>Filler 24 B.V.</td><td>24</td></tr><tr><td>Filler 25 B.V.</td><td>25</td></tr><tr><td>Filler 26 B.V.</td><td>26</td></tr><tr><td>Filler 27 B.V.</td><td>27</td></tr><tr><td>Filler 28 B.V.</td><td>28</td></tr><tr><td>Filler 29 B.V.</td><td>29</td></tr><tr><td>Filler 30 B.V.</td><td>30</td></tr><tr><td>Filler 31 B.V.</td><td>31</td></tr><tr><td>Filler 32 B.V.</td><td>32</td></tr><tr><td>Filler 33 B.V.</td><td>33</td></tr><tr><td>Filler 34 B.V.</td><td>34</td></tr><tr><td>Filler 35 B.V.</td><td>35</td></tr><tr><td>Filler 36 B.V.</td><td>36</td></tr><tr><td>Filler 37 B.V.</td><td>37</td></tr><tr><td>Filler 38 B.V.</td><td>38</td></tr><tr><td>Filler 39 B.V.</td><td>39</td></tr><tr><td>Filler 40 B.V.</td><td>40</td></tr><tr><td>Filler 41 B.V.</td><td>41</td></tr><tr><td>Filler 42 B.V.</td><td>42</td></tr><tr><td>Filler 43 B.V.</td><td>43</td></tr><tr><td>Filler 44 B.V.</td><td>44</td></tr><tr><td>Filler 45 B.V.</td><td>45</td></tr><tr><td>Filler 46 B.V.</td><td>46</td></tr><tr><td>Filler 47 B.V.</td><td>47</td></tr><tr><td>Filler 48 B.V.</td><td>48</td></tr><tr><td>Filler 49 B.V.</td><td>49</td></tr><tr><td>Filler 50 B.V.</td><td>50</td></tr><tr><td>Filler 51 B.V.</td><td>51</td></tr><tr><td>Filler 52 B.V.</td><td>52</td></tr><tr><td>Filler 53 B.V.</td><td>53</td></tr><tr><td>Filler 54 B.V.</td><td>54</td></tr><tr><td>Filler 55 B.V.</td><td>55</td></tr><tr><td>Filler 56 B.V.</td><td>56</td></tr><tr><td>Filler 57 B.V.</td><td>57</td></tr><tr><td>Filler 58 B.V.</td><td>58</td></tr><tr><td>Filler 59 B.V.</td><td>59</td></tr><tr><td>Filler 60 B.V.</td><td>60</td></tr><tr><td>Filler 61 B.V.</td><td>61</td></tr><tr><td>Filler 62 B.V.</td><td>62</td></tr><tr><td>Filler 63 B.V.</td><td>63</td></tr><tr><td>Filler 64 B.V.</td><td>64</td></tr><tr><td>Filler 65 B.V.</td><td>65</td></tr><tr><td>Filler 66 B.V.</td><td>66</td></tr><tr><td>Filler 67 B.V.</td><td>67</td></tr><tr><td>Filler 68 B.V.</td><td>68</td></tr><tr><td>Filler 69 B.V.</td><td>69</td></tr><tr><td>Filler 70 B.V.</td><td>70</td></tr><tr><td>Filler 71 B.V.</td><td>71</td></tr><tr><td>Filler 72 B.V.</td><td>72</td></tr><tr><td>Filler 73 B.V.</td><td>73</td></tr><tr><td>Filler 74 B.V.</td><td>74</td></tr><tr><td>Filler 75 B.V.</td><td>75</td></tr><tr><td>Filler 76 B.V.</td><td>76</td></tr><tr><td>Filler 77 B.V.</td><td>77</td></tr><tr><td>Filler 78 B.V.</td><td>78</td></tr><tr><td>Filler 79 B.V.</td><td>79</td></tr><tr><td>Filler 80 B.V.</td><td>80</td></tr><tr><td>Filler 81 B.V.</td><td>81</td></tr><tr><td>Filler 82 B.V.</td><td>82</td></tr><tr><td>Filler 83 B.V.</td><td>83</td></tr><tr><td>Filler 84 B.V.</td><td>84</td></tr><tr><td>Filler 85 B.V.</td><td>85</td></tr><tr><td>Filler 86 B.V.</td><td>86</td></tr><tr><td>Filler 87 B.V.</td><td>87</td></tr><tr><td>Filler 88 B.V.</td><td>88</td></tr><tr><td>Filler 89 B.V.</td><td>89</td></tr><tr><td>Filler 90 B.V.</td><td>90</td></tr><tr><td>Filler 91 B.V.</td><td>91</td></tr><tr><td>Filler 92 B.V.</td><td>92</td></tr><tr><td>Filler 93 B.V.</td><td>93</td></tr><tr><td>Filler 94 B.V.</td><td>94</td></tr><tr><td>Filler 95 B.V.</td><td>95</td></tr><tr><td>Filler 96 B.V.</td><td>96</td></tr><tr><td>Filler 97 B.V.</td><td>97</td></tr><tr><td>Filler 98 B.V.</td><td>98</td></tr><tr><td>Filler 99 B.V.</td><td>99</td></tr><tr><td>Filler 100 B.V.</td><td>100</td></tr><tr><td>Filler 101 B.V.</td><td>101</td></tr><tr><td>Filler 102 B.V.</td><td>102</td></tr><tr><td>Filler 103 B.V.</td><td>103</td></tr><tr><td>Filler 104 B.V.</td><td>104</td></tr><tr><td>Filler 105 B.V.</td><td>105</td></tr><tr><td>Filler 106 B.V.</td><td>106</td></tr><tr><td>Filler 107 B.V.</td><td>107</td></tr><tr><td>Filler 108 B.V.</td><td>108</td></tr><tr><td>Filler 109 B.V.</td><td>109</td></tr><tr><td>Filler 110 B.V.</td><td>110</td></tr><tr><td>Filler 111 B.V.</td><td>111</td></tr><tr><td>Filler 112 B.V.</td><td>112</td></tr><tr><td>Filler 113 B.V.</td><td>113</td></tr><tr><td>Filler 114 B.V.</td><td>114</td></tr><tr><td>Filler 115 B.V.</td><td>115</td></tr><tr><td>Filler 116 B.V.</td><td>116</td></tr><tr><td>Filler 117 B.V.</td><td>117</td></tr><tr><td>Filler 118 B.V.</td><td>118</td></tr><tr><td>Filler 119 B.V.</td><td>119</td></tr><tr><td>Adyen N.V.</td><td>34259528</td></tr><tr><td>&quot;AAE&quot; Advanced &amp; Co B.V.</td><td>1</td></tr></table>";
  const ok: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => page });
  const down: FetchLike = async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => "" });

  it("downloads, caches, and falls back to the cached copy when the site is down", async () => {
    expect((await netherlandsRegisterLoader(dir, ok)()).get("NL")?.has("adyen n.v.")).toBe(true);
    const old = new Date(Date.now() - 30 * 86_400_000);
    utimesSync(join(dir, "registers", "nl.json"), old, old);
    expect((await netherlandsRegisterLoader(dir, down)()).get("NL")?.has("adyen n.v.")).toBe(true);
  });
});
