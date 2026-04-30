import type { StreamEvent } from "@/lib/agents/types";

/**
 * Sequenced event: a StreamEvent with an auto-incrementing sequence number.
 * The `seq` is used for cursor-based replay when clients reconnect.
 */
export interface SeqEvent {
  seq: number;
  event: StreamEvent;
}

type Subscriber = (seqEvent: SeqEvent) => void;

interface StudyChannel {
  nextSeq: number;
  events: SeqEvent[];
  subscribers: Set<Subscriber>;
}

const MAX_BUFFER_SIZE = 1000;

/**
 * In-memory event bus that decouples study execution from SSE connections.
 *
 * - `runStudy()` emits events via `emit()`
 * - SSE handlers subscribe via `subscribe()` and receive fan-out
 * - Reconnecting clients pass a cursor (last seen seq) to replay missed events
 * - Per-study ring buffer capped at MAX_BUFFER_SIZE events
 */
class ResearchEventBus {
  private channels = new Map<string, StudyChannel>();

  private getOrCreate(studyId: string): StudyChannel {
    let ch = this.channels.get(studyId);
    if (!ch) {
      ch = { nextSeq: 1, events: [], subscribers: new Set() };
      this.channels.set(studyId, ch);
    }
    return ch;
  }

  emit(studyId: string, event: StreamEvent): void {
    const ch = this.getOrCreate(studyId);
    const seqEvent: SeqEvent = { seq: ch.nextSeq++, event };

    ch.events.push(seqEvent);
    if (ch.events.length > MAX_BUFFER_SIZE) {
      ch.events.shift();
    }

    for (const sub of ch.subscribers) {
      try {
        sub(seqEvent);
      } catch {
        // closed connection — ignore
      }
    }
  }

  subscribe(
    studyId: string,
    cursor: number | null,
    callback: Subscriber,
  ): () => void {
    const ch = this.getOrCreate(studyId);

    if (cursor !== null && cursor > 0) {
      for (const seqEvent of ch.events) {
        if (seqEvent.seq > cursor) {
          try {
            callback(seqEvent);
          } catch {
            // ignore
          }
        }
      }
    } else if (cursor === null) {
      for (const seqEvent of ch.events) {
        try {
          callback(seqEvent);
        } catch {
          // ignore
        }
      }
    }

    ch.subscribers.add(callback);
    return () => {
      ch.subscribers.delete(callback);
    };
  }

  hasChannel(studyId: string): boolean {
    return this.channels.has(studyId);
  }

  getLatestSeq(studyId: string): number {
    const ch = this.channels.get(studyId);
    if (!ch || ch.events.length === 0) return 0;
    return ch.events[ch.events.length - 1].seq;
  }

  cleanup(studyId: string): void {
    this.channels.delete(studyId);
  }

  scheduleCleanup(studyId: string, delayMs: number = 10 * 60 * 1000): void {
    setTimeout(() => this.cleanup(studyId), delayMs);
  }
}

export const researchEventBus = new ResearchEventBus();
