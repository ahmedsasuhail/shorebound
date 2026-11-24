import { FileText, Lock, Monitor, Moon, Plus, Sun, Trash2, UploadCloud, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { useCatalog, useProfile, useRemoveResume, useResume, useSaveProfile, useSaveSettings, useSettings, useUploadResume, type CatalogCountry, type Profile } from "../api";
import { CountryChip } from "../components/Badges";

const REGIONS: Record<string, string> = {
  north_america: "North America", europe: "Europe", middle_east: "Middle East", southeast_asia: "Southeast Asia",
  east_asia: "East Asia", oceania: "Oceania",
};

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="font-semibold tracking-tight">{title}</h2>
      {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: React.ReactNode }[]; onChange: (v: T) => void }) {
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

function ResumeCard() {
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
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-4 rounded-xl border border-line bg-surface2 p-4">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-accentsoft text-accentink"><FileText size={20} /></div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{info.originalName}</div>
            <div className="text-xs text-muted">{(info.bytes / 1024).toFixed(0)} KB · saved {new Date(info.uploadedAt).toLocaleDateString()}</div>
          </div>
          <button onClick={() => input.current?.click()} className="rounded-lg px-3 py-1.5 text-xs font-medium text-accentink hover:bg-accentsoft">Replace</button>
          <button onClick={() => remove.mutate()} aria-label="Remove resume" className="rounded-lg p-2 text-muted hover:bg-rose-500/10 hover:text-rose-500"><Trash2 size={16} /></button>
        </motion.div>
      ) : (
        <motion.div
          animate={{ scale: drag ? 1.015 : 1, borderColor: drag ? "var(--accent)" : "var(--border)" }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files[0]); }}
          onClick={() => input.current?.click()}
          className="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-10 text-center"
        >
          <motion.div animate={{ y: drag ? -4 : 0 }} className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accentsoft text-accentink"><UploadCloud size={24} /></motion.div>
          <p className="text-sm font-medium">Drop your resume here, or click to browse</p>
          <p className="mt-1 text-xs text-muted">PDF, DOCX, TXT or MD · up to 10 MB</p>
        </motion.div>
      )}
      {upload.error && <p className="mt-3 text-sm text-rose-500">{(upload.error as Error).message}</p>}
      {upload.data?.parseError && <p className="mt-3 text-sm text-amber-600">{upload.data.parseError}</p>}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Lock size={12} /> Read on this machine only. Nothing is uploaded anywhere.</p>
    </Section>
  );
}


const LEVELS: Profile["seniority"][] = ["junior", "mid", "senior", "lead", "manager"];

function ProfileCard() {
  const q = useProfile();
  const save = useSaveProfile();
  const [adding, setAdding] = useState("");
  const p = q.data?.profile;
  if (!p) return null;
  const put = (patch: Partial<Profile>) => {
    const { source: _s, ...rest } = { ...p, ...patch };
    save.mutate(rest);
  };
  const add = () => {
    const v = adding.trim().toLowerCase();
    if (v && !p.skills.includes(v)) put({ skills: [...p.skills, v] });
    setAdding("");
  };
  return (
    <Section title="Your profile" hint={p.source === "user" ? "Edited by you. Used to rank jobs by fit." : "Read from your resume. Fix anything it got wrong; jobs re-rank instantly."}>
      <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-2 text-sm font-medium">Skills</div>
          <div className="flex flex-wrap gap-1.5">
            <AnimatePresence initial={false}>
              {p.skills.map((sk) => (
                <motion.span key={sk} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  className="inline-flex items-center gap-1 rounded-full bg-accentsoft py-1 pl-3 pr-1.5 text-xs font-medium text-accentink">
                  {sk}
                  <button aria-label={`Remove ${sk}`} onClick={() => put({ skills: p.skills.filter((x) => x !== sk) })} className="rounded-full p-0.5 hover:bg-accent hover:text-white"><X size={11} /></button>
                </motion.span>
              ))}
            </AnimatePresence>
            <form onSubmit={(e) => { e.preventDefault(); add(); }} className="inline-flex items-center rounded-full border border-dashed border-line pl-3 pr-1">
              <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="add skill" className="w-24 bg-transparent py-1 text-xs outline-none" />
              <button type="submit" aria-label="Add skill" className="rounded-full p-1 text-muted hover:text-accent"><Plus size={12} /></button>
            </form>
          </div>
        </div>
        <div className="space-y-4 sm:w-56">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Years of experience</span>
            <input type="number" min={0} max={50} step={0.5} value={p.yearsExperience ?? ""}
              onChange={(e) => put({ yearsExperience: e.target.value === "" ? null : Number(e.target.value) })}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Level</span>
            <select value={p.seniority} onChange={(e) => put({ seniority: e.target.value as Profile["seniority"] })}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm capitalize outline-none focus:border-accent">
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </div>
      </div>
      {p.families.length > 0 && <p className="mt-4 text-xs text-muted">Role families: {p.families.join(", ")}{p.title ? ` · Title: ${p.title}` : ""}</p>}
    </Section>
  );
}

