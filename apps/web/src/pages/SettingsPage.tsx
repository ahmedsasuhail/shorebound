import { Monitor, Moon, Plus, Sun, X } from "lucide-react";
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
import { Section, Segmented } from "../components/Section";

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
                    className="rounded-full p-0.5 hover:bg-accent hover:text-white"
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

function CountryCard({ c, on, toggle }: { c: CatalogCountry; on: boolean; toggle: () => void }) {
  const soon = c.status === "coming_soon";
  return (
    <button
      disabled={soon}
      onClick={toggle}
      aria-pressed={on}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${soon ? "cursor-not-allowed border-dashed border-line opacity-50" : on ? "border-accent bg-accentsoft/60 shadow-sm" : "border-line hover:border-accent/50"}`}
    >
      <CountryChip code={c.code} active={on && !soon} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{c.name}</div>
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

export function SettingsPage() {
  const settings = useSettings();
  const catalog = useCatalog();
  const save = useSaveSettings();
  const s = settings.data;
  if (!s) return null;

  const grouped = Object.entries(REGIONS)
    .map(([region, label]) => ({ label, items: (catalog.data?.countries ?? []).filter((c) => c.region === region) }))
    .filter((g) => g.items.length);
  const toggle = (code: string) =>
    save.mutate({
      countries: s.countries.includes(code) ? s.countries.filter((c) => c !== code) : [...s.countries, code],
    });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <ResumeCard />
      <ProfileCard />

      <Section title="Countries" hint="Only countries with researched visa data can be switched on. More are coming.">
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <button
            className="rounded-full bg-surface2 px-3 py-1 text-muted hover:text-ink"
            onClick={() =>
              save.mutate({
                countries: (catalog.data?.countries ?? []).filter((c) => c.status === "available").map((c) => c.code),
              })
            }
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
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((c) => (
                  <CountryCard key={c.code} c={c} on={s.countries.includes(c.code)} toggle={() => toggle(c.code)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Search" hint="How far back to look, and how strict to be.">
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-sm font-medium">Posted within</div>
            <Segmented
              value={s.search.lookbackDays}
              onChange={(d) => save.mutate({ search: { ...s.search, lookbackDays: d } })}
              options={[1, 3, 7, 14, 30].map((d) => ({ v: d, label: d === 1 ? "24h" : `${d} days` }))}
            />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">How strict should the fit be?</div>
            <Segmented
              value={s.search.minMatch <= 47 ? 40 : s.search.minMatch <= 62 ? 55 : 70}
              onChange={(m) => save.mutate({ search: { ...s.search, minMatch: m, onlyMatching: true } })}
              options={[
                { v: 40, label: "Broad" },
                { v: 55, label: "Balanced" },
                { v: 70, label: "Strict" },
              ]}
            />
            <p className="mt-2 text-xs text-muted">
              Hides jobs that fit your resume less than this. Broad shows more, including near-misses; Strict only shows
              close fits.
            </p>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Relocation</div>
            <Segmented
              value={s.sponsorship.relocation}
              onChange={(r) => save.mutate({ sponsorship: { ...s.sponsorship, relocation: r } })}
              options={[
                { v: "required", label: "Must be offered" },
                { v: "bonus", label: "Bonus" },
                { v: "ignore", label: "Ignore" },
              ]}
            />
            <div className="mt-4 text-sm font-medium">Jobs where only the employer is on a sponsor register</div>
            <Segmented
              value={s.sponsorship.includeRegister ? "yes" : "no"}
              onChange={(v) => save.mutate({ sponsorship: { ...s.sponsorship, includeRegister: v === "yes" } })}
              options={[
                { v: "yes", label: "Include (marked)" },
                { v: "no", label: "Hide" },
              ]}
            />
            <p className="mt-2 text-xs text-muted">
              Big employers on the UK sponsor register or Canada's foreign-worker list often don't mention visas in the
              posting. Those jobs are listed as "Employer on sponsor register": the company can sponsor, but the posting
              doesn't say it will. Hide them to see only jobs that state sponsorship (or come from a visa-only source).
            </p>
            <div className="mt-4 text-sm font-medium">Jobs where only the salary meets the visa bar</div>
            <Segmented
              value={s.sponsorship.includePossible ? "yes" : "no"}
              onChange={(v) => save.mutate({ sponsorship: { ...s.sponsorship, includePossible: v === "yes" } })}
              options={[
                { v: "yes", label: "Include (marked)" },
                { v: "no", label: "Hide" },
              ]}
            />
            <p className="mt-2 text-xs text-muted">
              Singapore has no sponsor register and few postings mention visas. Where a posted salary clears the
              Employment Pass minimum, the job is listed as "Visa-eligible salary · unconfirmed". It does not mean the
              employer sponsors: ask before applying.
            </p>
            <p className="mt-2 text-xs text-muted">
              Every job needs some sponsorship signal: stated in the posting, a sponsor-register match, or (if enabled
              above) a visa-eligible salary. Jobs that expect you to already live there or hold the right to work are
              hidden by default.
            </p>
          </div>
        </div>
      </Section>

      <SourcesCard />

      <Section title="Appearance">
        <Segmented
          value={s.appearance.theme}
          onChange={(t) => save.mutate({ appearance: { theme: t } })}
          options={[
            {
              v: "system",
              label: (
                <>
                  <Monitor size={14} />
                  System
                </>
              ),
            },
            {
              v: "light",
              label: (
                <>
                  <Sun size={14} />
                  Light
                </>
              ),
            },
            {
              v: "dark",
              label: (
                <>
                  <Moon size={14} />
                  Dark
                </>
              ),
            },
          ]}
        />
      </Section>
    </div>
  );
}
