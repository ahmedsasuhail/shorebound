import type { JobDTO } from "@shorebound/core";
import { BadgeCheck, Globe2, HelpCircle, Plane, ShieldAlert, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export function Pill({ tone, icon, children }: { tone: "good" | "info" | "warn" | "bad" | "muted"; icon?: ReactNode; children: ReactNode }) {
  const tones = {
    good: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25",
    info: "bg-sky-500/12 text-sky-700 dark:text-sky-300 ring-sky-500/25",
    warn: "bg-amber-500/14 text-amber-700 dark:text-amber-300 ring-amber-500/30",
    bad: "bg-rose-500/12 text-rose-700 dark:text-rose-300 ring-rose-500/25",
    muted: "bg-surface2 text-muted ring-line",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

export function SponsorshipBadge({ job }: { job: JobDTO }) {
  switch (job.sponsorship.status) {
    case "confirmed_text": return <Pill tone="good" icon={<BadgeCheck size={12} />}>Sponsorship stated</Pill>;
    case "confirmed_register": return <Pill tone="good" icon={<BadgeCheck size={12} />}>Registered sponsor</Pill>;
    case "visa_source": return <Pill tone="info" icon={<Sparkles size={12} />}>Visa-filtered board</Pill>;
    case "country_norm": return <Pill tone="info" icon={<Globe2 size={12} />}>Usual here</Pill>;
    case "possible": return <Pill tone="warn" icon={<HelpCircle size={12} />}>Visa-eligible salary · unconfirmed</Pill>;
    case "negative": return <Pill tone="bad" icon={<ShieldAlert size={12} />}>No sponsorship</Pill>;
    default: return <Pill tone="muted">Sponsorship unclear</Pill>;
  }
}

export function RelocationBadge({ job }: { job: JobDTO }) {
  if (job.relocation.status === "offered") return <Pill tone="warn" icon={<Plane size={12} />}>Relocation offered</Pill>;
  if (job.relocation.status === "mentioned") return <Pill tone="muted" icon={<Plane size={12} />}>Relocation mentioned</Pill>;
  return null;
}

export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", CA: "Canada", GB: "United Kingdom", IE: "Ireland", DE: "Germany", AE: "UAE",
  SA: "Saudi Arabia", QA: "Qatar", SG: "Singapore", MY: "Malaysia", TH: "Thailand", FR: "France",
  CH: "Switzerland", NL: "Netherlands",
};

/** Flag emoji do not render on Windows, so use a code chip. */
export function CountryChip({ code, active, onClick }: { code: string; active?: boolean; onClick?: () => void }) {
  const cls = `inline-flex h-6 min-w-8 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold tracking-wide ${active ? "bg-accent text-white" : "bg-surface2 text-muted"}`;
  return onClick ? <button onClick={onClick} className={cls}>{code}</button> : <span className={cls}>{code}</span>;
}
