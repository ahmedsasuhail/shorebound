import { describe, expect, it } from "vitest";
import { cases } from "./cases.js";
import { classify } from "./classify.js";

describe("sponsorship classifier", () => {
  for (const c of cases) {
    it(`${c.why}: ${c.text.slice(0, 60)}`, () => {
      const r = classify(c.text, { country: c.country });
      expect({ sponsorship: r.sponsorship, relocation: r.relocation }).toEqual({
        sponsorship: c.sponsorship,
        relocation: c.relocation,
      });
    });
  }

  it("returns the deciding clause as evidence", () => {
    const r = classify("Great team. We cannot provide visa sponsorship. Free lunch.");
    expect(r.sponsorship).toBe("negative");
    expect(r.sponsorshipEvidence).toBe("We cannot provide visa sponsorship.");
  });
});
