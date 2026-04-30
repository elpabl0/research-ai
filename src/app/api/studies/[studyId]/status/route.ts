import { db } from "@/lib/db";
import { studies, sessions as sessionsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isRunning } from "@/lib/research-runner";
import { researchEventBus, type SeqEvent } from "@/lib/research-event-bus";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studyId: string }> },
) {
  const { studyId } = await params;
  const url = new URL(request.url);

  const accept = request.headers.get("accept") ?? "";
  const wantsSse =
    accept.includes("text/event-stream") || url.searchParams.has("stream");

  const study = await db.query.studies.findFirst({
    where: eq(studies.id, studyId),
  });
  if (!study) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  // Reconcile zombie 'running' studies the same way the sprint route did.
  let effectiveStatus = study.status;
  const isLive = isRunning(studyId);
  if (study.status === "running" && !isLive) {
    const existingSessions = await db.query.sessions.findMany({
      where: eq(sessionsTable.studyId, studyId),
    });
    if (existingSessions.length > 0) {
      effectiveStatus = "interrupted";
      await db
        .update(studies)
        .set({ status: "interrupted", updatedAt: new Date() })
        .where(eq(studies.id, studyId));
    }
  }

  if (!wantsSse) {
    return NextResponse.json({
      status: effectiveStatus,
      isActivelyRunning: isLive,
    });
  }

  // SSE stream.
  const cursorParam = url.searchParams.get("cursor");
  const lastEventId = request.headers.get("Last-Event-ID");
  const cursor = cursorParam
    ? parseInt(cursorParam, 10)
    : lastEventId
      ? parseInt(lastEventId, 10)
      : null;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (seqEvent: SeqEvent) => {
        if (closed) return;
        try {
          const data = JSON.stringify(seqEvent.event);
          controller.enqueue(
            encoder.encode(`id: ${seqEvent.seq}\ndata: ${data}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      if (!isLive && !researchEventBus.hasChannel(studyId)) {
        if (effectiveStatus === "completed") {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "study_complete", data: { studyId } })}\n\n`,
            ),
          );
        } else if (effectiveStatus === "interrupted") {
          let persistedError = "Study was interrupted.";
          try {
            const config = study.config ? JSON.parse(study.config) : {};
            if (typeof config.lastError === "string" && config.lastError) {
              persistedError = config.lastError;
            }
          } catch {
            /* ignore parse errors */
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", data: { message: persistedError } })}\n\n`,
            ),
          );
        }
        try { controller.close(); } catch { /* ignore */ }
        return;
      }

      const unsubscribe = researchEventBus.subscribe(studyId, cursor, send);

      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          closed = true;
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15_000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch { /* ignore */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
