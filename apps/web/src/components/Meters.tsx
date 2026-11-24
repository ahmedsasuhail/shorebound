import type { JobDTO } from "@shorebound/core";
import { AlertTriangle } from "lucide-react";
import { motion } from "motion/react";

/** Score-ring band colours: theme tokens, so both themes use their validated, colour-blind-separated values. */
const BAND = { high: "var(--good)", medium: "var(--caution)", low: "var(--bad)" } as const;

/** Animated ring for the 0–100 confidence score. Dashed track when coverage is partial. */
export function ConfidenceRing({ job, size = 46 }: { job: JobDTO; size?: number }) {
  const c = job.confidence;
  if (!c) return null;
  const r = size / 2 - 4;
  const len = 2 * Math.PI * r;
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      title={`Confidence ${c.score}/100 · based on ${Math.round(c.coverage * 100)}% of signals`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={4}
          strokeDasharray={c.coverage < 1 ? "3 3" : undefined}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={BAND[c.band]}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={len}
          initial={{ strokeDashoffset: len }}
          animate={{ strokeDashoffset: len * (1 - c.score / 100) }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
        />
      </svg>
      <span className="absolute text-[12px] font-bold tabular-nums">{c.score}</span>
    </div>
  );
}

export function MatchPill({ job }: { job: JobDTO }) {
  if (!job.match) return null;
  const s = job.match.score;
  const tone =
    s >= 75 ? "bg-accent text-onaccent" : s >= 55 ? "bg-accentsoft text-accentink" : "bg-surface2 text-muted";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${tone}`}>{s}% match</span>;
}

function Bar({ label, value, weight }: { label: string; value: number | null; weight: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[12px]">
        <span className={value === null ? "text-muted" : ""}>
          {label} <span className="text-muted">· {weight}</span>
        </span>
        <span className="tabular-nums text-muted">
          {value === null ? "no data yet" : `${Math.round(value * 100)}%`}
        </span>
      </div>
      <div
        className={`h-1.5 overflow-hidden rounded-full ${value === null ? "border border-dashed border-line" : "bg-surface2"}`}
      >
        {value !== null && (
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${value * 100}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        )}
      </div>
    </div>
  );
}

export function WhyPanel({ job }: { job: JobDTO }) {
  const c = job.confidence;
  return (
    <div className="space-y-4">
      {c && c.flags.length > 0 && (
        <div className="rounded-xl border border-bad/40 bg-badsoft p-3.5 text-[13px] text-badink">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={14} /> Possible scam signals
          </div>
          <ul className="list-disc pl-5">
            {c.flags.map((f) => (
              <li key={f.id}>{f.label}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-[12px] opacity-80">
            Never pay to get a job. Check with the MEA / eMigrate if in doubt.
          </p>
        </div>
      )}
      {job.match && (
        <div className="rounded-xl border border-line p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Fit to your profile</h4>
            <MatchPill job={job} />
          </div>
          <ul className="space-y-1 text-[13px]">
            {job.match.reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </div>
      )}
      {c && (
        <div className="rounded-xl border border-line p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Confidence {c.score}/100</h4>
            <span className="text-[11px] text-muted">based on {Math.round(c.coverage * 100)}% of signals</span>
          </div>
          <div className="space-y-2.5">
            {c.factors.map((f) => (
              <Bar key={f.id} label={f.label} value={f.value} weight={f.weight} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
