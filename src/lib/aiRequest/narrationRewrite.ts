import { splitSentenceSegments } from '@/lib/ttsChunks';
import { fanOut } from './fanOut';
import { completeSentencePrefix, type NarrationEvent, type NarrationListener } from './narrationStream';

/** What a rewrite knows about the sentence it gets. */
export interface SentenceAt {
  index: number;
  /** The narration as it stands: earlier sentences as rewritten, then this one and the partial tail as the
   *  model wrote them. */
  full: string;
  /** The reply's earlier sentences, as their rewrites left them. */
  earlier: readonly string[];
}

/** Answers the sentence the listeners hear. A result is one sentence whatever it holds. */
export type SentenceRewrite = (sentence: string, at: SentenceAt) => string | Promise<string>;

export interface SentenceRewriting {
  /** Takes the Narration Stream's events and tells its own listeners the rewritten ones. */
  listener: NarrationListener;
  /** The final rewritten narration, once its last sentence has passed. Undefined when the request stopped. */
  final: () => Promise<string | undefined>;
  /** Drops queued work and answers `final` with undefined, for a view that left before the request ended. */
  abandon: () => void;
}

const sentenceCount = (prefix: string): number => (prefix === '' ? 0 : splitSentenceSegments(prefix).length);

/** `raw` with its first `count` sentences replaced by `released`, the gaps between them and everything after
 *  kept as the model wrote it. A sentence not released yet stays as written. */
function recompose(raw: string, released: readonly string[], count: number): string {
  const segments = splitSentenceSegments(raw);
  let cursor = 0;
  let out = '';
  for (const [i, segment] of segments.entries()) {
    const at = raw.indexOf(segment, cursor);
    out += raw.slice(cursor, at) + (i < count ? released[i] ?? segment : segment);
    cursor = at + segment.length;
  }
  return out + raw.slice(cursor);
}

/**
 * The sentence rewrite: sits between the Narration Stream and its listeners. Each completed sentence passes
 * through `rewrite` before any listener hears it, so the reveal, the read-aloud, the persisted partial and the
 * final text all carry one copy. Sentences go through in order, however long one rewrite takes.
 */
export function rewriteSentences(rewrite: SentenceRewrite, ...listeners: NarrationListener[]): SentenceRewriting {
  const emit = fanOut(listeners);
  // Bumped when the round ends early, so work queued for it never reaches a listener.
  let round = 0;
  let released: string[] = [];
  let queue: Promise<void> = Promise.resolve();
  let settle: (text: string | undefined) => void = () => {};
  const settled = new Promise<string | undefined>((resolve) => { settle = resolve; });

  const enqueue = (work: () => void | Promise<void>) => {
    const mine = round;
    queue = queue.then(() => (mine === round ? work() : undefined));
  };
  const restart = () => {
    round += 1;
    released = [];
  };

  const rewritten = async (sentence: string, at: SentenceAt): Promise<string> => {
    try {
      const out = await rewrite(sentence, at);
      return typeof out === 'string' ? out : sentence;
    } catch (error) {
      console.error('Error rewriting a narration sentence:', error);
      return sentence;
    }
  };

  const listener: NarrationListener = (event: NarrationEvent) => {
    switch (event.type) {
      case 'opened':
        restart();
        emit(event);
        return;
      case 'sentence': {
        const mine = round;
        enqueue(async () => {
          const text = await rewritten(event.text, {
            index: event.index, full: recompose(event.full, released, event.index), earlier: released.slice(0, event.index),
          });
          // The round may have restarted while the rewrite ran.
          if (mine !== round) return;
          released[event.index] = text;
          emit({ ...event, text });
        });
        return;
      }
      case 'display':
        enqueue(() => emit({
          ...event,
          text: recompose(event.text, released, sentenceCount(event.revealed)),
          revealed: recompose(event.revealed, released, sentenceCount(event.revealed)),
        }));
        return;
      case 'partial':
        enqueue(() => emit({ ...event, text: recompose(event.text, released, sentenceCount(completeSentencePrefix(event.text))) }));
        return;
      case 'finished':
        enqueue(() => {
          const text = recompose(event.text, released, sentenceCount(event.text));
          emit({ type: 'finished', text });
          settle(text);
        });
        return;
      case 'retract':
        restart();
        emit(event);
        return;
      case 'canceled':
        restart();
        emit(event);
        settle(undefined);
        return;
    }
  };

  return {
    listener,
    final: () => settled,
    abandon: () => {
      restart();
      settle(undefined);
    },
  };
}
