import { existsSync, mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { extname, join } from "path";
import { nanoid } from "nanoid";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  IMAGE_MAX_BYTES,
} from "@/config/research";

export interface SavedImage {
  filename: string;
  /** Path relative to data/uploads (e.g. "{studyId}/abc123.png"). */
  path: string;
  mimeType: string;
  sizeBytes: number;
}

const UPLOAD_ROOT = join(process.cwd(), "data", "uploads");

function extForMime(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}

export async function saveImage(opts: {
  studyId: string;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}): Promise<SavedImage> {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(opts.mimeType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    throw new Error(`Unsupported image MIME type: ${opts.mimeType}`);
  }
  if (opts.buffer.length > IMAGE_MAX_BYTES) {
    throw new Error(
      `Image too large: ${opts.originalName} (max ${IMAGE_MAX_BYTES} bytes)`,
    );
  }

  const studyDir = join(UPLOAD_ROOT, opts.studyId);
  if (!existsSync(studyDir)) {
    mkdirSync(studyDir, { recursive: true });
  }

  const ext = extname(opts.originalName) || extForMime(opts.mimeType);
  const id = nanoid(12);
  const filename = `${id}${ext}`;
  const absolutePath = join(studyDir, filename);
  await writeFile(absolutePath, opts.buffer);

  return {
    filename: opts.originalName,
    path: `${opts.studyId}/${filename}`,
    mimeType: opts.mimeType,
    sizeBytes: opts.buffer.length,
  };
}

export function resolveUploadPath(relativePath: string): string {
  return join(UPLOAD_ROOT, relativePath);
}
