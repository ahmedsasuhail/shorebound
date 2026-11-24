import { motion } from "motion/react";

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="font-semibold tracking-tight">{title}</h2>
      {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: React.ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-full bg-surface2 p-0.5 text-sm font-medium">
      {options.map((o) => (
        <button key={String(o.v)} onClick={() => onChange(o.v)} className="relative rounded-full px-4 py-1.5">
          {value === o.v && <motion.span layoutId={`seg-${options.map((x) => x.v).join("-")}`} className="absolute inset-0 rounded-full bg-surface shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
          <span className={`relative inline-flex items-center gap-1.5 ${value === o.v ? "text-accentink" : "text-muted"}`}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
