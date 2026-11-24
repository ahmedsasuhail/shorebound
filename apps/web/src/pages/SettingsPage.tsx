import {
  Database,
  FileUser,
  Globe2,
  Monitor,
  Moon,
  Palette,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  useCatalog,
  useProfile,
  useSaveProfile,
  useSaveSettings,
  useSettings,
  useSources,
  type CatalogCountry,
  type Profile,
} from "../api";
import { CountryChip } from "../components/Badges";
import { ResumeCard } from "../components/ResumeCard";
import { Field, Section, Segmented } from "../components/Section";
import { useNow } from "../hooks/useNow";

const REGIONS: Record<string, string> = {
  north_america: "North America",
  europe: "Europe",
  middle_east: "Middle East",
  southeast_asia: "Southeast Asia",
  east_asia: "East Asia",
  oceania: "Oceania",
};

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
    <Section
      title="Your profile"
      hint={
        p.source === "user"
          ? "Edited by you. Used to rank jobs by fit."
          : "Read from your resume. Fix anything it got wrong; jobs re-rank instantly."
      }
    >
      <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-2 text-sm font-medium">Skills</div>
          <div className="flex flex-wrap gap-1.5">
            <AnimatePresence initial={false}>
              {p.skills.map((sk) => (
                <motion.span
                  key={sk}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="inline-flex items-center gap-1 rounded-full bg-accentsoft py-1 pl-3 pr-1.5 text-xs font-medium text-accentink"
                >
                  {sk}
                  <button
                    aria-label={`Remove ${sk}`}
                    onClick={() => put({ skills: p.skills.filter((x) => x !== sk) })}
                    className="rounded-full p-0.5 hover:bg-accent hover:text-onaccent"
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
                placeholder="add skill"
                className="w-24 bg-transparent py-1 text-xs outline-none"
              />
              <button type="submit" aria-label="Add skill" className="rounded-full p-1 text-muted hover:text-accent">
                <Plus size={12} />
              </button>
            </form>
          </div>
        </div>
        <div className="space-y-4 sm:w-56">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Years of experience</span>
            <input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={p.yearsExperience ?? ""}
              onChange={(e) => put({ yearsExperience: e.target.value === "" ? null : Number(e.target.value) })}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Level</span>
            <select
              value={p.seniority}
              onChange={(e) => put({ seniority: e.target.value as Profile["seniority"] })}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm capitalize outline-none focus:border-accent"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {p.families.length > 0 && (
        <p className="mt-4 text-xs text-muted">
          Role families: {p.families.join(", ")}
          {p.title ? ` · Title: ${p.title}` : ""}
        </p>
      )}
    </Section>
  );
}

/** A country added within this many days shows a "New" badge. */
const NEW_FOR_DAYS = 45;

