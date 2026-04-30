import { db } from "@/lib/db";
import { studyArtifacts, questionAttachments } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { unlink } from "fs/promises";
import { NextResponse } from "next/server";
import { resolveUploadPath } from "@/lib/uploads/images";

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ studyId: string; artifactId: string }>;
  },
) {
  const { studyId, artifactId } = await params;

  const artifact = await db.query.studyArtifacts.findFirst({
    where: and(
      eq(studyArtifacts.id, artifactId),
      eq(studyArtifacts.studyId, studyId),
    ),
  });
  if (!artifact) {
    return NextResponse.json(
      { error: "Artifact not found" },
      { status: 404 },
    );
  }

  // Detach any plan-question attachments that point at the same file.
  await db
    .delete(questionAttachments)
    .where(eq(questionAttachments.path, artifact.path));

  await db.delete(studyArtifacts).where(eq(studyArtifacts.id, artifactId));

  // Best-effort file removal; don't fail the request if the file's already gone.
  try {
    await unlink(resolveUploadPath(artifact.path));
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true });
}
