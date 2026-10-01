import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toastAiRequestFailure } from '@/lib/aiRequest/aiRequestFailureToast';
import type { DocSection, DocsIndex } from '@/lib/docs/docsIndex';
import { openDocs } from '@/lib/formaquestion/docsOpener';
import { askHelp } from '@/lib/formaquestion/helpSession';
import { useMountedRef } from '@/lib/useMountedRef';
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
  /** The answer so far, as markdown. */
  answer: string;
  status: HelpStatus;
  /** The docs sections that reached the model. */
  sources: readonly DocSection[];
}

export interface HelpChat {
  exchanges: readonly HelpExchange[];
  /** A question is in progress. */
  busy: boolean;
  ask: (question: string) => void;
  stop: () => void;
}

/**
 * The conversation of the one Formaquestion instance. It lives in memory, so it outlives the window
 * and ends with the app. Each question is one request that carries only that question.
 */
export function useHelpChat(index: DocsIndex | null, ai: HelpAi): HelpChat {
  const [exchanges, setExchanges] = useState<HelpExchange[]>([]);
  const mountedRef = useMountedRef();
  const running = useRef<AbortController | null>(null);
  // Read when the player sends, so a question uses the settings of that moment.
  const aiRef = useRef(ai);
  aiRef.current = ai;

  useEffect(() => () => running.current?.abort(), []);

  const ask = useCallback((question: string) => {
    if (!index || running.current) return;
    const controller = new AbortController();
    running.current = controller;
    const id = crypto.randomUUID();
    const change = (fields: Partial<HelpExchange>) => {
      if (mountedRef.current) setExchanges((all) => all.map((entry) => (entry.id === id ? { ...entry, ...fields } : entry)));
    };
    setExchanges((all) => [...all, { id, question, answer: '', status: 'writing', sources: [] }]);

    void (async () => {
      try {
        // A cached "blocked" can be stale: the player may have started a server since. The fresh check
        // of a server that does not answer can be slow, so Stop ends the wait.
        if (aiRef.current.reachable === false) {
          const stopped = new Promise<'stopped'>((resolve) => {
            controller.signal.addEventListener('abort', () => resolve('stopped'), { once: true });
          });
          const found = await Promise.race([aiRef.current.revalidate(), stopped]);
          if (found !== true) {
            change({ status: found === 'stopped' ? 'stopped' : 'no-ai' });
            return;
          }
        }
        for await (const event of askHelp({ question, snapshot: aiRef.current.snapshot, index, signal: controller.signal })) {
          if (event.type === 'answer') change({ answer: event.text });
          else change({ answer: event.text, sources: event.sources, status: event.stopped ? 'stopped' : 'answered' });
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
  const busy = exchanges.at(-1)?.status === 'writing';
  return useMemo(() => ({ exchanges, busy, ask, stop }), [exchanges, busy, ask, stop]);
}
