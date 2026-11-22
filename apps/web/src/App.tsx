import { AnimatePresence, motion } from "motion/react";
import { Compass, Settings as SettingsIcon, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { useSettings } from "./api";
import { FeedPage } from "./pages/FeedPage";
import { SettingsPage } from "./pages/SettingsPage";

type Page = "feed" | "settings";

function useTheme(theme: "system" | "light" | "dark" | undefined) {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || ((theme ?? "system") === "system" && mq.matches));
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}

export function App() {
  const [page, setPage] = useState<Page>(() => (location.hash === "#settings" ? "settings" : "feed"));
  const settings = useSettings();
  useTheme(settings.data?.appearance.theme);

  const nav: { id: Page; label: string; icon: typeof Compass }[] = [
    { id: "feed", label: "Feed", icon: Compass },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface/70 p-4 backdrop-blur md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2 pt-1">
          <motion.div
            initial={{ rotate: -20, scale: 0.8, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white shadow-lg shadow-accent/30"
          >
            <Waves size={20} strokeWidth={2.4} />
          </motion.div>
          <div>
            <div className="text-[17px] font-semibold tracking-tight">Shorebound</div>
            <div className="text-[11px] text-muted">jobs abroad, ranked by trust</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((n) => {
            const active = page === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${active ? "text-accentink" : "text-muted hover:text-ink"}`}
              >
                {active && (
                  <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-accentsoft" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                )}
                <n.icon size={18} className="relative" />
                <span className="relative">{n.label}</span>
              </button>
            );
          })}
        </nav>
        <p className="mt-auto px-2 text-[11px] leading-relaxed text-muted">
          Local only. Your resume and settings never leave this machine. Not legal or immigration advice.
        </p>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-8 md:pt-8">
          <div className="mb-4 flex gap-2 md:hidden">
            {nav.map((n) => (
              <button key={n.id} onClick={() => setPage(n.id)} className={`rounded-full px-4 py-1.5 text-sm ${page === n.id ? "bg-accent text-white" : "bg-surface2 text-muted"}`}>
                {n.label}
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {page === "feed" ? <FeedPage goSettings={() => setPage("settings")} /> : <SettingsPage />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
