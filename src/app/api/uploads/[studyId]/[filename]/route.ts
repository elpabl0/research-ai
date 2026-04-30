import { readFile } from "fs/promises";
import { extname } from "path";
import { resolveUploadPath } from "@/lib/uploads/images";
import { db } from "@/lib/db";
import { studies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ studyId: string; filename: string }> },
) {
  const { studyId, filename } = await params;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const study = await db.query.studies.findFirst({
    where: eq(studies.id, studyId),
  });
  if (!study) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  try {
    const buf = await readFile(resolveUploadPath(`${studyId}/${filename}`));
    const ext = extname(filename).toLowerCase();
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
