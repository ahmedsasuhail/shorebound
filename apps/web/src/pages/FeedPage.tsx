import type { JobDTO } from "@shorebound/core";
import { AlertCircle, Loader2, Plane, RefreshCw, Search, SearchX } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useCatalog, useJobs, useProfile, useRefresh, useSaveSettings, useSettings } from "../api";
import { CountryChip } from "../components/Badges";
import { JobCard, JobSkeleton } from "../components/JobCard";
import { JobDrawer } from "../components/JobDrawer";
import { Onboarding } from "../components/Onboarding";
import { useNow } from "../hooks/useNow";
import { refreshSummary } from "../lib/format";

const WINDOWS = [1, 3, 7, 14] as const;

function Toggle({
  on,
  onClick,
  icon,
  children,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium ring-1 ring-inset transition-all ${on ? "bg-accent text-onaccent ring-accent shadow-md shadow-accent/25" : "bg-surface text-muted ring-line hover:text-ink"}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function FeedPage({ goSettings }: { goSettings: () => void }) {
  const settings = useSettings();
  const catalog = useCatalog();
  const save = useSaveSettings();
  const refresh = useRefresh();
  const profile = useProfile();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState<JobDTO | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const now = useNow();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  const s = settings.data;
  const jobs = useJobs(debounced, s && [s.countries, s.search, s.sponsorship]);
  const available = catalog.data?.countries.filter((c) => c.status === "available") ?? [];

  // Auto-hide the toast; it is set from the refresh callbacks below, not from an effect.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!s)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <JobSkeleton key={i} />
        ))}
      </div>
    );
  if (jobs.data?.needsProfile || (profile.isSuccess && !profile.data.profile)) return <Onboarding />;

  const toggleCountry = (code: string) =>
    save.mutate({
      countries: s.countries.includes(code) ? s.countries.filter((c) => c !== code) : [...s.countries, code],
    });
  const list = jobs.data?.jobs ?? [];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fresh jobs</h1>
          <p className="mt-1 text-sm text-muted">
            Posted in the last {s.search.lookbackDays} day{s.search.lookbackDays > 1 ? "s" : ""},{" "}
            {s.search.sort === "newest"
              ? "newest first"
              : s.search.sort === "match"
                ? "best fit first"
                : "most trusted first"}
            , with a sponsorship signal.
          </p>
        </div>
        <button
          onClick={() =>
            refresh.mutate(undefined, {
              onSuccess: (r) => setToast(refreshSummary(r)),
              onError: (e) => setToast(e.message),
            })
          }
          disabled={refresh.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-onaccent shadow-lg shadow-accent/30 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-70"
        >
          {refresh.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {refresh.isPending ? "Fetching…" : "Refresh"}
        </button>
      </div>

      <div className="sticky top-0 z-10 -mx-2 mb-5 space-y-3 rounded-2xl border border-line bg-surface/85 p-3 backdrop-blur-md">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or company"
            className="w-full rounded-xl border border-line bg-bg py-2 pl-9 pr-3 text-sm outline-none transition-shadow placeholder:text-muted focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_25%,transparent)]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Countries">
            {available.map((c) => (
              <span key={c.code} title={c.name}>
                <CountryChip
                  code={c.code}
                  active={s.countries.includes(c.code)}
                  onClick={() => toggleCountry(c.code)}
                />
              </span>
            ))}
          </div>
          <div
            className="flex rounded-full bg-surface2 p-0.5 text-xs font-medium"
            role="group"
            aria-label="Posted within"
          >
            {WINDOWS.map((d) => (
              <button
                key={d}
                onClick={() => save.mutate({ search: { ...s.search, lookbackDays: d } })}
                className="relative rounded-full px-3 py-1.5"
              >
                {s.search.lookbackDays === d && (
                  <motion.span
                    layoutId="win"
                    className="absolute inset-0 rounded-full bg-surface shadow-sm"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span className={`relative ${s.search.lookbackDays === d ? "text-accentink" : "text-muted"}`}>
                  {d === 1 ? "24h" : `${d}d`}
                </span>
              </button>
            ))}
          </div>
          <Toggle
            on={s.sponsorship.relocation === "required"}
            icon={<Plane size={13} />}
            onClick={() =>
              save.mutate({
                sponsorship: {
                  ...s.sponsorship,
                  relocation: s.sponsorship.relocation === "required" ? "bonus" : "required",
                },
              })
            }
          >
            Relocation offered
            {jobs.data ? ` (${jobs.data.relocationOffered})` : ""}
          </Toggle>
        </div>
      </div>

      {jobs.isError && (
        <div className="flex items-center gap-3 rounded-2xl border border-bad/30 bg-badsoft p-4 text-sm text-badink">
          <AlertCircle size={18} /> Could not reach the local server. Run{" "}
          <code className="rounded bg-surface2 px-1.5">npm run dev</code> and reload.
        </div>
      )}

      {jobs.isLoading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <JobSkeleton key={i} />
          ))}
        </div>
      )}

      {!jobs.isLoading && !jobs.isError && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>
              {jobs.data?.total ?? 0} job{jobs.data?.total === 1 ? "" : "s"}
              {jobs.data && jobs.data.total > list.length ? ` · showing ${list.length}` : ""}
              {jobs.data?.relocationOffered ? ` · ${jobs.data.relocationOffered} offer relocation` : ""}
              {jobs.data?.hidden.notMatching ? ` · ${jobs.data.hidden.notMatching} hidden as poor fit` : ""}
              {jobs.data?.hidden.companyCap ? ` · ${jobs.data.hidden.companyCap} more from the same companies` : ""}
              {jobs.data?.hidden.keywords ? ` · ${jobs.data.hidden.keywords} filtered by your keywords` : ""}
              {jobs.data?.hidden.agency ? ` · ${jobs.data.hidden.agency} from recruiters hidden` : ""}
            </span>
            <div className="flex rounded-full bg-surface2 p-0.5 font-medium" role="group" aria-label="Sort">
              {(
                [
                  ["newest", "Newest"],
                  ["match", "Best fit"],
                  ["confidence", "Most trusted"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => save.mutate({ search: { ...s.search, sort: v } })}
                  className="relative rounded-full px-3 py-1"
                >
                  {s.search.sort === v && (
                    <motion.span
                      layoutId="sort"
                      className="absolute inset-0 rounded-full bg-surface shadow-sm"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <span className={`relative ${s.search.sort === v ? "text-accentink" : ""}`}>{label}</span>
                </button>
              ))}
            </div>
          </div>
          {list.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid place-items-center rounded-3xl border border-dashed border-line p-14 text-center"
            >
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accentsoft text-accentink">
                <SearchX size={26} />
              </div>
              <h3 className="font-semibold">No jobs yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Press <b>Refresh</b> to fetch jobs, or widen the window and countries.{" "}
                {s.countries.length === 0 && (
                  <>
                    No countries are selected.{" "}
                    <button className="font-medium text-accent underline" onClick={goSettings}>
                      Choose some
                    </button>
                    .
                  </>
                )}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial>
                {list.map((j, i) => (
                  <JobCard key={j.id} job={j} index={i} now={now} onOpen={() => setOpen(j)} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      <JobDrawer job={open} onClose={() => setOpen(null)} />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
