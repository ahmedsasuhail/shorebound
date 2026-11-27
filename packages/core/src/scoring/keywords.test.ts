import { describe, expect, it } from "vitest";
import { checkKeywords, keywordRegex } from "./keywords.js";

describe("keywordRegex", () => {
  it("matches whole words, including ones with symbols", () => {
    expect(keywordRegex("java").test("Senior Java Engineer")).toBe(true);
    expect(keywordRegex("java").test("JavaScript Engineer")).toBe(false);
    expect(keywordRegex("c++").test("C++ developer")).toBe(true);
    expect(keywordRegex("node.js").test("Backend (Node.js)")).toBe(true);
    expect(keywordRegex(".net").test("Senior .NET Engineer")).toBe(true);
    expect(keywordRegex("go").test("Google Cloud engineer")).toBe(false);
  });
});

describe("checkKeywords", () => {
  const desc = "We build APIs in TypeScript. We migrated off PHP last year.";

  it("passes everything when no keywords are set", () => {
    expect(checkKeywords("Backend Engineer", desc, { include: [], exclude: [] })).toEqual({ ok: true });
  });

  it("excludes on the title only", () => {
    expect(checkKeywords("PHP Developer", desc, { include: [], exclude: ["php"] }).ok).toBe(false);
    expect(checkKeywords("Backend Engineer", desc, { include: [], exclude: ["php"] }).ok).toBe(true);
  });

  it("needs any one must-have word in the title or description", () => {
    expect(checkKeywords("Backend Engineer", desc, { include: ["rust", "typescript"], exclude: [] }).ok).toBe(true);
    const r = checkKeywords("Backend Engineer", desc, { include: ["rust"], exclude: [] });
    expect(r).toEqual({ ok: false, reason: "none of your must-have keywords" });
  });

  it("ignores blank and duplicate entries", () => {
    expect(checkKeywords("Backend Engineer", desc, { include: [" ", ""], exclude: [""] }).ok).toBe(true);
  });
});
