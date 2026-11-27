import { Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

/** Editable list of short words shown as removable chips, with an inline "add" field. */
export function ChipInput({
  values,
  onChange,
  placeholder,
  label,
  tone = "accent",
  lowercase = false,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  /** Accessible name for the add field, e.g. "skill". */
  label: string;
  tone?: "accent" | "bad";
  lowercase?: boolean;
}) {
  const [adding, setAdding] = useState("");
  const add = () => {
    const raw = adding.trim();
    const v = lowercase ? raw.toLowerCase() : raw;
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setAdding("");
  };
  const chip =
    tone === "bad"
      ? "bg-badsoft text-badink [&_button:hover]:bg-bad [&_button:hover]:text-onaccent"
      : "bg-accentsoft text-accentink [&_button:hover]:bg-accent [&_button:hover]:text-onaccent";
  return (
    <div className="flex flex-wrap gap-1.5">
      <AnimatePresence initial={false}>
        {values.map((v) => (
          <motion.span
            key={v}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1.5 text-xs font-medium ${chip}`}
          >
            {v}
            <button
              aria-label={`Remove ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="rounded-full p-0.5"
            >
              <X size={11} />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="inline-flex items-center rounded-full border border-dashed border-line pl-3 pr-1"
      >
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder={placeholder}
          aria-label={`Add ${label}`}
          maxLength={40}
          className="w-28 bg-transparent py-1 text-xs outline-none"
        />
        <button type="submit" aria-label={`Add ${label}`} className="rounded-full p-1 text-muted hover:text-accent">
          <Plus size={12} />
        </button>
      </form>
    </div>
  );
}
