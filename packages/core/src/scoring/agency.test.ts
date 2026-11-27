import { describe, expect, it } from "vitest";
import { detectAgency } from "./agency.js";

describe("detectAgency", () => {
  it.each([
    ["Randstad Pte. Limited", ""],
    ["Michael Page International", ""],
    ["Robert Walters (Singapore) Pte Ltd", ""],
    ["Acme Recruitment Pte Ltd", ""],
    ["Bright Staffing Solutions", ""],
    ["Peak Talent Solutions", ""],
    ["Unnamed", "We are hiring on behalf of our client, a leading bank."],
    ["Unnamed", "Our client is a fast-growing fintech in Singapore."],
    ["Unnamed", "EA Licence No: 16S8060 | Reg No: R1219865"],
    ["Unnamed", "EA No. 11C3333. Registration No: R1101234"],
  ])("flags %s", (company, text) => {
    expect(detectAgency(company, text).agency).toBe(true);
  });

  it.each([
    ["Hudson River Trading", "We build trading systems."],
    ["Okta", "We do not accept resumes from recruitment agencies or any recruitment agency."],
    ["Deliveroo", "Our clients love the app. Our customer is at the centre of what we do."],
    ["Monzo", "Join our talent team? No: this is a backend role. We work with clients across the UK."],
    ["Pagerduty", "Incident response platform."],
  ])("does not flag %s", (company, text) => {
    expect(detectAgency(company, text).agency).toBe(false);
  });

  it("explains the decision", () => {
    expect(detectAgency("Hays", "").evidence).toMatch(/Hays is a staffing/);
    expect(detectAgency("X", "Working on behalf of a client in Berlin.").evidence).toMatch(/on behalf of a client/);
  });
});
