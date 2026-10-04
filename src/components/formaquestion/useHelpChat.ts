import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toastAiRequestFailure } from '@/lib/aiRequest/aiRequestFailureToast';
import type { DocSection, DocsIndex } from '@/lib/docs/docsIndex';
import { openDocs } from '@/lib/formaquestion/docsOpener';
import { askHelp, type HelpStage } from '@/lib/formaquestion/helpSession';
import type { HelpSettings } from '@/lib/formaquestion/helpSettings';
import type { HelpTrace } from '@/lib/formaquestion/helpTrace';
import { helpWorld } from '@/lib/formaquestion/helpWorld';
import { surfaceRegistry } from '@/lib/surface/surfaceRegistry';
import { turnActivity, useTurnGenerating } from '@/lib/turnActivity';
import { useMountedRef } from '@/lib/useMountedRef';
import type { ImageAttachment } from '@/types';
import type { HelpAi } from './useHelpAi';

/**
 * Where a question stands. `writing` while the request runs. `no-ai` and `failed` show the docs search
 * for the question in place of an answer.
 */
export type HelpStatus = 'writing' | 'answered' | 'stopped' | 'no-ai' | 'failed';

/** One question and what came back for it. */
export interface HelpExchange {
  id: string;
  question: string;
  /** The images sent with the question. */
  images: ImageAttachment[];
  /** The answer so far, as markdown. */
  answer: string;
  /** Content text has arrived. It stays set when a function call clears the text written before it. */
  answerStarted?: boolean;
  /** The layer id of the face the AI set for this answer. The last call wins. */
  face?: string;
  /** The model's reasoning so far, native or inline. */
  reasoning: string;
  /** How long the reasoning took, from its first text to the answer's first text. Absent while it runs. */
  reasoningMs?: number;
  status: HelpStatus;
  /** The docs sections that reached the model. */
  sources: readonly DocSection[];
  /** The open screen's section among the sources. */
  lead?: DocSection;
  /** The answer did not come from the guide. */
  flagged: boolean;
  /** The search's sections for the question, shown under a flagged answer. */
  nearest: readonly DocSection[];
  /** What the question sent, for AI Context. Absent until the search is done, and for a question no AI answered. */
  trace?: HelpTrace;
  /** What the question waits on, while it is `writing` with no answer text. */
  stage?: HelpStage;
}

export interface HelpChat {
  exchanges: readonly HelpExchange[];
  /** A question is in progress. */
  busy: boolean;
  /** A game turn generates, so a question waits. */
  held: boolean;
  /** The model reads images, so the ask field takes them. */
  readsImages: boolean;
  /** The images waiting for the next question. */
  pending: ImageAttachment[];
  setPending: (update: (prev: ImageAttachment[]) => ImageAttachment[]) => void;
  ask: (question: string) => void;
  stop: () => void;
  /** Empties the conversation and ends the answer that is coming in. */
  clear: () => void;
}

/**
 * The conversation of the one Formaquestion instance. It lives in memory, so it outlives the window
 * and ends with the app. A question carries the earlier exchanges, so a follow-up works. Its images go
 * with it alone and are never stored.
 */
export function useHelpChat(index: DocsIndex | null, ai: HelpAi, settings: HelpSettings): HelpChat {
  const [exchanges, setExchanges] = useState<HelpExchange[]>([]);
  const [pending, setPending] = useState<ImageAttachment[]>([]);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const exchangesRef = useRef(exchanges);
  exchangesRef.current = exchanges;
  const held = useTurnGenerating();
  const mountedRef = useMountedRef();
  const running = useRef<AbortController | null>(null);
  // Read when the player sends, so a question uses the settings of that moment.
  const aiRef = useRef(ai);
  aiRef.current = ai;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => () => running.current?.abort(), []);

  const ask = useCallback((question: string) => {
    if (!index || running.current || turnActivity.get()) return;
    const history = exchangesRef.current;
    // The Surface, the open world and the settings at send time, before any wait.
    const surface = surfaceRegistry.get();
    const world = helpWorld.get();
    const sentSettings = settingsRef.current;
    const controller = new AbortController();
    running.current = controller;
    const id = crypto.randomUUID();
    const images = aiRef.current.readsImages ? pendingRef.current : [];
    setPending([]);
    const change = (fields: Partial<HelpExchange>) => {
      if (mountedRef.current) setExchanges((all) => all.map((entry) => (entry.id === id ? { ...entry, ...fields } : entry)));
    };
    setExchanges((all) => [...all, { id, question, images, answer: '', reasoning: '', status: 'writing', sources: [], flagged: false, nearest: [] }]);

    void (async () => {
      try {
        // A cached "blocked" can be stale: the player may have started a server since. The fresh check
        // of a server that does not answer can be slow, so Stop ends the wait.
        if (aiRef.current.reachable === false) {
          const stopped = new Promise<'stopped'>((resolve) => {
            controller.signal.addEventListener('abort', () => resolve('stopped'), { once: true });
          });
          change({ stage: 'checking' });
          const found = await Promise.race([aiRef.current.revalidate(), stopped]);
          if (found !== true) {
            change({ status: found === 'stopped' ? 'stopped' : 'no-ai' });
            return;
          }
        }
        const { snapshot, language } = aiRef.current;
        // The reasoning time runs from its first text to the answer's first text, or to the end.
        let reasoningAt = 0;
        let reasoningMs: number | undefined;
        const timeReasoning = (reasoning: string, answered: boolean) => {
          if (reasoning && !reasoningAt) reasoningAt = performance.now();
          if (reasoningAt && answered && reasoningMs === undefined) reasoningMs = Math.round(performance.now() - reasoningAt);
          return reasoningMs;
        };
        for await (const event of askHelp({ question, history, language, settings: sentSettings, snapshot, index, surface, images, world, signal: controller.signal })) {
          if (event.type === 'trace') change({ trace: event.trace });
          else if (event.type === 'stage') change({ stage: event.stage });
          else if (event.type === 'face') change({ face: event.face });
          else if (event.type === 'answer') change({ answer: event.text, reasoning: event.reasoning, reasoningMs: timeReasoning(event.reasoning, event.text !== ''), flagged: event.flagged, ...(event.text !== '' && { answerStarted: true }) });
          else change({ answer: event.text, reasoning: event.reasoning, reasoningMs: timeReasoning(event.reasoning, true), sources: event.sources, lead: event.lead, flagged: event.flagged, nearest: event.nearest, status: event.stopped ? 'stopped' : 'answered', stage: undefined });
        }
      } catch (error) {
        if (!mountedRef.current) return;
        toastAiRequestFailure(error, () => { openDocs({ page: 'Connect-Your-Own-AI' }); });
        change({ status: 'failed' });
      } finally {
        if (running.current === controller) running.current = null;
      }
    })();
  }, [index, mountedRef]);

  const stop = useCallback(() => running.current?.abort(), []);
  const clear = useCallback(() => {
    running.current?.abort();
    running.current = null;
    setExchanges([]);
    setPending([]);
  }, []);
  const busy = exchanges.at(-1)?.status === 'writing';
  const { readsImages } = ai;
  return useMemo(
    () => ({ exchanges, busy, held, readsImages, pending, setPending, ask, stop, clear }),
    [exchanges, busy, held, readsImages, pending, ask, stop, clear],
  );
}
