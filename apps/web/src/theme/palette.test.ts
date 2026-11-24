import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrast, inGamut, parseOklch, type Oklch } from "./color.js";

const css = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8");

/** Reads `--token: oklch(...)` declarations from the `:root {}` or `.dark {}` block. */
function theme(selector: ":root" | ".dark"): Record<string, Oklch> {
  const start = css.indexOf(`\n${selector} {`);
  const block = css.slice(start, css.indexOf("\n}", start));
  const tokens: Record<string, Oklch> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(oklch\([^)]*\))/g)) tokens[m[1]!] = parseOklch(m[2]!);
  return tokens;
}

const TEXT_AA = 4.5; // WCAG AA, normal text
const MARK_AA = 3; // WCAG AA, graphical objects (ring strokes, rails)

/** [foreground, background, minimum contrast] */
const PAIRS: [string, string, number][] = [
  ["text", "bg", TEXT_AA],
  ["text", "surface", TEXT_AA],
  ["text", "surface-2", TEXT_AA],
  ["muted", "bg", TEXT_AA],
  ["muted", "surface", TEXT_AA],
  ["muted", "surface-2", TEXT_AA],
  ["on-accent", "accent", TEXT_AA],
  ["accent-ink", "accent-soft", TEXT_AA],
  ["accent-ink", "surface", TEXT_AA],
  ["good-ink", "good-soft", TEXT_AA],
  ["info-ink", "info-soft", TEXT_AA],
  ["caution-ink", "caution-soft", TEXT_AA],
  ["bad-ink", "bad-soft", TEXT_AA],
  ["accent", "surface", MARK_AA],
  ["good", "surface", MARK_AA],
  ["info", "surface", MARK_AA],
  ["caution", "surface", MARK_AA],
  ["bad", "surface", MARK_AA],
];

describe.each([":root", ".dark"] as const)("palette (%s)", (selector) => {
  const t = theme(selector);

  it("defines every token", () => {
    for (const [fg, bg] of PAIRS) {
      expect(t[fg], `--${fg}`).toBeDefined();
      expect(t[bg], `--${bg}`).toBeDefined();
    }
  });

  it("keeps every token inside the sRGB gamut, so tested colours are the rendered colours", () => {
    for (const [name, color] of Object.entries(t)) expect(inGamut(color), `--${name}`).toBe(true);
  });

  it.each(PAIRS)("%s on %s reaches the required contrast (%s)", (fg, bg, min) => {
    expect(contrast(t[fg]!, t[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
  });

  it("status marks differ in hue AND lightness, so they are not told apart by red-vs-green alone", () => {
    const marks = ["good", "info", "caution", "bad"].map((k) => t[k]!);
    for (let i = 0; i < marks.length; i++) {
      for (let j = i + 1; j < marks.length; j++) {
        const hueGap = Math.min(Math.abs(marks[i]!.h - marks[j]!.h), 360 - Math.abs(marks[i]!.h - marks[j]!.h));
        expect(hueGap).toBeGreaterThan(30);
      }
    }
    // good vs bad specifically (the classic colour-blind trap): clearly different lightness as well as hue
    expect(Math.abs(t.good!.l - t.bad!.l)).toBeGreaterThan(0.01);
  });
});

describe("the two themes", () => {
  it("define the same set of tokens", () => {
    expect(Object.keys(theme(".dark")).sort()).toEqual(Object.keys(theme(":root")).sort());
  });
});
