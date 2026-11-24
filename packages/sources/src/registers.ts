import type { FetchLike } from "./types.js";
import { USER_AGENT } from "./types.js";

/** country (ISO alpha-2) → set of normalized sponsor-register organisation names. */
export type RegisterIndex = Map<string, Set<string>>;

export const normalizeOrg = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** UK Home Office "Register of licensed sponsors: workers". Only the Skilled Worker route counts. */
export function parseUkRegister(csv: string): Set<string> {
  const text = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv; // strip byte-order mark
  const [header, ...rows] = parseCsv(text);
  const nameCol = header?.findIndex((h) => /organisation name/i.test(h)) ?? -1;
  const routeCol = header?.findIndex((h) => /^route$/i.test(h.trim())) ?? -1;
  if (nameCol < 0 || routeCol < 0) throw new Error("Unexpected UK register format (missing columns).");
  const names = new Set<string>();
  for (const r of rows)
    if (/^skilled worker$/i.test((r[routeCol] ?? "").trim())) names.add(normalizeOrg(r[nameCol] ?? ""));
  return names;
}

const UK_PUBLICATION = "https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers";

/** Finds the current CSV through the GOV.UK content API (the file name changes with each update). */
export async function fetchUkRegisterCsv(fetchFn: FetchLike): Promise<{ csv: string; updatedAt: string }> {
  const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };
  const meta = await fetchFn(UK_PUBLICATION, { headers });
  if (!meta.ok) throw new Error(`GOV.UK content API returned HTTP ${meta.status}`);
  const doc = (await meta.json()) as {
    public_updated_at?: string;
    details?: { attachments?: { url?: string; content_type?: string }[] };
  };
  const url = doc.details?.attachments?.find((a) => a.content_type === "text/csv" || a.url?.endsWith(".csv"))?.url;
  if (!url) throw new Error("UK register CSV link not found on GOV.UK.");
  const file = await fetchFn(url, { headers: { "User-Agent": USER_AGENT } });
  if (!file.ok) throw new Error(`UK register download returned HTTP ${file.status}`);
  return { csv: await file.text(), updatedAt: doc.public_updated_at ?? "" };
}

// ── Canada: Temporary Foreign Worker Program, positive LMIA employers ─────────

export type SheetReader = (data: Uint8Array) => Promise<unknown[][]>;

/** Software occupations in the LMIA data (NOC 2021: 21230-21234; NOC 2016/2011: 2173-2175). */
const SOFTWARE_OCC = /^(?:2123[0-4]|217[3-5])\b|software|programmer|web developer|computer systems developer/i;

/**
 * Employers who received a positive LMIA for a SOFTWARE occupation. The sheet has a title row, then the
 * header "Province/Territory | Program Stream | Employer | Address | Occupation | ...".
 */
export function parseLmiaRows(rows: unknown[][]): Set<string> {
  const h = rows.findIndex((r) => r[0] === "Province/Territory");
  if (h < 0) throw new Error("Unexpected LMIA format (header row not found).");
  const head = rows[h]!.map((c) => String(c ?? ""));
  const emp = head.findIndex((c) => /^employer$/i.test(c));
  const occ = head.findIndex((c) => /^occupation$/i.test(c));
  if (emp < 0 || occ < 0) throw new Error("Unexpected LMIA format (Employer/Occupation columns missing).");
  const names = new Set<string>();
  for (const r of rows.slice(h + 1))
    if (r[emp] && SOFTWARE_OCC.test(String(r[occ] ?? ""))) names.add(normalizeOrg(String(r[emp])));
  return names;
}

const defaultSheetReader: SheetReader = async (data) => {
  const { default: readXlsxFile } = await import("read-excel-file/node");
  const sheets = (await readXlsxFile(Buffer.from(data))) as unknown as { data: unknown[][] }[];
  return sheets[0]?.data ?? [];
};

const LMIA_DATASET = "https://open.canada.ca/data/api/3/action/package_show?id=90fed587-1364-4f33-a9ee-208181dc0b97";

/** Downloads the latest `quarters` English XLSX files from open.canada.ca and merges their software employers. */
export async function fetchCanadaLmia(
  fetchFn: FetchLike,
  opts: { quarters?: number; read?: SheetReader; delayMs?: number } = {},
): Promise<{ names: Set<string>; quarters: string[] }> {
  const read = opts.read ?? defaultSheetReader;
  const meta = await fetchFn(LMIA_DATASET, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!meta.ok) throw new Error(`open.canada.ca returned HTTP ${meta.status}`);
  const pkg = (await meta.json()) as {
    result?: { resources?: { name?: string | { en?: string }; format?: string; language?: string[]; url?: string }[] };
  };
  const files = (pkg.result?.resources ?? [])
    .filter((r) => r.format === "XLSX" && r.language?.includes("en") && r.url)
    .map((r) => ({ q: /^(\d{4}Q\d)/.exec(typeof r.name === "string" ? r.name : (r.name?.en ?? ""))?.[1], url: r.url! }))
    .filter((f): f is { q: string; url: string } => Boolean(f.q))
    .sort((a, b) => b.q.localeCompare(a.q))
    .slice(0, opts.quarters ?? 4);
  if (!files.length) throw new Error("No LMIA employer files found on open.canada.ca.");

  const names = new Set<string>();
  for (const [i, f] of files.entries()) {
    if (i > 0 && opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    const res = await fetchFn(f.url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok || !res.arrayBuffer) throw new Error(`LMIA ${f.q} download returned HTTP ${res.status}`);
    for (const n of parseLmiaRows(await read(new Uint8Array(await res.arrayBuffer())))) names.add(n);
  }
  return { names, quarters: files.map((f) => f.q) };
}
