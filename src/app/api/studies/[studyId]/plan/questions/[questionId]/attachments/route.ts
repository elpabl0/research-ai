import { db } from "@/lib/db";
import { questionAttachments, studyArtifacts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { saveImage, resolveUploadPath } from "@/lib/uploads/images";

/**
 * Attach an asset to a plan question. Two modes:
 *  - multipart/form-data → upload a new file (legacy behaviour).
 *  - application/json with `{ artifactId, orderIndex?, label? }` → re-use an
 *    existing study-level artefact. Copies its filename/path/mime so the
 *    file on disk is shared.
 */
export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ studyId: string; questionId: string }> },
) {
  const { studyId, questionId } = await params;
  const contentType = request.headers.get("content-type") ?? "";

  // Re-use an existing study-level artefact.
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      artifactId?: string;
      orderIndex?: number;
      label?: string | null;
    };
    if (!body.artifactId) {
      return NextResponse.json(
        { error: "artifactId is required" },
        { status: 400 },
      );
    }
    const artifact = await db.query.studyArtifacts.findFirst({
      where: and(
        eq(studyArtifacts.id, body.artifactId),
        eq(studyArtifacts.studyId, studyId),
      ),
    });
    if (!artifact) {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 },
      );
    }
    if (artifact.kind !== "image") {
      return NextResponse.json(
        {
          error:
            "Only image artefacts can be attached to plan questions (the persona model needs to see them).",
        },
        { status: 400 },
      );
    }
    const id = nanoid(12);
    const orderIndex =
      typeof body.orderIndex === "number" ? body.orderIndex : 0;
    await db.insert(questionAttachments).values({
      id,
      questionId,
      orderIndex,
      filename: artifact.filename,
      path: artifact.path,
      mimeType: artifact.mimeType,
      label: body.label ?? null,
    });
    return NextResponse.json({
      id,
      filename: artifact.filename,
      path: artifact.path,
      mimeType: artifact.mimeType,
      orderIndex,
    });
  }

  // Upload a brand-new file.
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const orderIndexRaw = formData.get("orderIndex");
  const label = formData.get("label");

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const saved = await saveImage({
      studyId,
      buffer,
      originalName: file.name,
      mimeType: file.type,
    });
    const id = nanoid(12);
    const orderIndex =
      orderIndexRaw === null ? 0 : Number(orderIndexRaw) || 0;
    await db.insert(questionAttachments).values({
      id,
      questionId,
      orderIndex,
      filename: saved.filename,
      path: saved.path,
      mimeType: saved.mimeType,
      label: typeof label === "string" ? label : null,
    });
    return NextResponse.json({ id, ...saved, orderIndex });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * Bulk update attachments — used for reordering and editing per-step labels.
 * Body: `{ updates: Array<{ id, orderIndex?, label? }> }`.
 */
export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ studyId: string; questionId: string }> },
) {
  const { questionId } = await params;
  const body = (await request.json()) as {
    updates?: Array<{
      id: string;
      orderIndex?: number;
      label?: string | null;
    }>;
  };
  if (!Array.isArray(body.updates)) {
    return NextResponse.json(
      { error: "updates array required" },
      { status: 400 },
    );
  }

  for (const u of body.updates) {
    const patch: Record<string, unknown> = {};
    if (typeof u.orderIndex === "number") patch.orderIndex = u.orderIndex;
    if (u.label !== undefined) patch.label = u.label;
    if (Object.keys(patch).length === 0) continue;
    await db
      .update(questionAttachments)
      .set(patch)
      .where(
        and(
          eq(questionAttachments.id, u.id),
          eq(questionAttachments.questionId, questionId),
        ),
      );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  {
    params,
  }: { params: Promise<{ studyId: string; questionId: string }> },
) {
  await params;
  const { searchParams } = new URL(request.url);
  const attachmentId = searchParams.get("attachmentId");
  if (!attachmentId) {
    return NextResponse.json(
      { error: "attachmentId query parameter is required" },
      { status: 400 },
    );
  }
  const row = await db.query.questionAttachments.findFirst({
    where: eq(questionAttachments.id, attachmentId),
  });
  if (!row) return NextResponse.json({ success: true });

  // The same file might be referenced by a study-level artefact or another
  // question attachment — only unlink from disk when nothing else points at it.
  const otherAtt = await db.query.questionAttachments.findFirst({
    where: and(
      eq(questionAttachments.path, row.path),
      // Drizzle has no `ne` for a column-vs-value, so we just check id below.
    ),
  });
  const studyArt = await db.query.studyArtifacts.findFirst({
    where: eq(studyArtifacts.path, row.path),
  });
  const sharedElsewhere =
    Boolean(studyArt) || Boolean(otherAtt && otherAtt.id !== attachmentId);

  if (!sharedElsewhere) {
    try {
      await unlink(resolveUploadPath(row.path));
    } catch {
      /* ignore */
    }
  }
  await db
    .delete(questionAttachments)
    .where(eq(questionAttachments.id, attachmentId));
  return NextResponse.json({ success: true });
}
