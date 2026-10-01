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
import type { RequestMessage } from '@/types';
import { createDocsLookup, docsContents, DOCS_LOOKUP } from './docsLookup';
import { HELP_LOOKUP_SYSTEM_PROMPT, HELP_SYSTEM_PROMPT, helpLookupUserMessage, helpSystemPrompt, helpUserMessage } from './helpPrompt';

/** The most docs sections one help request holds. */
export const HELP_SECTION_LIMIT = 5;

/** The most characters of docs text one help request holds, so the request fits a small model's context. */
export const HELP_DOCS_CHAR_BUDGET = 12_000;

/** The answer cap in tokens: room for a long list of steps. */
export const HELP_MAX_TOKENS = 800;

/** The most earlier exchanges one help request carries, newest kept. */
export const HELP_HISTORY_EXCHANGES = 4;

/** An earlier question and the answer text it got. */
export interface HelpTurn {
  question: string;
  answer: string;
}

export interface HelpQuestion {
  question: string;
  /** The earlier exchanges of the conversation, oldest first. The request keeps the newest that have an answer. */
  history?: readonly HelpTurn[];
  /** The AI Language setting. */
  language?: string;
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

/** The earlier exchanges a request carries: the newest that got answer text, at most the cap. */
function keptHistory(history: readonly HelpTurn[]): HelpTurn[] {
  return history.filter((turn) => turn.answer.trim()).slice(-HELP_HISTORY_EXCHANGES);
}

/**
 * The text a question is searched with. A follow-up such as "and then?" has few keywords of its own, so
 * the search also uses the previous question.
 */
export function helpSearchQuery(question: string, history: readonly HelpTurn[]): string {
  const previous = keptHistory(history).at(-1);
  return previous ? `${previous.question} ${question}` : question;
}

/** The earlier exchanges as chat messages: the question and answer text only. */
function historyMessages(history: readonly HelpTurn[]): RequestMessage[] {
  return keptHistory(history).flatMap((turn): RequestMessage[] => [
    { role: 'user', content: turn.question },
    { role: 'assistant', content: turn.answer },
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
  question, history = [], language = '', snapshot, index, signal, fetchImpl,
}: HelpQuestion): AsyncGenerator<HelpEvent, void, void> {
  const found = helpSections(index, helpSearchQuery(question, history));
  const lookupMode = toolsSupported(snapshot.resolveTarget('help').reasoning);
  const inPrompt = lookupMode ? found.slice(0, 1) : found;
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
      content: lookup ? helpLookupUserMessage(question, docsContents(index), inPrompt) : helpUserMessage(question, inPrompt),
    }],
    requestType: 'help',
    maxTokensOverride: HELP_MAX_TOKENS,
    ...(lookup && { tools: [DOCS_LOOKUP] }),
  });
  let text = '';
  for await (const event of streamAiToolLoop(spec, { signal, fetchImpl, ...(lookup && { execute: lookup.execute }) })) {
    if (event.type === 'toolCalls') {
      // What the model wrote before a call is not the answer.
      if (text) yield { type: 'answer', text: '' };
      text = '';
    } else if (event.type === 'delta') {
      const next = stripReasoningLive(event.content).trimStart();
      if (next === text) continue;
      text = next;
      yield { type: 'answer', text };
    } else if (event.type === 'done') {
      const sources = [...(lookup?.fetched() ?? []), ...inPrompt];
      const stopped = event.result.finishReason === ABORTED_FINISH_REASON;
      const answer = stripReasoningLive(event.result.content).trim();
      if (!answer && !stopped) {
        throw new Error(`The model sent an empty answer (finish reason: ${event.result.finishReason ?? 'none'})`);
      }
      yield { type: 'done', text: answer, sources, stopped };
    }
  }
}
