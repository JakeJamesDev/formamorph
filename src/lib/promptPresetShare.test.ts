import { describe, it, expect } from 'vitest';
import {
  buildSharedPreset, serializeSharedJson, serializeSharedCode, parseSharedJson, parseSharedCode,
  SHARE_KIND, SHARE_CODE_PREFIX,
} from './promptPresetShare';
import type { PromptValues } from './promptPresets';

const APP = '2.1.0';
const values = { systemPrompt: 'You are the narrator — vivid, tight.', choicesPrompt: 'List "quoted" options.' } as unknown as PromptValues;
const base = {
  name: 'My Pack', style: 'markdown' as const, values,
  samplers: { statUpdates: { temperature: { custom: true, value: 0.2 } } },
  reasoning: { narration: 'high' as const },
  reasoningBudget: { narration: 30, choices: 0 },
  verbatim: { narration: 5 },
};

describe('share round-trip', () => {
  it('JSON: build → serialize → parse recovers the preset', () => {
    const r = parseSharedJson(serializeSharedJson(buildSharedPreset(base, APP)), APP);
    expect(r.ok).toBe(true);
    expect(r.preset).toMatchObject({ name: 'My Pack', style: 'markdown', reasoning: { narration: 'high' }, reasoningBudget: { narration: 30, choices: 0 }, verbatim: { narration: 5 } });
    expect(r.preset!.values.systemPrompt).toBe(values.systemPrompt);
    expect(r.warnings).toEqual([]);
  });

  it('code: prefixed base64 round-trips, and unicode survives', () => {
    const uni = { name: 'Ünïcode — “curly”', style: 'labels' as const, values: { systemPrompt: 'em—dash, “quotes”, café' } as unknown as PromptValues };
    const code = serializeSharedCode(buildSharedPreset(uni, APP));
    expect(code.startsWith(SHARE_CODE_PREFIX)).toBe(true);
    const r = parseSharedCode(code, APP);
    expect(r.ok).toBe(true);
    expect(r.preset!.name).toBe('Ünïcode — “curly”');
    expect(r.preset!.style).toBe('labels');
    expect(r.preset!.values.systemPrompt).toBe('em—dash, “quotes”, café');
  });

  it('code parses even without the prefix', () => {
    const code = serializeSharedCode(buildSharedPreset(base, APP)).slice(SHARE_CODE_PREFIX.length);
    expect(parseSharedCode(code, APP).ok).toBe(true);
  });
});

describe('buildSharedPreset', () => {
  it('omits empty tuning maps', () => {
    const s = buildSharedPreset({ name: 'Text Only', style: 'markdown', values, samplers: {}, reasoning: {}, reasoningBudget: {}, verbatim: {} }, APP);
    expect(s.samplers).toBeUndefined();
    expect(s.reasoning).toBeUndefined();
    expect(s.reasoningBudget).toBeUndefined();
    expect(s.verbatim).toBeUndefined();
    expect(s.kind).toBe(SHARE_KIND);
    expect(s.appVersion).toBe(APP);
  });
});

describe('sanitize / compat', () => {
  it('rejects non-preset objects and junk', () => {
    expect(parseSharedJson('{"kind":"something-else"}', APP).ok).toBe(false);
    expect(parseSharedJson('not json', APP).ok).toBe(false);
    expect(parseSharedCode('@@@not-base64@@@', APP).ok).toBe(false);
  });

  it('drops unknown text keys with a warning, keeps known ones', () => {
    const shared = buildSharedPreset(base, APP);
    const withJunk = JSON.stringify({ ...shared, values: { ...shared.values, bogusKey: 'x', systemPrompt: 'kept' } });
    const r = parseSharedJson(withJunk, APP);
    expect(r.ok).toBe(true);
    expect(r.preset!.values.systemPrompt).toBe('kept');
    expect('bogusKey' in (r.preset!.values as Record<string, unknown>)).toBe(false);
    expect(r.warnings.some((w) => /ignored/.test(w))).toBe(true);
  });

  it('warns on a different source app version but still imports', () => {
    const r = parseSharedJson(serializeSharedJson(buildSharedPreset(base, '2.0.3')), '2.1.0');
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes('2.0.3'))).toBe(true);
  });

  it('warns on a newer format version', () => {
    const shared = buildSharedPreset(base, APP);
    const r = parseSharedJson(JSON.stringify({ ...shared, formatVersion: 99 }), APP);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => /newer format/.test(w))).toBe(true);
  });

  it('drops malformed tuning entries', () => {
    const shared = buildSharedPreset(base, APP);
    const bad = JSON.stringify({ ...shared, reasoning: { narration: 42 }, verbatim: { narration: 'five' } });
    const r = parseSharedJson(bad, APP);
    expect(r.preset!.reasoning).toBeUndefined(); // 42 is not a string
    expect(r.preset!.verbatim).toBeUndefined(); // 'five' is not a number
  });
});
