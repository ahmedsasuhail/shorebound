import type { JobDTO } from "@shorebound/core";
import { ArrowUpRight, Clock, MapPin } from "lucide-react";
import { motion } from "motion/react";
import { COUNTRY_NAMES, timeAgo } from "../lib/format";
import { AgencyBadge, CountryChip, RelocationBadge, SponsorshipBadge } from "./Badges";
import { ConfidenceRing, MatchPill } from "./Meters";

const RAIL: Record<string, string> = {
  confirmed_text: "bg-good",
  confirmed_register: "bg-info",
  visa_source: "bg-info",
  possible: "bg-caution",
  negative: "bg-bad",
};

export function JobCard({ job, index, now, onOpen }: { job: JobDTO; index: number; now: number; onOpen: () => void }) {
  const fresh = now - new Date(job.postedAt).getTime() < 6 * 3_600_000;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.28, delay: Math.min(index, 12) * 0.035, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="group relative flex cursor-pointer gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-4 pl-5 shadow-sm transition-shadow hover:shadow-lg hover:shadow-accent/10"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${RAIL[job.sponsorship.status] ?? "bg-line"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CountryChip code={job.country} />
          <h3 className="truncate text-[15px] font-semibold tracking-tight">{job.title}</h3>
          {fresh && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-onaccent">
              New
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          <span className="font-medium text-ink/80">{job.company}</span>
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />
            {job.city ? `${job.city}, ` : ""}
            {COUNTRY_NAMES[job.country] ?? job.country}
            {job.workMode === "remote" ? " · Remote" : ""}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={12} />
            {timeAgo(job.postedAt, now)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <MatchPill job={job} />
          <SponsorshipBadge job={job} />
          <RelocationBadge job={job} />
          <AgencyBadge job={job} />
        </div>
      </div>
      <div className="self-center">
        <ConfidenceRing job={job} />
      </div>
      <a
        href={job.url}
        target="_blank"
        rel="noreferrer noopener"
        onClick={(e) => e.stopPropagation()}
        className="hidden h-9 shrink-0 items-center gap-1 self-center rounded-xl bg-surface2 px-3 text-xs font-semibold text-accentink transition-colors hover:bg-accent hover:text-onaccent sm:inline-flex"
      >
        Apply <ArrowUpRight size={14} />
      </a>
    </motion.article>
  );
}

export function JobSkeleton() {
  return (
    <div className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex-1 space-y-3">
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="flex gap-2">
          <div className="skeleton h-6 w-28 rounded-full" />
          <div className="skeleton h-6 w-32 rounded-full" />
        </div>
      </div>
    </div>
  );
}
