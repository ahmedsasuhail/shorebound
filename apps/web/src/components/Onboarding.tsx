import { FileUser, Gauge, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useResume, useSaveProfile } from "../api";
import { ResumeCard } from "./ResumeCard";

const STEPS = [
  {
    icon: FileUser,
    title: "Your resume sets the baseline",
    text: "Skills, years of experience and level are read on this machine, then you can correct them.",
  },
  {
    icon: Gauge,
    title: "Jobs are scored against you",
    text: "Only roles that fit your stack and seniority and show a sponsorship signal are listed.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    text: "The file never leaves your computer. No account, no upload.",
  },
];

/** Shown instead of the job list until a profile exists: an unranked list of every job would mislead. */
export function Onboarding() {
  const resume = useResume();
  const save = useSaveProfile();
  const hasFile = Boolean(resume.data?.resume);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Start with your resume</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Shorebound ranks jobs by how well they fit you. Without a resume there's nothing to judge fit against, so the
          job list stays hidden.
        </p>
      </div>

      <ResumeCard />

      {hasFile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200"
        >
          We saved the file but couldn't read skills from it automatically (scanned PDFs are the usual cause).{" "}
          <button
            className="font-semibold underline"
            onClick={() =>
              save.mutate({ skills: [], yearsExperience: null, seniority: "mid", families: [], title: null })
            }
          >
            Enter your details manually
          </button>
        </motion.div>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
            className="rounded-2xl border border-line bg-surface p-4"
          >
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-accentsoft text-accentink">
              <s.icon size={18} />
            </div>
            <div className="text-sm font-semibold">{s.title}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.text}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
