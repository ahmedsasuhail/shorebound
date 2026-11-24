import { FileText, Lock, Trash2, UploadCloud } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { useRemoveResume, useResume, useUploadResume } from "../api";
import { Section } from "./Section";

export function ResumeCard() {
  const resume = useResume();
  const upload = useUploadResume();
  const remove = useRemoveResume();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const info = resume.data?.resume;
  const take = (f?: File) => f && upload.mutate(f);

  return (
    <Section title="Resume" hint="Used as the basis for your skills, role and experience. Stored only on this machine.">
      <input ref={input} type="file" hidden accept=".pdf,.docx,.txt,.md" onChange={(e) => take(e.target.files?.[0])} />
      {info ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-4 rounded-xl border border-line bg-surface2 p-4"
        >
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-accentsoft text-accentink">
            <FileText size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{info.originalName}</div>
            <div className="text-xs text-muted">
              {(info.bytes / 1024).toFixed(0)} KB · saved {new Date(info.uploadedAt).toLocaleDateString()}
            </div>
          </div>
          <button
            onClick={() => input.current?.click()}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-accentink hover:bg-accentsoft"
          >
            Replace
          </button>
          <button
            onClick={() => remove.mutate()}
            aria-label="Remove resume"
            className="rounded-lg p-2 text-muted hover:bg-badsoft hover:text-badink"
          >
            <Trash2 size={16} />
          </button>
        </motion.div>
      ) : (
        <motion.div
          animate={{ scale: drag ? 1.015 : 1, borderColor: drag ? "var(--accent)" : "var(--border)" }}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            take(e.dataTransfer.files[0]);
          }}
          onClick={() => input.current?.click()}
          className="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-10 text-center"
        >
          <motion.div
            animate={{ y: drag ? -4 : 0 }}
            className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accentsoft text-accentink"
          >
            <UploadCloud size={24} />
          </motion.div>
          <p className="text-sm font-medium">Drop your resume here, or click to browse</p>
          <p className="mt-1 text-xs text-muted">PDF, DOCX, TXT or MD · up to 10 MB</p>
        </motion.div>
      )}
      {upload.error && <p className="mt-3 text-sm text-badink">{(upload.error as Error).message}</p>}
      {upload.data?.parseError && <p className="mt-3 text-sm text-cautionink">{upload.data.parseError}</p>}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <Lock size={12} /> Read on this machine only. Nothing is uploaded anywhere.
      </p>
    </Section>
  );
}
