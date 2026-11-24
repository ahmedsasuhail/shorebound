import type { RefreshReport } from "../api";

/** Display names for country codes used in the feed (flag emoji do not render on Windows). */
export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  IE: "Ireland",
  DE: "Germany",
  AE: "UAE",
  SA: "Saudi Arabia",
  QA: "Qatar",
  SG: "Singapore",
  MY: "Malaysia",
  TH: "Thailand",
  FR: "France",
  CH: "Switzerland",
  NL: "Netherlands",
  BE: "Belgium",
};

/** "3h ago" style label. `now` is passed in so components stay pure. */
export function timeAgo(iso: string, now: number): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

/** One-line toast text for a finished refresh. */
export function refreshSummary(r: RefreshReport): string {
  const failed = r.sources.filter((s) => !s.ok);
  const added = r.sources.reduce((n, s) => n + (s.inserted ?? 0), 0);
  const parts = [`Updated: ${added} new job${added === 1 ? "" : "s"}`];
  if (failed.length)
    parts.push(
      `${failed.length} source${failed.length === 1 ? "" : "s"} failed (${failed.map((s) => s.id).join(", ")})`,
    );
  return parts.join(" · ");
}