function CountryCard({ c, on, toggle, now }: { c: CatalogCountry; on: boolean; toggle: () => void; now: number }) {
  const soon = c.status === "coming_soon";
  const isNew = !soon && c.since !== null && now - new Date(c.since).getTime() < NEW_FOR_DAYS * 86_400_000;
  return (
    <button
      disabled={soon}
      onClick={toggle}
      aria-pressed={on}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${soon ? "cursor-not-allowed border-dashed border-line opacity-50" : on ? "border-accent bg-accentsoft/60 shadow-sm" : "border-line hover:border-accent/50"}`}
    >
      <CountryChip code={c.code} active={on && !soon} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{c.name}</span>
          {isNew && (
            <span className="rounded-full bg-accent px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-onaccent">
              New
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted">
          {soon ? "Coming soon" : `Ease from India ${c.ease}/5 · ${c.confidence} confidence`}
        </div>
      </div>
    </button>
  );
}

function SourcesCard() {
  const sources = useSources();
  const settings = useSettings();
  const save = useSaveSettings();
  const s = settings.data;
  if (!s || !sources.data) return null;
  const toggle = (id: string) => {
    const off = s.sources.disabled.includes(id);
    save.mutate({
      sources: { disabled: off ? s.sources.disabled.filter((x) => x !== id) : [...s.sources.disabled, id] },
    });
  };
  return (
    <Section title="Sources" hint="Where Refresh looks for jobs. Switch off a source to make Refresh faster.">
      <div className="divide-y divide-line">
        {sources.data.sources.map((src) => {
          const on = !s.sources.disabled.includes(src.id);
          return (
            <label key={src.id} className="flex cursor-pointer items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{src.label}</div>
                <div className="text-xs text-muted">{src.description}</div>
              </div>
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(src.id)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </label>
          );
        })}
      </div>
    </Section>
  );
}

type CategoryId = "resume" | "countries" | "search" | "sponsorship" | "sources" | "appearance";

const CATEGORIES: { id: CategoryId; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "resume", label: "Resume & profile", hint: "What jobs are matched against", icon: FileUser },
  { id: "countries", label: "Countries", hint: "Where to look", icon: Globe2 },
  { id: "search", label: "Search & ranking", hint: "Window, fit, relocation", icon: SlidersHorizontal },
  { id: "sponsorship", label: "Sponsorship signals", hint: "What counts as evidence", icon: ShieldCheck },
  { id: "sources", label: "Sources", hint: "Where Refresh looks", icon: Database },
  { id: "appearance", label: "Appearance", hint: "Theme", icon: Palette },
];

const initialCategory = (): CategoryId => {
  const wanted = location.hash.replace("#settings/", "");
  return CATEGORIES.some((c) => c.id === wanted) ? (wanted as CategoryId) : "resume";
};

const IncludeHide = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <Segmented
    value={value ? "yes" : "no"}
    onChange={(v) => onChange(v === "yes")}
    options={[
      { v: "yes", label: "Include (marked)" },
      { v: "no", label: "Hide" },
    ]}
  />
);

function CountriesPanel() {
  const now = useNow();
  const settings = useSettings();
  const catalog = useCatalog();
  const save = useSaveSettings();
  const s = settings.data;
  if (!s) return null;
  const all = catalog.data?.countries ?? [];
  const grouped = Object.entries(REGIONS)
    .map(([region, label]) => ({ label, items: all.filter((c) => c.region === region) }))
    .filter((g) => g.items.length);
  const toggle = (code: string) =>
    save.mutate({
      countries: s.countries.includes(code) ? s.countries.filter((c) => c !== code) : [...s.countries, code],
    });
  return (
    <Section title="Countries" hint="Only countries with researched visa data can be switched on. More are coming.">
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <button
          className="rounded-full bg-surface2 px-3 py-1 text-muted hover:text-ink"
          onClick={() => save.mutate({ countries: all.filter((c) => c.status === "available").map((c) => c.code) })}
        >
          Select all
        </button>
        <button
          className="rounded-full bg-surface2 px-3 py-1 text-muted hover:text-ink"
          onClick={() => save.mutate({ countries: [] })}
        >
          Clear
        </button>
      </div>
      <div className="space-y-5">
        {grouped.map((g) => (
          <div key={g.label}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.label}</h3>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((c) => (
                <CountryCard
                  key={c.code}
                  c={c}
                  now={now}
                  on={s.countries.includes(c.code)}
                  toggle={() => toggle(c.code)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function SearchPanel() {
  const settings = useSettings();
  const save = useSaveSettings();
  const s = settings.data;
  if (!s) return null;
  return (
    <Section
      title="Search & ranking"
      hint="How far back to look, how closely a job must fit you, and what to do about relocation."
    >
      <div className="space-y-6">
        <Field label="Posted within">
          <Segmented
            value={s.search.lookbackDays}
            onChange={(d) => save.mutate({ search: { ...s.search, lookbackDays: d } })}
            options={[1, 3, 7, 14, 30].map((d) => ({ v: d, label: d === 1 ? "24h" : `${d} days` }))}
          />
        </Field>
        <Field
          label="How strict should the fit be?"
          help="Hides jobs that fit your resume less than this. Broad shows more, including near-misses; Strict only shows close fits. Non-engineering roles are always discarded."
        >
          <Segmented
            value={s.search.minMatch <= 47 ? 40 : s.search.minMatch <= 62 ? 55 : 70}
            onChange={(m) => save.mutate({ search: { ...s.search, minMatch: m } })}
            options={[
              { v: 40, label: "Broad" },
              { v: 55, label: "Balanced" },
              { v: 70, label: "Strict" },
            ]}
          />
        </Field>
        <Field
          label="Relocation"
          help="Only some postings state that the employer pays for relocation. “Bonus” ranks those higher; “Must be offered” shows only those."
        >
          <Segmented
            value={s.sponsorship.relocation}
            onChange={(r) => save.mutate({ sponsorship: { ...s.sponsorship, relocation: r } })}
            options={[
              { v: "required", label: "Must be offered" },
              { v: "bonus", label: "Bonus" },
              { v: "ignore", label: "Ignore" },
            ]}
          />
        </Field>
        <Field label="Jobs per company" help="Stops one employer filling the feed.">
          <Segmented
            value={s.search.maxPerCompany}
            onChange={(n) => save.mutate({ search: { ...s.search, maxPerCompany: n } })}
            options={[
              { v: 1, label: "1" },
              { v: 3, label: "3" },
              { v: 5, label: "5" },
              { v: 0, label: "No limit" },
            ]}
          />
        </Field>
      </div>
    </Section>
  );
}

function SponsorshipPanel() {
  const settings = useSettings();
  const save = useSaveSettings();
  const s = settings.data;
  if (!s) return null;
  return (
    <Section
      title="Sponsorship signals"
      hint="Every job needs some evidence that the employer can sponsor. These control the weaker kinds."
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-line bg-surface2 p-3.5 text-[13px] leading-relaxed">
          <b>Always shown:</b> the posting states sponsorship, or comes from a board that only lists visa-sponsoring
          jobs. <b>Always discarded:</b> postings that rule sponsorship out (“no sponsorship”, “must already live
          there”, “right to work required”).
        </div>
        <Field
          label="Employer is on an official sponsor register"
          help="Big employers on the UK sponsor register or Canada's foreign-worker list often don't mention visas in the posting. They are listed as “Employer on sponsor register”: the company can sponsor, but the posting doesn't say it will."
        >
          <IncludeHide
            value={s.sponsorship.includeRegister}
            onChange={(v) => save.mutate({ sponsorship: { ...s.sponsorship, includeRegister: v } })}
          />
        </Field>
        <Field
          label="Salary meets the visa threshold (Singapore)"
          help="Singapore has no sponsor register and few postings mention visas. Where the posted salary clears the Employment Pass minimum, the job is listed as “Visa-eligible salary · unconfirmed”. It does not mean the employer sponsors: ask before applying."
        >
          <IncludeHide
            value={s.sponsorship.includePossible}
            onChange={(v) => save.mutate({ sponsorship: { ...s.sponsorship, includePossible: v } })}
          />
        </Field>
      </div>
    </Section>
  );
}

function AppearancePanel() {
  const settings = useSettings();
  const save = useSaveSettings();
  const s = settings.data;
  if (!s) return null;
  const opt = (v: "system" | "light" | "dark", Icon: LucideIcon, label: string) => ({
    v,
    label: (
      <>
        <Icon size={14} />
        {label}
      </>
    ),
  });
  return (
    <Section title="Appearance">
      <Segmented
        value={s.appearance.theme}
        onChange={(t) => save.mutate({ appearance: { theme: t } })}
        options={[opt("system", Monitor, "System"), opt("light", Sun, "Light"), opt("dark", Moon, "Dark")]}
      />
    </Section>
  );
}

/** Two-pane settings: categories on the left, the selected category's content on the right. */
export function SettingsPage() {
  const [active, setActive] = useState<CategoryId>(initialCategory);
  const select = (id: CategoryId) => {
    setActive(id);
    history.replaceState(null, "", `#settings/${id}`);
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="mt-6 grid gap-6 md:grid-cols-[230px_minmax(0,1fr)]">
        <nav
          aria-label="Settings categories"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 md:sticky md:top-6 md:mx-0 md:flex-col md:self-start md:overflow-visible md:px-0"
        >
          {CATEGORIES.map((c) => {
            const on = c.id === active;
            return (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                aria-current={on ? "page" : undefined}
                className={`relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${on ? "text-accentink" : "text-muted hover:text-ink"}`}
              >
                {on && (
                  <motion.span
                    layoutId="settings-pill"
                    className="absolute inset-0 rounded-xl bg-accentsoft"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <c.icon size={18} className="relative shrink-0" />
                <span className="relative min-w-0">
                  <span className="block text-sm font-medium">{c.label}</span>
                  <span className="hidden text-[11px] opacity-80 md:block">{c.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              {active === "resume" && (
                <>
                  <ResumeCard />
                  <ProfileCard />
                </>
              )}
              {active === "countries" && <CountriesPanel />}
              {active === "search" && <SearchPanel />}
              {active === "sponsorship" && <SponsorshipPanel />}
              {active === "sources" && <SourcesCard />}
              {active === "appearance" && <AppearancePanel />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
