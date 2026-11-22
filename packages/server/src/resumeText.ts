import { readFileSync } from "node:fs";
import { extname } from "node:path";

/** Plain text from a stored resume (PDF, DOCX, TXT, MD). Runs locally; nothing is uploaded. */
export async function extractResumeText(path: string): Promise<string> {
  const ext = extname(path).toLowerCase();
  const bytes = readFileSync(path);
  if (ext === ".txt" || ext === ".md") return bytes.toString("utf8");
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer: bytes })).value;
  }
  if (ext === ".pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  throw new Error(`Unsupported resume type "${ext}".`);
}
