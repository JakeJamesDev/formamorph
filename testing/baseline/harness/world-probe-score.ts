// Structural metrics for the world probe: what one dumped AI-context turn shows about a world, with no
// judgment of the prose. The rubric reads the transcripts; these count what can break mechanically.
import { parseChoices } from '@/lib/choices';
import type { AiRequestRecord } from '@/lib/aiContext/requestRecord';

/** One captured request, as `window.__baseline.getDebugTurns()` returns it. */
export type DumpRequest = Pick<AiRequestRecord, 'type' | 'messages' | 'response' | 'statDiagnostics'>;

/** One turn of the AI-context dump. */
export interface DumpTurn {
  action: string;
  requests: DumpRequest[];
}

export interface TurnScore {
  /** `written` is an authored page one, which sends no narration request. */
  narration: 'ok' | 'empty' | 'written';
  /** Chat-template tokens found in any reply. */
  tokenLeaks: string[];
  /** The request types whose reply carries reasoning text. */
  reasoningLeaks: string[];
  /** Placeholder or chip tokens left unresolved, prefixed `sent:` or `reply:` by where they were found. */
  placeholders: string[];
  /** `absent` when the turn sent no choices request. */
  choices: 'ok' | 'bad' | 'absent';
  choiceCount: number;
  /** `absent` when the turn sent no stat request. */
  stat: 'ok' | 'invalid' | 'absent';
  /** Each reply line the app could not apply, as `reason: name`. */
  statProblems: string[];
  /** The world's own red flags on the narration. */
  flags: string[];
}

const TEMPLATE_TOKEN = /<\|[^<>\n]{0,40}>|<[^<>\n|]{1,40}\|>|<\/?(?:start_of_turn|end_of_turn|bos|eos|s)>|\[\/?INST\]/g;
const REASONING_TAG = /<\/?(?:think|thinking|reasoning|thought)\b[^>]*>|<\|channel>thought/i;
const REASONING_OPENER = /^\s*(?:thinking process:|the user (?:is asking|wants|has)|let me think|okay, (?:so|let's|let me))/i;
const PLACEHOLDER = /\{\{[^{}\n]{1,200}\}\}/g;
const CHIP = /<[A-Z][A-Z0-9 _]*[A-Z](?:\|[^<>\n]*)?>/g;
/** Stat diagnostics that mean the model wrote something the app could not apply. */
const STAT_FAULTS = new Set(['invalid', 'unknown', 'ambiguous']);

const unique = (items: string[]) => [...new Set(items)];
const textOf = (content: unknown): string => (typeof content === 'string' ? content : JSON.stringify(content ?? ''));

/** Every unresolved token in `text`. */
function unresolved(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER), ...text.matchAll(CHIP)].map((m) => m[0]);
}

/** Choices that follow the shipped contract: three to five lines, each an "I" action. */
function choicesOk(lines: string[]): boolean {
  return lines.length >= 3 && lines.length <= 5 && lines.every((line) => /^I\b/.test(line) && !/:$/.test(line));
}

/** Score one dumped turn. `flags` reads the narration for the world's own red flags. */
export function scoreTurn(turn: DumpTurn, flags: (narration: string) => string[] = () => []): TurnScore {
  const of = (type: string) => turn.requests.find((r) => r.type === type);
  const story = of('narration');
  const replies = turn.requests.filter((r) => typeof r.response === 'string');

  const choiceRequest = of('choices');
  const choiceLines = choiceRequest ? parseChoices(choiceRequest.response ?? '', Infinity) : [];

  const statRequest = of('statUpdates');
  const statProblems = (statRequest?.statDiagnostics ?? [])
    .filter((d) => STAT_FAULTS.has(d.reason))
    .map((d) => `${d.reason}: ${d.name}`);
  const statEmpty = !!statRequest && !(statRequest.response ?? '').trim();

  const narrationText = story?.response ?? '';
  return {
    narration: !story ? 'written' : narrationText.trim() ? 'ok' : 'empty',
    tokenLeaks: unique(replies.flatMap((r) => [...(r.response ?? '').matchAll(TEMPLATE_TOKEN)].map((m) => m[0]))),
    reasoningLeaks: unique(replies
      .filter((r) => REASONING_TAG.test(r.response ?? '') || REASONING_OPENER.test(r.response ?? ''))
      .map((r) => r.type)),
    placeholders: unique([
      ...turn.requests.flatMap((r) => r.messages.flatMap((m) => unresolved(textOf(m.content)))).map((t) => `sent:${t}`),
      ...replies.flatMap((r) => unresolved(r.response ?? '')).map((t) => `reply:${t}`),
    ]),
    choices: !choiceRequest ? 'absent' : choicesOk(choiceLines) ? 'ok' : 'bad',
    choiceCount: choiceLines.length,
    stat: !statRequest ? 'absent' : statEmpty || statProblems.length ? 'invalid' : 'ok',
    statProblems: statEmpty ? ['empty reply'] : statProblems,
    flags: narrationText ? flags(narrationText) : [],
  };
}

/** One arm's totals over every turn it played. Rates count only the turns that sent the request. */
export interface ArmSummary {
  turns: number;
  emptyNarration: number;
  tokenLeakTurns: number;
  reasoningLeakTurns: number;
  placeholderTurns: number;
  choicesOk: number;
  choicesSent: number;
  statOk: number;
  statSent: number;
  flaggedTurns: number;
}

export function summarizeArm(scores: readonly TurnScore[]): ArmSummary {
  const count = (test: (s: TurnScore) => boolean) => scores.filter(test).length;
  return {
    turns: scores.length,
    emptyNarration: count((s) => s.narration === 'empty'),
    tokenLeakTurns: count((s) => s.tokenLeaks.length > 0),
    reasoningLeakTurns: count((s) => s.reasoningLeaks.length > 0),
    placeholderTurns: count((s) => s.placeholders.length > 0),
    choicesOk: count((s) => s.choices === 'ok'),
    choicesSent: count((s) => s.choices !== 'absent'),
    statOk: count((s) => s.stat === 'ok'),
    statSent: count((s) => s.stat !== 'absent'),
    flaggedTurns: count((s) => s.flags.length > 0),
  };
}
