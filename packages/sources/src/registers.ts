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
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** UK Home Office "Register of licensed sponsors: workers". Only the Skilled Worker route counts. */
export function parseUkRegister(csv: string): Set<string> {
  const [header, ...rows] = parseCsv(csv.replace(/^﻿/, ""));
  const nameCol = header?.findIndex((h) => /organisation name/i.test(h)) ?? -1;
  const routeCol = header?.findIndex((h) => /^route$/i.test(h.trim())) ?? -1;
  if (nameCol < 0 || routeCol < 0) throw new Error("Unexpected UK register format (missing columns).");
  const names = new Set<string>();
  for (const r of rows) if (/^skilled worker$/i.test((r[routeCol] ?? "").trim())) names.add(normalizeOrg(r[nameCol] ?? ""));
  return names;
}

const UK_PUBLICATION = "https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers";

/** Finds the current CSV through the GOV.UK content API (the file name changes with each update). */
export async function fetchUkRegisterCsv(fetchFn: FetchLike): Promise<{ csv: string; updatedAt: string }> {
  const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };
  const meta = await fetchFn(UK_PUBLICATION, { headers });
  if (!meta.ok) throw new Error(`GOV.UK content API returned HTTP ${meta.status}`);
  const doc = (await meta.json()) as { public_updated_at?: string; details?: { attachments?: { url?: string; content_type?: string }[] } };
  const url = doc.details?.attachments?.find((a) => a.content_type === "text/csv" || a.url?.endsWith(".csv"))?.url;
  if (!url) throw new Error("UK register CSV link not found on GOV.UK.");
  const file = await fetchFn(url, { headers: { "User-Agent": USER_AGENT } });
  if (!file.ok) throw new Error(`UK register download returned HTTP ${file.status}`);
  return { csv: await file.text(), updatedAt: doc.public_updated_at ?? "" };
}
