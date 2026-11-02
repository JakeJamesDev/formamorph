import { describe, expect, it } from 'vitest';
import { readIntent } from '@/lib/formaquestion/helpIntent';
import {
  FORMAMORPH_INTENTS, INTENT_CASE_KINDS, INTENT_SETS, isCorrect, loadIntentCases, median, missedBars, parseIntentCases, summarizeIntent,
  type IntentCase, type IntentRow,
} from './help-intent-score';
import { INTENT_PROMPT, timeIntent } from './help-probe-shared';

const base = { set: 'dev', kind: 'help', intent: 'Help', message: 'How do I add a stat?' };
const parse = (c: Record<string, unknown>) => () => parseIntentCases({ cases: [{ id: 'one', ...base, ...c }] });

describe('parseIntentCases', () => {
  it('refuses a label that is no Intent, so a typo never scores', () => {
    expect(parse({ intent: 'help' })).toThrow(/intent help/);
    expect(parse({ alt: ['Lore'] })).toThrow(/alt/);
  });

  it('refuses an unknown set or kind, and a repeated id', () => {
    expect(parse({ set: 'tune' })).toThrow(/set tune/);
    expect(parse({ kind: 'misc' })).toThrow(/kind misc/);
    expect(() => parseIntentCases({ cases: [{ id: 'a', ...base }, { id: 'a', ...base }] })).toThrow(/repeated/);
  });

  it('refuses a follow-up with no last exchange and a two-ask with no second ask', () => {
    expect(parse({ kind: 'followUp' })).toThrow(/follow-up/);
    expect(parse({ kind: 'twoAsk' })).toThrow(/two-ask/);
  });
});

describe('the corpus', () => {
  const cases = loadIntentCases();

  it('holds every kind in both sets', () => {
    for (const set of INTENT_SETS) {
      const kinds = new Set(cases.filter((c) => c.set === set).map((c) => c.kind));
      expect([...INTENT_CASE_KINDS].filter((kind) => !kinds.has(kind))).toEqual([]);
    }
  });

  it('holds enough Help, Code and World cases for the 2% Chat bar to be one case or more per run', () => {
    expect(cases.filter((c) => FORMAMORPH_INTENTS.includes(c.intent)).length).toBeGreaterThanOrEqual(150);
  });

  it('holds questions in four other languages', () => {
    expect(new Set(cases.flatMap((c) => (c.lang ? [c.lang] : [])))).toEqual(new Set(['Spanish', 'French', 'German', 'Japanese']));
  });
});

const caseOf = (id: string, intent: IntentCase['intent'], extra: Partial<IntentCase> = {}): IntentCase => ({ id, set: 'dev', kind: 'help', intent, message: id, ...extra });
const row = (id: string, reply: string, ms = 100): IntentRow => ({ id, run: 0, reading: readIntent(reply), ms });

describe('summarizeIntent', () => {
  const cases = [
    caseOf('help', 'Help'), caseOf('code', 'Code'), caseOf('world', 'World', { alt: ['Code'] }),
    caseOf('chat', 'Chat'), caseOf('create', 'Create'), caseOf('two', 'Help', { kind: 'twoAsk', secondAsk: true }),
  ];

  it('counts Chat only over Help, Code and World, and Create only over the rest', () => {
    const s = summarizeIntent(cases, [
      row('help', 'Intent: Chat'), row('code', 'Intent: Create'), row('world', 'Intent: Code'),
      row('chat', 'Intent: Create'), row('create', 'Intent: Chat'), row('two', 'Intent: Help\nSecond ask: yes'),
    ]);
    expect(s.toChat).toBeCloseTo(1 / 4);
    expect(s.falseCreate).toBeCloseTo(2 / 5);
    expect(s.correct).toBeCloseTo(2 / 6);
    expect(s.secondAskRecall).toBe(1);
    expect(s.secondAskFalse).toBe(0);
  });

  it('scores a reading that names no Intent as wrong and unread', () => {
    const s = summarizeIntent([caseOf('help', 'Help')], [row('help', 'I think this is about settings.')]);
    expect(s.correct).toBe(0);
    expect(s.unread).toBe(1);
  });

  it('takes an alt Intent as correct and only for that case', () => {
    expect(isCorrect(cases[2], readIntent('Intent: Code'))).toBe(true);
    expect(isCorrect(cases[1], readIntent('Intent: World'))).toBe(false);
  });

  it('reads the median latency', () => {
    expect(median([300, 100, 200])).toBe(200);
    expect(median([100, 200, 300, 400])).toBe(250);
  });
});

describe('missedBars', () => {
  const pass = { readings: 1, correct: 0.9, toChat: 0.02, falseCreate: 0.05, unread: 0, secondAskRecall: 1, secondAskFalse: 0, latencyMs: 1500 };

  it('passes at each bar exactly', () => {
    expect(missedBars(pass)).toEqual([]);
  });

  it('names each bar a summary misses', () => {
    expect(missedBars({ ...pass, correct: 0.89, toChat: 0.021, falseCreate: 0.051, latencyMs: 1501 })).toEqual(['correct', 'toChat', 'falseCreate', 'latency']);
  });

  it('leaves latency to another number when told', () => {
    expect(missedBars({ ...pass, latencyMs: 4000 }, false)).toEqual([]);
  });
});

describe('timeIntent', () => {
  const call = (fetchImpl: typeof fetch, system: string) =>
    fetchImpl('http://probe.test', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'system', content: system }, { role: 'user', content: 'hi' }] }) });

  it('times only the requests that carry the classifier prompt', async () => {
    const times: number[] = [];
    const timed = timeIntent((async () => new Response('{}')) as typeof fetch, (ms) => times.push(ms));
    await call(timed, `${INTENT_PROMPT}\n\nWhere: the World Editor`);
    await call(timed, 'You answer Formamorph questions.');
    expect(times).toHaveLength(1);
  });
});
