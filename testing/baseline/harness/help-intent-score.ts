// The Intent probe's corpus and score. `help-intent-probe.cli.ts` asks the model; this file reads the cases and
// scores the readings against the bars of formaquestion-intents ticket 06.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { INTENTS, type Intent, type IntentReading } from '@/lib/formaquestion/helpIntent';

export const INTENT_SETS = ['dev', 'blind'] as const;
export type IntentSet = (typeof INTENT_SETS)[number];

export const INTENT_CASE_KINDS = ['help', 'code', 'world', 'lore', 'chat', 'create', 'offEditor', 'twoAsk', 'oneAsk', 'followUp', 'language'] as const;
export type IntentCaseKind = (typeof INTENT_CASE_KINDS)[number];

/** One labeled message of the corpus. */
export interface IntentCase {
  id: string;
  set: IntentSet;
  kind: IntentCaseKind;
  intent: Intent;
  /** Other Intents a correct reading may give, for a question whose plans both answer it. */
  alt?: Intent[];
  secondAsk?: boolean;
  where?: string;
  message: string;
  earlier?: string;
  earlierAnswer?: string;
  lang?: string;
}

/** The Intents the 2% Chat bar counts: the questions about Formamorph or its open world (Q29). */
export const FORMAMORPH_INTENTS: readonly Intent[] = ['Help', 'Code', 'World'];

const isIntent = (value: unknown): value is Intent => INTENTS.some((intent) => intent === value);

/** The corpus, checked: a bad label, kind, set or a repeated id is an error, so a typo never scores. */
export function parseIntentCases(raw: unknown): IntentCase[] {
  const cases = (raw as { cases?: unknown }).cases;
  if (!Array.isArray(cases)) throw new Error('help-intent-cases: no cases array');
  const seen = new Set<string>();
  return cases.map((value: unknown) => {
    const c = value as IntentCase;
    const problem = typeof c.id !== 'string' ? 'no id'
      : seen.has(c.id) ? 'a repeated id'
      : !INTENT_SETS.includes(c.set) ? `set ${String(c.set)}`
      : !INTENT_CASE_KINDS.includes(c.kind) ? `kind ${String(c.kind)}`
      : !isIntent(c.intent) ? `intent ${String(c.intent)}`
      : c.alt && !c.alt.every(isIntent) ? 'an alt that is no Intent'
      : typeof c.message !== 'string' || !c.message.trim() ? 'no message'
      : c.kind === 'followUp' && !(c.earlier && c.earlierAnswer) ? 'a follow-up with no last exchange'
      : c.kind === 'twoAsk' && c.secondAsk !== true ? 'a two-ask with no second ask'
      : undefined;
    if (problem) throw new Error(`help-intent-cases: ${String(c.id)} has ${problem}`);
    seen.add(c.id);
    return c;
  });
}

export const loadIntentCases = (): IntentCase[] =>
  parseIntentCases(JSON.parse(readFileSync(path.resolve('testing/baseline/help-intent-cases.json'), 'utf8')));

/** One classifier reading of one case in one run. `reading` null is a reply that names no known Intent, or a failed request. */
export interface IntentRow {
  id: string;
  run: number;
  reading: IntentReading | null;
  ms: number;
  error?: string;
}

export const isCorrect = (c: IntentCase, reading: IntentReading | null): boolean =>
  reading !== null && (reading.intent === c.intent || (c.alt ?? []).includes(reading.intent));

/** The numbers of one arm over some cases. Shares are 0–1; `latencyMs` is the median. */
export interface IntentSummary {
  readings: number;
  correct: number;
  /** Help, Code and World readings given Chat, of every Help, Code and World reading. */
  toChat: number;
  /** Chat, Help, Code and World readings given Create, of every one of them. */
  falseCreate: number;
  /** Readings that named no Intent: the app sends the full request. */
  unread: number;
  /** Second asks marked, of the two-ask cases, and marked on a case with none, of those. */
  secondAskRecall: number;
  secondAskFalse: number;
  latencyMs: number;
}

