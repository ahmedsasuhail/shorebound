import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { deleteSetting, getSetting, putSetting, type Db } from "./db.js";

export interface ResumeInfo {
  originalName: string;
  storedAs: string;
  sha256: string;
  bytes: number;
  uploadedAt: string;
}

const KEY = "resume";
const ALLOWED = new Set([".pdf", ".docx", ".txt", ".md"]);
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Copies the resume into <appData>/resume/ and remembers it across sessions.
 * The file never leaves the machine and is never committed (.gitignore blocks PDFs/DOCX).
 */
export function saveResume(db: Db, appData: string, originalName: string, data: Uint8Array): ResumeInfo {
  const ext = extname(originalName).toLowerCase();
  if (!ALLOWED.has(ext)) throw new Error(`Unsupported resume type "${ext}". Use PDF, DOCX, TXT or MD.`);
  if (data.byteLength === 0) throw new Error("Resume file is empty.");
  if (data.byteLength > MAX_BYTES) throw new Error("Resume file is larger than 10 MB.");

  const dir = join(appData, "resume");
  mkdirSync(dir, { recursive: true });
  const previous = getSetting<ResumeInfo>(db, KEY);
  const storedAs = `resume${ext}`;
  writeFileSync(join(dir, storedAs), data);
  if (previous && previous.storedAs !== storedAs) rmSync(join(dir, previous.storedAs), { force: true });

  const info: ResumeInfo = {
    originalName,
    storedAs,
    sha256: createHash("sha256").update(data).digest("hex"),
    bytes: data.byteLength,
    uploadedAt: new Date().toISOString(),
  };
  putSetting(db, KEY, info);
  return info;
}

export function getResume(db: Db): ResumeInfo | undefined {
  return getSetting<ResumeInfo>(db, KEY);
}

export function resumePath(appData: string, info: ResumeInfo): string {
  return join(appData, "resume", info.storedAs);
}

export function removeResume(db: Db, appData: string): void {
  const info = getResume(db);
  if (info) rmSync(resumePath(appData, info), { force: true });
  deleteSetting(db, KEY);
}
