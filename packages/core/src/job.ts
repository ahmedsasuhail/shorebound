/** How strongly a job's sponsorship claim is supported (see PLAN.md, "Sponsorship"). */
export type SponsorshipStatus =
  | "confirmed_text" // explicit positive phrase, no negation
  | "confirmed_register" // company is on the country's official sponsor register
  | "visa_source" // listed on a visa-only board or filter
  | "possible" // weaker signal, e.g. salary meets the visa threshold (Singapore); shown clearly marked
  | "unknown"
  | "negative"; // explicit "no sponsorship" — excluded by default

export type RelocationStatus = "offered" | "mentioned" | "none";

export type WorkMode = "onsite" | "hybrid" | "remote";

/** A normalized job posting. `postedAt` must be a real source date, never a crawl date. */
export interface Job {
  id: string;
  sourceId: string;
  sourceJobId: string;
  url: string;
  title: string;
  company: string;
  /** ISO 3166-1 alpha-2, uppercase. */
  country: string;
  city?: string;
  workMode?: WorkMode;
  postedAt: Date;
  description: string;
  sponsorship: { status: SponsorshipStatus; evidence?: string };
  relocation: { status: RelocationStatus; evidence?: string };
}

/** Job as sent over the API (dates as ISO strings). */
export type JobDTO = Omit<Job, "postedAt"> & {
  postedAt: string;
  firstSeenAt: string;
  /** Filled by the server feed: set when the poster looks like a staffing agency / recruiter. */
  agency?: { evidence: string };
  /** Filled by the server feed: fit to the user's profile. */
  match?: { score: number; reasons: string[] } | null;
  confidence?: {
    score: number;
    band: "low" | "medium" | "high";
    coverage: number;
    factors: { id: string; label: string; weight: number; value: number | null }[];
    flags: { id: string; label: string; weight: number; hard: boolean }[];
  };
  analysis?: {
    isSoftware: boolean;
    family: string | null;
    seniority: string;
    minYears: number | null;
    skills: string[];
    titleSkills: string[];
    offStack: boolean;
  };
};