const share = (n: number, d: number) => (d === 0 ? 0 : n / d);

export const median = (values: readonly number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function summarizeIntent(cases: readonly IntentCase[], rows: readonly IntentRow[]): IntentSummary {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const scored = rows.flatMap((row) => {
    const c = byId.get(row.id);
    return c ? [{ c, row }] : [];
  });
  const formamorph = scored.filter(({ c }) => FORMAMORPH_INTENTS.includes(c.intent));
  const notCreate = scored.filter(({ c }) => c.intent !== 'Create');
  const twoAsk = scored.filter(({ c }) => c.secondAsk === true);
  const oneAsk = scored.filter(({ c }) => c.secondAsk !== true);
  return {
    readings: scored.length,
    correct: share(scored.filter(({ c, row }) => isCorrect(c, row.reading)).length, scored.length),
    toChat: share(formamorph.filter(({ row }) => row.reading?.intent === 'Chat').length, formamorph.length),
    falseCreate: share(notCreate.filter(({ row }) => row.reading?.intent === 'Create').length, notCreate.length),
    unread: share(scored.filter(({ row }) => row.reading === null).length, scored.length),
    secondAskRecall: share(twoAsk.filter(({ row }) => row.reading?.secondAsk).length, twoAsk.length),
    secondAskFalse: share(oneAsk.filter(({ row }) => row.reading?.secondAsk).length, oneAsk.length),
    latencyMs: median(scored.map(({ row }) => row.ms)),
  };
}

/** The bars of ticket 06: Q29, Q8's false-Create bar and Q63. Latency is read from the help baseline's alongside-picks number. */
export const INTENT_BARS = { correct: 0.9, toChat: 0.02, falseCreate: 0.05, latencyMs: 1500 } as const;

/** The bars a summary misses, by name; empty on a pass. `latency` false leaves the latency bar to another number. */
export function missedBars(summary: IntentSummary, latency = true): string[] {
  return [
    ...(summary.correct < INTENT_BARS.correct ? ['correct'] : []),
    ...(summary.toChat > INTENT_BARS.toChat ? ['toChat'] : []),
    ...(summary.falseCreate > INTENT_BARS.falseCreate ? ['falseCreate'] : []),
    ...(latency && summary.latencyMs > INTENT_BARS.latencyMs ? ['latency'] : []),
  ];
}

/** Each case's Intent counts over the rows, for the worst-case list: how often each label came back. */
export function confusions(cases: readonly IntentCase[], rows: readonly IntentRow[]): { c: IntentCase; wrong: number; of: number; got: Record<string, number> }[] {
  return cases.map((c) => {
    const own = rows.filter((row) => row.id === c.id);
    const got: Record<string, number> = {};
    for (const row of own) got[row.reading?.intent ?? 'none'] = (got[row.reading?.intent ?? 'none'] ?? 0) + 1;
    return { c, wrong: own.filter((row) => !isCorrect(c, row.reading)).length, of: own.length, got };
  }).filter((entry) => entry.wrong > 0).sort((a, b) => b.wrong / b.of - a.wrong / a.of);
}

const has = (text: string, words: RegExp) => words.test(text.toLowerCase());

/**
 * The keyword floor: a reading from word lists alone, with no model. It is a reference line for the report, not
 * a control the bars compare against.
 */
export function keywordIntent({ message, earlier }: Pick<IntentCase, 'message' | 'earlier'>): IntentReading {
  const text = `${earlier ?? ''} ${message}`;
  const intent: Intent = has(text, /\b(create|make me|design|come up with|write up|new (character|npc|villain|companion))\b/) ? 'Create'
    : has(text, /\b(script|stat code|code|js|return|stats\.)\b|`/) ? 'Code'
    : has(text, /\b(how do i|how can i|where|setting|turn on|turn off|button|tab|export|import|save|endpoint|model)\b/) ? 'Help'
    : has(text, /\b(who|this world|what happened|story|why is|why did)\b/) ? 'World'
    : 'Chat';
  return { intent, secondAsk: has(message, /\b(also|and then|then tell|second|oh and)\b/) };
}
