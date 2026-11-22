import { describe, expect, it } from "vitest";
import { cases } from "./cases.js";

// Enabled once `classify` exists. Until then the table is reviewed by hand (see cases.ts).
describe.skip("sponsorship classifier", () => {
  for (const c of cases) {
    it(`${c.why}: ${c.text.slice(0, 60)}`, () => {
      // const r = classify(c.text, { country: c.country });
      // expect(r.sponsorship).toBe(c.sponsorship);
      // expect(r.relocation).toBe(c.relocation);
      expect(c).toBeDefined();
    });
  }
});
