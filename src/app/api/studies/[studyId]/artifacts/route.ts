import { db } from "@/lib/db";
import { studies, studyArtifacts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { saveImage } from "@/lib/uploads/images";
import { saveDocument } from "@/lib/uploads/documents";
import { ALLOWED_IMAGE_MIME_TYPES } from "@/config/research";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studyId: string }> },
) {
  const { studyId } = await params;
  const rows = await db.query.studyArtifacts.findMany({
    where: eq(studyArtifacts.studyId, studyId),
  });
  return NextResponse.json(rows);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studyId: string }> },
) {
  const { studyId } = await params;
  const study = await db.query.studies.findFirst({
    where: eq(studies.id, studyId),
  });
  if (!study) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isImage = ALLOWED_IMAGE_MIME_TYPES.includes(
    file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
  );

  try {
    if (isImage) {
      const saved = await saveImage({
        studyId,
        buffer,
        originalName: file.name,
        mimeType: file.type,
      });
      const id = nanoid(12);
      await db.insert(studyArtifacts).values({
        id,
        studyId,
        kind: "image",
        filename: saved.filename,
        path: saved.path,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        extractedText: null,
      });
      return NextResponse.json({ id, ...saved });
    }

    const saved = await saveDocument({
      studyId,
      buffer,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
    });
    const id = nanoid(12);
    await db.insert(studyArtifacts).values({
      id,
      studyId,
      kind: "document",
      filename: saved.filename,
      path: saved.path,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      extractedText: saved.extractedText,
    });
    return NextResponse.json({ id, ...saved });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
