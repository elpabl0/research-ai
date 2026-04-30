import { readFile } from "fs/promises";
import { resolveUploadPath } from "./images";
import type { InterviewAttachment } from "@/lib/agents/types";

interface QuestionAttachmentRow {
  id: string;
  orderIndex: number;
  filename: string;
  path: string;
  mimeType: string;
  label: string | null;
}

/**
 * Read attachment files from disk and return them as InterviewAttachment[]
 * ordered by step. Used by the runner before calling persona functions.
 */
export async function loadAttachmentsForPrompt(
  rows: QuestionAttachmentRow[],
): Promise<InterviewAttachment[]> {
  const sorted = [...rows].sort((a, b) => a.orderIndex - b.orderIndex);
  const loaded: InterviewAttachment[] = [];

  for (const row of sorted) {
    const buf = await readFile(resolveUploadPath(row.path));
    loaded.push({
      id: row.id,
      orderIndex: row.orderIndex,
      filename: row.filename,
      data: buf,
      mimeType: row.mimeType,
      label: row.label ?? undefined,
    });
  }

  return loaded;
}
