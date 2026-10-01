/**
 * The help session: one question in, one streamed answer and its sources out. It has no React and reads no
 * world or save. It sends through the AI Request Spec and the tool loop, the same path as every other call.
 */
import { buildAiRequestSpec, type AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { ABORTED_FINISH_REASON } from '@/lib/aiRequest/aiStream';
import { streamAiToolLoop } from '@/lib/aiRequest/toolLoop';
import { stripReasoningLive } from '@/lib/aiResponse';
import type { DocSection, DocsIndex } from '@/lib/docs/docsIndex';
import { HELP_SYSTEM_PROMPT, helpUserMessage } from './helpPrompt';

/** The most docs sections one help request holds. */
export const HELP_SECTION_LIMIT = 5;

/** The most characters of docs text one help request holds, so the request fits a small model's context. */
export const HELP_DOCS_CHAR_BUDGET = 12_000;

/** The answer cap in tokens: room for a long list of steps. */
export const HELP_MAX_TOKENS = 800;

export interface HelpQuestion {
  question: string;
  snapshot: AiSettingsSnapshot;
  index: DocsIndex;
  /** Stop: the stream ends and the answer so far is kept. */
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export type HelpEvent =
  /** The answer so far. */
  | { type: 'answer'; text: string }
  /** The end of the answer, with the docs sections that reached the model. */
  | { type: 'done'; text: string; sources: DocSection[]; stopped: boolean };

/**
 * The docs sections for a question, best first: the top search hit always, then more hits in rank order
 * while the docs text stays inside the budget.
 */
export function helpSections(index: DocsIndex, question: string, budget = HELP_DOCS_CHAR_BUDGET): DocSection[] {
  const kept: DocSection[] = [];
  let size = 0;
  for (const hit of index.search(question, HELP_SECTION_LIMIT)) {
    if (kept.length > 0 && size + hit.markdown.length > budget) break;
    kept.push(hit);
    size += hit.markdown.length;
  }
  return kept;
}

/**
 * Asks one help question. Sends exactly one request, in retrieval mode: the sections that match the
 * question go in the prompt. Throws the request pipeline's errors, and an error for an empty answer.
 */
export async function* askHelp({ question, snapshot, index, signal, fetchImpl }: HelpQuestion): AsyncGenerator<HelpEvent, void, void> {
  const sources = helpSections(index, question);
  const spec = buildAiRequestSpec(snapshot, {
    systemPrompt: HELP_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: helpUserMessage(question, sources) }],
    requestType: 'help',
    maxTokensOverride: HELP_MAX_TOKENS,
  });
  let text = '';
  for await (const event of streamAiToolLoop(spec, { signal, fetchImpl })) {
    if (event.type === 'delta') {
      const next = stripReasoningLive(event.content).trimStart();
      if (next === text) continue;
      text = next;
      yield { type: 'answer', text };
    } else if (event.type === 'done') {
      const stopped = event.result.finishReason === ABORTED_FINISH_REASON;
      const answer = stripReasoningLive(event.result.content).trim();
      if (!answer && !stopped) {
        throw new Error(`The model sent an empty answer (finish reason: ${event.result.finishReason ?? 'none'})`);
      }
      yield { type: 'done', text: answer, sources, stopped };
    }
  }
}
