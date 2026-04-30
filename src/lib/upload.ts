import { parseOffice } from "officeparser";

const ALLOWED_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".pdf",
  ".docx",
  ".xlsx",
  ".doc",
  ".xls",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

export function isAllowedFile(filename: string): boolean {
  return ALLOWED_EXTENSIONS.has(getExtension(filename));
}

export async function parseDocument(
  buffer: Buffer,
  filename: string
): Promise<string> {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${filename} (max 10MB)`);
  }

  const ext = getExtension(filename);

  if (!isAllowedFile(filename)) {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  // Plain text files — read directly
  if (ext === ".txt" || ext === ".md") {
    return buffer.toString("utf-8");
  }

  // Office/PDF files — use officeparser
  const result = await parseOffice(buffer);
  const text = typeof result === "string" ? result : String(result);
  if (!text || text.trim().length === 0) {
    throw new Error(`Could not extract text from: ${filename}`);
  }

  return text;
}
