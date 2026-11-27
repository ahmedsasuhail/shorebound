/**
 * User keyword filters. Excluded words are matched in the TITLE only (descriptions mention everything, so excluding
 * on them would hide good jobs: "we migrated off PHP"). Must-have words are matched in title or description, and any
 * one of them is enough. Matching is case-insensitive and whole-word, and works for "c++", "node.js", ".net".
 */
export interface KeywordFilter {
  include: string[];
  exclude: string[];
}

export type KeywordVerdict = { ok: true } | { ok: false; reason: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word matcher; letters/digits on either side mean "inside another word". */
export function keywordRegex(word: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(word.trim())}(?![\\p{L}\\p{N}])`, "iu");
}

const clean = (words: string[]) => [...new Set(words.map((w) => w.trim()).filter(Boolean))];

export function checkKeywords(title: string, description: string, f: KeywordFilter): KeywordVerdict {
  const banned = clean(f.exclude).find((w) => keywordRegex(w).test(title));
  if (banned) return { ok: false, reason: `title contains "${banned}"` };
  const wanted = clean(f.include);
  if (wanted.length && !wanted.some((w) => keywordRegex(w).test(`${title}\n${description}`)))
    return { ok: false, reason: "none of your must-have keywords" };
  return { ok: true };
}
