import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JobDTO } from "@shorebound/core";

export interface CatalogCountry {
  code: string;
  name: string;
  region: string;
  status: "available" | "coming_soon";
  ease: number | null;
  confidence: "high" | "medium" | "low" | null;
  note: string | null;
  /** YYYY-MM-DD the country was added (countries added after v1 only). */
  since: string | null;
}
export interface Settings {
  countries: string[];
  search: {
    lookbackDays: number;
    sort: "newest" | "match" | "confidence";
    minMatch: number;
    maxPerCompany: number;
  };
  sponsorship: {
    relocation: "required" | "bonus" | "ignore";
    includePossible: boolean;
    includeRegister: boolean;
    includeAgencies: boolean;
  };
  sources: { disabled: string[] };
  appearance: { theme: "system" | "light" | "dark" };
}
export interface Profile {
  skills: string[];
  yearsExperience: number | null;
  seniority: "intern" | "junior" | "mid" | "senior" | "lead" | "manager";
  families: string[];
  title: string | null;
  source: "rules" | "user" | "claude";
}
export interface Feed {
  jobs: JobDTO[];
  total: number;
  hidden: { notMatching: number; companyCap: number; agency: number };
  relocationOffered: number;
  needsProfile?: boolean;
}
export interface ResumeInfo {
  originalName: string;
  bytes: number;
  uploadedAt: string;
}
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
  useQuery({
    queryKey: ["catalog"],
    queryFn: () => call<{ countries: CatalogCountry[] }>("/api/catalog"),
    staleTime: Infinity,
  });

export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: () => call<Settings>("/api/settings") });

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) =>
      call<Settings>("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      }),
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
    queryFn: () => call<Feed>(`/api/jobs${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    placeholderData: (prev) => prev,
  });

export function useRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => call<RefreshReport>("/api/refresh", { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export const useResume = () =>
  useQuery({ queryKey: ["resume"], queryFn: () => call<{ resume: ResumeInfo | null }>("/api/resume") });

export function useUploadResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) =>
      call<{ resume: ResumeInfo; profile: Profile | null; parseError: string | null }>("/api/resume", {
        method: "PUT",
        headers: { "content-type": "application/octet-stream", "x-filename": encodeURIComponent(file.name) },
        body: await file.arrayBuffer(),
      }),
    onSuccess: () => {
      for (const k of ["resume", "profile", "jobs"]) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export function useRemoveResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => call("/api/resume", { method: "DELETE" }),
    onSuccess: () => {
      for (const k of ["resume", "profile", "jobs"]) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export const useProfile = () =>
  useQuery({ queryKey: ["profile"], queryFn: () => call<{ profile: Profile | null }>("/api/profile") });

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Omit<Profile, "source">) =>
      call<{ profile: Profile }>("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(p),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export interface SourceInfo {
  id: string;
  label: string;
  description: string;
}
export const useSources = () =>
  useQuery({
    queryKey: ["sources"],
    queryFn: () => call<{ sources: SourceInfo[] }>("/api/sources"),
    staleTime: Infinity,
  });
