import type { JobDTO } from "@shorebound/core";
import { BadgeCheck, HelpCircle, Plane, ShieldAlert, Sparkles, Users } from "lucide-react";
import type { ReactNode } from "react";

export function Pill({
  tone,
  icon,
  children,
}: {
  tone: "good" | "info" | "warn" | "bad" | "muted";
  icon?: ReactNode;
  children: ReactNode;
}) {
  const tones = {
    good: "bg-goodsoft text-goodink ring-good/30",
    info: "bg-infosoft text-infoink ring-info/30",
    warn: "bg-cautionsoft text-cautionink ring-caution/40",
    bad: "bg-badsoft text-badink ring-bad/30",
    muted: "bg-surface2 text-muted ring-line",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}

export function SponsorshipBadge({ job }: { job: JobDTO }) {
  switch (job.sponsorship.status) {
    case "confirmed_text":
      return (
        <Pill tone="good" icon={<BadgeCheck size={12} />}>
          Sponsorship stated
        </Pill>
      );
    case "confirmed_register":
      // Employer-level: the company is licensed/approved, but the posting itself does not say it sponsors.
      return (
        <Pill tone="info" icon={<BadgeCheck size={12} />}>
          Employer on sponsor register
        </Pill>
      );
    case "visa_source":
      return (
        <Pill tone="info" icon={<Sparkles size={12} />}>
          Visa-filtered board
        </Pill>
      );
    case "possible":
      return (
        <Pill tone="warn" icon={<HelpCircle size={12} />}>
          Visa-eligible salary · unconfirmed
        </Pill>
      );
    case "negative":
      return (
        <Pill tone="bad" icon={<ShieldAlert size={12} />}>
          No sponsorship
        </Pill>
      );
    default:
      return <Pill tone="muted">Sponsorship unclear</Pill>;
  }
}

export function RelocationBadge({ job }: { job: JobDTO }) {
  if (job.relocation.status === "offered")
    return (
      <Pill tone="warn" icon={<Plane size={12} />}>
        Relocation offered
      </Pill>
    );
  if (job.relocation.status === "mentioned")
    return (
      <Pill tone="muted" icon={<Plane size={12} />}>
        Relocation mentioned
      </Pill>
    );
  return null;
}

/** Shown when the poster looks like a staffing agency or recruiter (only when the user chose to include them). */
export function AgencyBadge({ job }: { job: JobDTO }) {
  if (!job.agency) return null;
  return (
    <Pill tone="muted" icon={<Users size={12} />}>
      Recruiter posting
    </Pill>
  );
}

/** Flag emoji do not render on Windows, so use a code chip. */
export function CountryChip({ code, active, onClick }: { code: string; active?: boolean; onClick?: () => void }) {
  const cls = `inline-flex h-6 min-w-8 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold tracking-wide ${active ? "bg-accent text-onaccent" : "bg-surface2 text-muted"}`;
  return onClick ? (
    <button onClick={onClick} className={cls}>
      {code}
    </button>
  ) : (
    <span className={cls}>{code}</span>
  );
}
