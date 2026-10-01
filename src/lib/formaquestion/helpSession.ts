/**
 * The help session: one question in, one streamed answer and its sources out. It has no React and reads no
 * world or save. It sends through the AI Request Spec and the tool loop, the same path as every other call.
 */
import { buildAiRequestSpec, type AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { ABORTED_FINISH_REASON } from '@/lib/aiRequest/aiStream';
import { streamAiToolLoop } from '@/lib/aiRequest/toolLoop';
import { stripReasoningLive } from '@/lib/aiResponse';
import type { DocSection, DocsIndex } from '@/lib/docs/docsIndex';
import { toolsSupported } from '@/lib/reasoningEffort';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import type { RequestMessage } from '@/types';
import { createDocsLookup, docsContents, DOCS_LOOKUP } from './docsLookup';
import { readMarker } from './generalKnowledge';
import { surfaceHint } from './surfaceHint';
import { HELP_LOOKUP_SYSTEM_PROMPT, HELP_SYSTEM_PROMPT, helpLookupUserMessage, helpSystemPrompt, helpUserMessage } from './helpPrompt';

/** The most docs sections the search puts in one help request, or returns for one lookup call. */
export const HELP_SECTION_LIMIT = 5;

/**
 * The most characters of docs section text one help question holds, so the request fits a small model's
 * context. The contents list of a lookup request is not part of it.
 */
export const HELP_DOCS_CHAR_BUDGET = 12_000;

/** The answer cap in tokens: room for a long list of steps. */
export const HELP_MAX_TOKENS = 800;

/** The most earlier exchanges one help request carries, newest kept. */
export const HELP_HISTORY_EXCHANGES = 4;

/** An earlier question of the conversation and the answer text it got. */
export interface EarlierExchange {
  question: string;
  answer: string;
}

export interface HelpQuestion {
  question: string;
  /** The earlier exchanges of the conversation, oldest first. The request keeps the newest that have an answer. */
  history?: readonly EarlierExchange[];
  /** The AI Language setting. */
  language?: string;
  snapshot: AiSettingsSnapshot;
  index: DocsIndex;
  /** What the player has open when they send. Its mapped section leads the docs; an excluded Surface adds nothing. */
  surface?: Surface;
  /** Stop: the stream ends and the answer so far is kept. */
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export type HelpEvent =
  /** The answer so far. `flagged` once the general-knowledge marker came in. */
  | { type: 'answer'; text: string; flagged: boolean }
  /**
   * The end of the answer, with the docs sections that reached the model. A flagged answer did not come
   * from the guide, and `nearest` holds the search's sections for the question.
   */
  | { type: 'done'; text: string; sources: DocSection[]; stopped: boolean; flagged: boolean; nearest: DocSection[] };

/** The earlier exchanges a request carries: the newest that got answer text, at most the cap. */
function keptHistory(history: readonly EarlierExchange[]): EarlierExchange[] {
  return history.filter((exchange) => exchange.answer.trim()).slice(-HELP_HISTORY_EXCHANGES);
}

/**
 * The docs sections for a question, best first, while the docs text stays inside the budget. The top hit
 * is always kept. A follow-up such as "and then?" has few keywords of its own, so after the question's own
 * top hit come the hits of the previous question and the follow-up searched together.
 */
export function helpSections(index: DocsIndex, question: string, { history = [], budget = HELP_DOCS_CHAR_BUDGET }: {
  history?: readonly EarlierExchange[];
  budget?: number;
} = {}): DocSection[] {
  const previous = keptHistory(history).at(-1);
  const hits = previous
    ? [...index.search(question, 1), ...index.search(`${previous.question} ${question}`, HELP_SECTION_LIMIT)]
    : index.search(question, HELP_SECTION_LIMIT);
  const kept: DocSection[] = [];
  let size = 0;
  for (const hit of hits) {
    if (kept.length === HELP_SECTION_LIMIT) break;
    if (kept.some((section) => section.id === hit.id)) continue;
    if (kept.length > 0 && size + hit.markdown.length > budget) break;
    kept.push(hit);
    size += hit.markdown.length;
  }
  return kept;
}

/** The earlier exchanges as chat messages: the question and answer text only. */
function historyMessages(history: readonly EarlierExchange[]): RequestMessage[] {
  return keptHistory(history).flatMap((exchange): RequestMessage[] => [
    { role: 'user', content: exchange.question },
    { role: 'assistant', content: exchange.answer },
  ]);
}

/**
 * Asks one help question, after the earlier exchanges. The endpoint's known capability picks the mode
 * before anything is sent, and a failed request is never sent again in the other mode (ADR-0008).
 *
 * - Lookup mode, where the endpoint is known to take function calls: the prompt holds the contents list and
 *   the best search hit, and the model reads more sections through the docs lookup.
 * - Retrieval mode, everywhere else: the sections that match the question go in the prompt, in one request.
 *
 * Throws the request pipeline's errors, and an error for an empty answer.
 */
export async function* askHelp({
  question, history = [], language = '', snapshot, index, surface, signal, fetchImpl,
}: HelpQuestion): AsyncGenerator<HelpEvent, void, void> {
  const hint = surfaceHint(surface, index);
  const lead = hint ? [hint.section] : [];
  const found = helpSections(index, question, { history, budget: HELP_DOCS_CHAR_BUDGET - (hint?.section.markdown.length ?? 0) })
    .filter((section) => section.id !== hint?.section.id);
  const lookupMode = toolsSupported(snapshot.resolveTarget('help').reasoning);
  const inPrompt = [...lead, ...(lookupMode ? found.slice(0, 1) : found)];
  const lookup = lookupMode
    ? createDocsLookup(index, {
        budget: HELP_DOCS_CHAR_BUDGET - inPrompt.reduce((size, section) => size + section.markdown.length, 0),
        searchLimit: HELP_SECTION_LIMIT,
        held: inPrompt,
      })
    : null;
  const spec = buildAiRequestSpec(snapshot, {
    systemPrompt: helpSystemPrompt(language, lookup ? HELP_LOOKUP_SYSTEM_PROMPT : HELP_SYSTEM_PROMPT),
    messages: [...historyMessages(history), {
      role: 'user',
      content: lookup ? helpLookupUserMessage(question, docsContents(index), inPrompt, hint?.where) : helpUserMessage(question, inPrompt, hint?.where),
    }],
    requestType: 'help',
    maxTokensOverride: HELP_MAX_TOKENS,
    ...(lookup && { tools: [DOCS_LOOKUP] }),
  });
  let text = '';
  let marked = false;
  for await (const event of streamAiToolLoop(spec, { signal, fetchImpl, ...(lookup && { execute: lookup.execute }) })) {
    if (event.type === 'toolCalls') {
      // What the model wrote before a call is not the answer.
      if (text || marked) yield { type: 'answer', text: '', flagged: false };
      text = '';
      marked = false;
    } else if (event.type === 'delta') {
      const next = readMarker(stripReasoningLive(event.content));
      if (next.text === text && next.marked === marked) continue;
      ({ text, marked } = next);
      yield { type: 'answer', text, flagged: marked };
    } else if (event.type === 'done') {
      const sources = [...(lookup?.fetched() ?? []), ...inPrompt];
      const stopped = event.result.finishReason === ABORTED_FINISH_REASON;
      const answer = readMarker(stripReasoningLive(event.result.content), { final: true });
      if (!answer.text && !stopped) {
        throw new Error(`The model sent an empty answer (finish reason: ${event.result.finishReason ?? 'none'})`);
      }
      // No marker means grounded, unless no section reached the model at all.
      const flagged = answer.marked || sources.length === 0;
      const nearest = flagged ? helpSections(index, question, { history }) : [];
      yield { type: 'done', text: answer.text, sources, stopped, flagged, nearest };
    }
  }
}
