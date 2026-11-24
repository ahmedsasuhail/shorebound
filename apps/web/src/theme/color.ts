/** OKLCH → sRGB and WCAG contrast. Used by the palette test; no runtime dependency on the UI. */

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/** Linear sRGB of an OKLCH colour (Björn Ottosson's OKLab matrices). */
function toLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

/** True when the colour is representable in sRGB (otherwise browsers silently remap it). */
export function inGamut(color: Oklch, epsilon = 1e-3): boolean {
  return toLinearSrgb(color).every((v) => v >= -epsilon && v <= 1 + epsilon);
}

/** WCAG relative luminance (0 black … 1 white). */
export function luminance(color: Oklch): number {
  const [r, g, b] = toLinearSrgb(color).map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio (1 … 21). */
export function contrast(a: Oklch, b: Oklch): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Parses `oklch(0.55 0.185 36)`. */
export function parseOklch(value: string): Oklch {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(value);
  if (!m) throw new Error(`Not an oklch() colour: ${value}`);
  return { l: Number(m[1]), c: Number(m[2]), h: Number(m[3]) };
}
