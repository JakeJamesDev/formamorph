import { stripReasoningLive } from '@/lib/aiResponse';
import { splitSentenceSegments } from '@/lib/ttsChunks';
import { fanOut } from './fanOut';
import type { TransportSink } from './requestTransport';

/**
 * The Narration Stream: turns a narration request's transport events into sentence events. It owns the
 * sentence cursor and the partial-persistence rule, so its listeners never split text themselves.
 */

/** What the Narration Stream tells its listeners, in the order it happens. */
export type NarrationEvent =
  /** The endpoint accepted the request: this turn's narration replaces the last one from here. */
  | { type: 'opened' }
  /** A completed sentence, once and in order. `index` restarts at 0 after a retract. `full` is the running
   *  text when it completed, the in-progress tail included. */
  | { type: 'sentence'; index: number; text: string; full: string }
  /** The running narration: `text` in full, `revealed` up to its last complete sentence, which holds
   *  `sentences` of them. `boundary` marks a delta that completed at least one sentence. */
  | { type: 'display'; text: string; revealed: string; sentences: number; boundary: boolean }
  /** The partial assistant message to persist: on the first narration text, then on each sentence boundary. */
  | { type: 'partial'; text: string }
  /** The streamed text was not the reply. `hadPartial` says a partial message was persisted for it. */
  | { type: 'retract'; hadPartial: boolean }
  /** `text` is the final narration. */
  | { type: 'finished'; text: string }
  /** The request stopped. Nothing follows. */
  | { type: 'canceled' };

export type NarrationListener = (event: NarrationEvent) => void;

/** The prefix of `text` up to its last complete sentence; '' until the first sentence completes. */
export function completeSentencePrefix(text: string): string {
  return prefixBeforeLast(text, splitSentenceSegments(text));
}

/** How many complete sentences `text` holds; the last segment is the sentence still in progress. */
export function completeSentenceCount(text: string): number {
  return Math.max(0, splitSentenceSegments(text).length - 1);
}

/** `text` without its last segment, the sentence still in progress. */
function prefixBeforeLast(text: string, segments: string[]): string {
  if (segments.length <= 1) return '';
  return text.slice(0, text.length - segments[segments.length - 1].length).replace(/\s+$/, '');
}

/** A transport sink for one narration request that tells `listeners` its sentence events. */
export function narrationStream(...listeners: NarrationListener[]): TransportSink {
  const emit = fanOut(listeners);
  // Sentences already emitted for the current round.
  let emittedCount = 0;
  let persisted = false;
  let closed = false;

  const emitSentencesUpTo = (segments: string[], end: number, full: string) => {
    for (; emittedCount < end; emittedCount++) emit({ type: 'sentence', index: emittedCount, text: segments[emittedCount], full });
  };

  return (event) => {
    if (closed) return;
    switch (event.type) {
      case 'opened':
        emittedCount = 0;
        persisted = false;
        emit({ type: 'opened' });
        return;
      case 'delta': {
        // Leading whitespace goes, so the running text matches the final trimmed reply: a stripped
        // reasoning block leaves blank lines that would otherwise shift the reveal at the end.
        const text = stripReasoningLive(event.content).replace(/^\s+/, '');
        const segments = splitSentenceSegments(text);
        // The last segment is the sentence still in progress.
        const complete = segments.length - 1;
        const boundary = complete > emittedCount;
        emitSentencesUpTo(segments, complete, text);
        emit({ type: 'display', text, revealed: prefixBeforeLast(text, segments), sentences: Math.max(0, complete), boundary });
        // Added once, so a stop before any text leaves no partial; refreshed per sentence, not per token.
        if (persisted ? boundary : text.length > 0) {
          persisted = true;
          emit({ type: 'partial', text });
        }
        return;
      }
      case 'retract': {
        const hadPartial = persisted;
        emittedCount = 0;
        persisted = false;
        emit({ type: 'retract', hadPartial });
        return;
      }
      case 'done': {
        closed = true;
        const segments = splitSentenceSegments(event.text);
        emitSentencesUpTo(segments, segments.length, event.text);
        emit({ type: 'finished', text: event.text });
        return;
      }
      case 'canceled':
        closed = true;
        emit({ type: 'canceled' });
        return;
      default:
        return;
    }
  };
}
