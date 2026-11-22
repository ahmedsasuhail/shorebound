import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JobDTO } from "@shorebound/core";

export interface CatalogCountry {
  code: string; name: string; region: string; status: "available" | "coming_soon";
  ease: number | null; confidence: "high" | "medium" | "low" | null; note: string | null;
}
export interface Settings {
  countries: string[];
  search: { lookbackDays: number; showUnknownPostedDate: boolean; targetRoles: string[] };
  sponsorship: { excludeNegative: boolean; relocation: "required" | "bonus" | "ignore" };
  sources: { disabled: string[] };
  schedule: { refreshHours: number };
  appearance: { theme: "system" | "light" | "dark" };
}
export interface ResumeInfo { originalName: string; bytes: number; uploadedAt: string }
export interface RefreshReport {
  startedAt: string;
  sources: { id: string; ok: boolean; seen?: number; kept?: number; inserted?: number; error?: string }[];
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const useCatalog = () =>
  useQuery({ queryKey: ["catalog"], queryFn: () => call<{ countries: CatalogCountry[] }>("/api/catalog"), staleTime: Infinity });

export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: () => call<Settings>("/api/settings") });

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) =>
      call<Settings>("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["settings"] });
      const prev = qc.getQueryData<Settings>(["settings"]);
      if (prev) qc.setQueryData<Settings>(["settings"], { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _p, ctx) => ctx?.prev && qc.setQueryData(["settings"], ctx.prev),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["settings"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export const useJobs = (q: string, settingsKey: unknown) =>
  useQuery({
    queryKey: ["jobs", q, settingsKey],
    queryFn: () => call<{ jobs: JobDTO[] }>(`/api/jobs${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    placeholderData: (prev) => prev,
  });

export function useRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => call<RefreshReport>("/api/refresh", { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export const useResume = () => useQuery({ queryKey: ["resume"], queryFn: () => call<{ resume: ResumeInfo | null }>("/api/resume") });

export function useUploadResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) =>
      call<{ resume: ResumeInfo }>("/api/resume", {
        method: "PUT",
        headers: { "content-type": "application/octet-stream", "x-filename": encodeURIComponent(file.name) },
        body: await file.arrayBuffer(),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["resume"] }),
  });
}

export function useRemoveResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => call("/api/resume", { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["resume"] }),
  });
}

export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}
