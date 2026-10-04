/**
 * The AI picks search source: one plain chat request lists every guide section heading, and the model copies
 * the lines of the sections that answer the question. It offers no function, so every endpoint takes it.
 */
import { requestAiText, type AiTextOptions } from '@/lib/aiRequest/aiText';
import type { AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import type { DocSection, DocsIndex } from '@/lib/docs/docsIndex';
import { guideSections } from './guideSections';
import type { HelpRequestOptions } from './helpPresets';

/** The most sections one pick reply names. */
export const HELP_PICK_LIMIT = 5;

/** The Default preset's cap of a pick reply in tokens: room for the copied lines. */
export const HELP_PICK_MAX_TOKENS = 150;

/** The sections a model picks from: one line for each whole guide section. */
export function pickList(index: DocsIndex): { lines: string[]; sections: DocSection[][] } {
  const whole = guideSections(index).filter((entry) => !entry.laterPart);
  return { lines: whole.map((entry) => entry.line), sections: whole.map((entry) => entry.parts) };
}

export interface PickQuestion {
  question: string;
  /** The pick prompt as the request carries it: the active preset's text, chips rendered. */
  prompt: string;
  /** The question before this one, for a follow-up. */
  earlier?: string;
  /** The answer the earlier question got, so the model reads what "it" or "that one" means. */
  earlierAnswer?: string;
  /** The open screen, as the answer request names it. */
  where?: string;
}

/** The one user message of a pick request: the section list, then the question. */
export function pickMessage(lines: readonly string[], { question, earlier, earlierAnswer, where }: Omit<PickQuestion, 'prompt'>): string {
  return [
    `<sections>\n${lines.join('\n')}\n</sections>`,
    ...(where ? [`The player asks from this screen: ${where}.`] : []),
    ...(earlier ? [`The player's earlier question: ${earlier}`] : []),
    ...(earlierAnswer ? [`The earlier answer:\n${earlierAnswer}`] : []),
    `Question: ${question}`,
    'Reply with the lines of the sections that answer the question, the best one first.',
  ].join('\n\n');
}

/** A line's letters and numbers as lowercase words, so a copy matches through markers, case and punctuation. */
const lineWords = (line: string) => (line.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).join(' ');

/**
 * The list positions a model picked: each line of its reply that copies a line of the list, as an index
 * into `lines`. An exact copy wins, so two lines with the same words stay apart. A reply line with no page
 * matches when one line alone ends with it.
 */
export function readPicks(reply: string, lines: readonly string[]): number[] {
  const listed = lines.map(lineWords);
  const picks: number[] = [];
  for (const source of reply.split('\n')) {
    const copied = source.replace(/^\s*(?:\d+[.)]\s*|[-*•]\s+)/, '');
    const words = lineWords(copied);
    if (!words) continue;
    let at = lines.indexOf(copied.replace(/\*\*/g, '').trim());
    if (at < 0) at = listed.indexOf(words);
    if (at < 0) {
      const ending = listed.flatMap((line, i) => (line.endsWith(` ${words}`) ? [i] : []));
      at = ending.length === 1 ? ending[0] : -1;
    }
    if (at >= 0 && !picks.includes(at)) picks.push(at);
    if (picks.length === HELP_PICK_LIMIT) break;
  }
  return picks;
}

/**
 * Asks the model which guide sections answer the question, best first; none when the reply copies no line.
 * It sends as the help kind with reasoning off, and with the samplers and cap the caller gives. Throws the
 * request pipeline's errors, and an `AbortError` when stopped. `observe` gets the request and its reply.
 */
export async function requestPicks(
  index: DocsIndex,
  ask: PickQuestion,
  snapshot: AiSettingsSnapshot,
  { temperature, repetitionPenalty, maxTokens }: HelpRequestOptions,
  options: AiTextOptions = {},
): Promise<DocSection[]> {
  const { lines, sections } = pickList(index);
  const reply = await requestAiText(snapshot, {
    systemPrompt: ask.prompt,
    messages: [{ role: 'user', content: pickMessage(lines, ask) }],
    requestType: 'help',
    maxTokensOverride: maxTokens,
    samplerOverride: { temperature, repetitionPenalty },
  }, options);
  return readPicks(reply, lines).flatMap((at) => sections[at]);
}
