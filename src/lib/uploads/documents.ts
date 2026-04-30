import { existsSync, mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { extname, join } from "path";
import { nanoid } from "nanoid";
import { isAllowedFile, parseDocument } from "@/lib/upload";

export interface SavedDocument {
  filename: string;
  /** Path relative to data/uploads (e.g. "{studyId}/docs/abc123.pdf"). */
  path: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string;
}

const UPLOAD_ROOT = join(process.cwd(), "data", "uploads");

export async function saveDocument(opts: {
  studyId: string;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}): Promise<SavedDocument> {
  if (!isAllowedFile(opts.originalName)) {
    throw new Error(`Unsupported document type: ${opts.originalName}`);
  }

  const extractedText = await parseDocument(opts.buffer, opts.originalName);

  const studyDir = join(UPLOAD_ROOT, opts.studyId, "docs");
  if (!existsSync(studyDir)) {
    mkdirSync(studyDir, { recursive: true });
  }

  const ext = extname(opts.originalName) || ".bin";
  const id = nanoid(12);
  const filename = `${id}${ext}`;
  await writeFile(join(studyDir, filename), opts.buffer);

  return {
    filename: opts.originalName,
    path: `${opts.studyId}/docs/${filename}`,
    mimeType: opts.mimeType,
    sizeBytes: opts.buffer.length,
    extractedText,
  };
}