function CountryCard({ c, on, toggle }: { c: CatalogCountry; on: boolean; toggle: () => void }) {
  const soon = c.status === "coming_soon";
  return (
    <button
      disabled={soon} onClick={toggle} aria-pressed={on}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${soon ? "cursor-not-allowed border-dashed border-line opacity-50" : on ? "border-accent bg-accentsoft/60 shadow-sm" : "border-line hover:border-accent/50"}`}
    >
      <CountryChip code={c.code} active={on && !soon} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{c.name}</div>
        <div className="text-[11px] text-muted">{soon ? "Coming soon" : `Ease from India ${c.ease}/5 · ${c.confidence} confidence`}</div>
      </div>
    </button>
  );
}

export function SettingsPage() {
  const settings = useSettings();
  const catalog = useCatalog();
  const save = useSaveSettings();
  const s = settings.data;
  if (!s) return null;

  const grouped = Object.entries(REGIONS)
    .map(([region, label]) => ({ label, items: (catalog.data?.countries ?? []).filter((c) => c.region === region) }))
    .filter((g) => g.items.length);
  const toggle = (code: string) => save.mutate({ countries: s.countries.includes(code) ? s.countries.filter((c) => c !== code) : [...s.countries, code] });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <ResumeCard />
      <ProfileCard />

      <Section title="Countries" hint="Only countries with researched visa data can be switched on. More are coming.">
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <button className="rounded-full bg-surface2 px-3 py-1 text-muted hover:text-ink" onClick={() => save.mutate({ countries: (catalog.data?.countries ?? []).filter((c) => c.status === "available").map((c) => c.code) })}>Select all</button>
          <button className="rounded-full bg-surface2 px-3 py-1 text-muted hover:text-ink" onClick={() => save.mutate({ countries: [] })}>Clear</button>
        </div>
        <div className="space-y-5">
          {grouped.map((g) => (
            <div key={g.label}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.label}</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((c) => <CountryCard key={c.code} c={c} on={s.countries.includes(c.code)} toggle={() => toggle(c.code)} />)}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Search" hint="How far back to look, and how strict to be.">
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-sm font-medium">Posted within</div>
            <Segmented value={s.search.lookbackDays} onChange={(d) => save.mutate({ search: { ...s.search, lookbackDays: d } })}
              options={[1, 3, 7, 14, 30].map((d) => ({ v: d, label: d === 1 ? "24h" : `${d} days` }))} />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Relocation</div>
            <Segmented value={s.sponsorship.relocation} onChange={(r) => save.mutate({ sponsorship: { ...s.sponsorship, relocation: r } })}
              options={[{ v: "required", label: "Must be offered" }, { v: "bonus", label: "Bonus" }, { v: "ignore", label: "Ignore" }]} />
            <p className="mt-2 text-xs text-muted">Sponsorship is always required. Jobs that expect you to already live there or hold the right to work are hidden by default.</p>
          </div>
        </div>
      </Section>

      <Section title="Appearance">
        <Segmented value={s.appearance.theme} onChange={(t) => save.mutate({ appearance: { theme: t } })}
          options={[{ v: "system", label: <><Monitor size={14} />System</> }, { v: "light", label: <><Sun size={14} />Light</> }, { v: "dark", label: <><Moon size={14} />Dark</> }]} />
      </Section>
    </div>
  );
}
