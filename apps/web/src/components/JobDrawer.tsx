import type { JobDTO } from "@shorebound/core";
import { ArrowUpRight, Quote, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { timeAgo } from "../api";
import { COUNTRY_NAMES, CountryChip, RelocationBadge, SponsorshipBadge } from "./Badges";

function Evidence({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface2 p-3.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <Quote size={12} /> {label}
      </div>
      <p className="text-[13px] leading-relaxed">{text}</p>
    </div>
  );
}

export function JobDrawer({ job, onClose }: { job: JobDTO | null; onClose: () => void }) {
  useEffect(() => {
    if (!job) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [job, onClose]);

  return (
    <AnimatePresence>
      {job && (
        <>
          <motion.div
            key="overlay" className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
          />
          <motion.aside
            key="panel" role="dialog" aria-label={job.title}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-line bg-surface shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <div className="flex items-start gap-3 border-b border-line p-5">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center gap-2"><CountryChip code={job.country} /><span className="text-xs text-muted">{timeAgo(job.postedAt)}</span></div>
                <h2 className="text-lg font-semibold leading-snug tracking-tight">{job.title}</h2>
                <p className="mt-0.5 text-sm text-muted">{job.company} · {job.city ? `${job.city}, ` : ""}{COUNTRY_NAMES[job.country] ?? job.country}</p>
                <div className="mt-3 flex flex-wrap gap-2"><SponsorshipBadge job={job} /><RelocationBadge job={job} /></div>
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-muted hover:bg-surface2 hover:text-ink"><X size={18} /></button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {job.sponsorship.evidence && <Evidence label="Sponsorship evidence" text={job.sponsorship.evidence} />}
              {job.relocation.evidence && <Evidence label="Relocation evidence" text={job.relocation.evidence} />}
              <div>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Description</h3>
                <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink/90">{job.description || "No description provided."}</p>
              </div>
            </div>

            <div className="border-t border-line p-4">
              <a
                href={job.url} target="_blank" rel="noreferrer noopener"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                Open original posting <ArrowUpRight size={16} />
              </a>
              <p className="mt-2 text-center text-[11px] text-muted">Always check the posting and the official visa rules before applying.</p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
