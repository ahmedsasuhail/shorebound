/** How strongly a job's sponsorship claim is supported (see PLAN.md §5.1). */
export type SponsorshipStatus =
  | "confirmed_text" // explicit positive phrase, no negation
  | "confirmed_register" // company is on the country's official sponsor register
  | "visa_source" // listed on a visa-only board or filter
  | "country_norm" // employer sponsorship is the default in that country
  | "possible" // talent route likely fits; weak signal
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
