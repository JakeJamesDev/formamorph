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
  reasoning: { narration: { enabled: true, level: 'high' as const } },
  reasoningBudget: { narration: 30, choices: 0 },
  verbatim: { narration: 5 },
};

describe('share round-trip', () => {
  it('JSON: build → serialize → parse recovers the preset', () => {
    const r = parseSharedJson(serializeSharedJson(buildSharedPreset(base, APP)), APP);
    expect(r.ok).toBe(true);
    expect(r.preset).toMatchObject({ name: 'My Pack', style: 'markdown', reasoning: { narration: { enabled: true, level: 'high' } }, reasoningBudget: { narration: 30, choices: 0 }, verbatim: { narration: 5 } });
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

  it('carries the milestone selector texts through a share', () => {
    const withMilestone = {
      ...base,
      values: { ...values, milestoneSelectPrompt: 'Keep what matters.', milestoneSelectUserPrompt: 'Judge: <NEW MOMENTS>' } as PromptValues,
    };
    const r = parseSharedJson(serializeSharedJson(buildSharedPreset(withMilestone, APP)), APP);
    expect(r.warnings).toEqual([]);
    expect(r.preset!.values.milestoneSelectPrompt).toBe('Keep what matters.');
    expect(r.preset!.values.milestoneSelectUserPrompt).toBe('Judge: <NEW MOMENTS>');
  });

  it('carries the character note texts through a share', () => {
    const withNote = {
      ...base,
      values: { ...values, discoverEntityPrompt: 'Note who they are.', discoverEntityUserPrompt: 'Who: <CHARACTER NAME>' } as PromptValues,
    };
    const r = parseSharedJson(serializeSharedJson(buildSharedPreset(withNote, APP)), APP);
    expect(r.warnings).toEqual([]);
    expect(r.preset!.values.discoverEntityPrompt).toBe('Note who they are.');
    expect(r.preset!.values.discoverEntityUserPrompt).toBe('Who: <CHARACTER NAME>');
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

  it('reads the plain-string reasoning an older export carried, folding none into the switch', () => {
    const shared = buildSharedPreset(base, APP);
    const legacy = JSON.stringify({ ...shared, reasoning: { narration: 'high', choices: 'none', summary: 'global' } });
    const r = parseSharedJson(legacy, APP);
    expect(r.preset!.reasoning).toEqual({
      narration: { enabled: true, level: 'high' },
      choices: { enabled: false, level: 'global' },
      summary: { enabled: true, level: 'global' },
    });
  });

  it('drops malformed tuning entries', () => {
    const shared = buildSharedPreset(base, APP);
    const bad = JSON.stringify({ ...shared, reasoning: { narration: 42 }, verbatim: { narration: 'five' } });
    const r = parseSharedJson(bad, APP);
    expect(r.preset!.reasoning).toBeUndefined(); // 42 is neither a setting nor a legacy level
    expect(r.preset!.verbatim).toBeUndefined(); // 'five' is not a number
  });

  it('validates sampler settings — drops a non-numeric value, keeps well-formed ones', () => {
    const shared = buildSharedPreset(base, APP);
    const crafted = JSON.stringify({
      ...shared,
      samplers: {
        narration: { temperature: { custom: true, value: 'hot' } }, // malformed → whole kind dropped
        statUpdates: { temperature: { custom: true, value: 0.3 } },  // valid → kept
        choices: { temperature: { custom: true, value: Infinity } }, // non-finite → dropped
      },
    });
    const r = parseSharedJson(crafted, APP);
    expect(r.ok).toBe(true);
    expect(r.preset!.samplers).toEqual({ statUpdates: { temperature: { custom: true, value: 0.3 } } });
  });
});

describe('Max Output in a shared preset', () => {
  const caps = { thinking: { custom: true, value: 512 }, diary: { custom: false, value: 64 } };

  it('round-trips the map', () => {
    const r = parseSharedCode(serializeSharedCode(buildSharedPreset({ ...base, maxOutput: caps }, APP)), APP);
    expect(r.preset!.maxOutput).toEqual(caps);
  });

  it('keeps a shipped cap that sits off the slider step, such as Storyboard’s 300', () => {
    const storyboard = { storyboard: { custom: true, value: 300 } };
    const r = parseSharedJson(serializeSharedJson(buildSharedPreset({ ...base, maxOutput: storyboard }, APP)), APP);
    expect(r.preset!.maxOutput).toEqual(storyboard);
  });

  it('omits the map when it is empty', () => {
    expect(buildSharedPreset({ ...base, maxOutput: {} }, APP)).not.toHaveProperty('maxOutput');
  });

  it('imports an older preset without the map as all Auto', () => {
    const r = parseSharedJson(serializeSharedJson(buildSharedPreset(base, APP)), APP);
    expect(r.ok).toBe(true);
    expect(r.preset!.maxOutput).toBeUndefined();
  });

  it('drops malformed entries, keeps the rest, and clamps to the slider range', () => {
    const crafted = JSON.stringify({
      ...buildSharedPreset(base, APP),
      maxOutput: {
        thinking: { custom: true, value: 99999 },
        director: { custom: 'yes', value: 300 },
        character: { custom: true, value: 'big' },
        storyboard: { custom: true, value: 2 },
        narration: { custom: true, value: 64 },
        summary: 64,
      },
    });
    const r = parseSharedJson(crafted, APP);
    expect(r.ok).toBe(true);
    expect(r.preset!.maxOutput).toEqual({
      thinking: { custom: true, value: 2048 },
      storyboard: { custom: true, value: 8 },
    });
  });
});

// Per-prompt endpoint routing is stored globally, outside the preset store, precisely so a shared preset
// never carries endpoint ids (or tokens) that mean nothing — or something wrong — on another machine.
describe('endpoint routing is never shared', () => {
  it('omits routing from the exported artifact even when the caller passes one', () => {
    const withRouting = { ...base, promptEndpoints: { narration: 'some-preset-id' } };
    const shared = buildSharedPreset(withRouting, APP) as unknown as Record<string, unknown>;
    expect(shared.promptEndpoints).toBeUndefined();
    expect(JSON.stringify(shared)).not.toContain('some-preset-id');
  });

  it('drops a routing field crafted into an imported preset', () => {
    const crafted = JSON.stringify({ ...buildSharedPreset(base, APP), promptEndpoints: { narration: 'attacker-id' } });
    const r = parseSharedJson(crafted, APP);
    expect(r.ok).toBe(true);
    expect((r.preset as unknown as Record<string, unknown>).promptEndpoints).toBeUndefined();
  });
});

describe('Overview in a shared preset', () => {
  const overview = { author: 'Ann Author', description: 'Tuned for **small** models.', tags: ['slow burn', 'dialogue'], models: ['Cydonia-24B', 'Silver-Siren-12B'] };

  it('round-trips all four fields through the file and through the share code', () => {
    const shared = buildSharedPreset({ ...base, overview }, APP);
    expect(parseSharedJson(serializeSharedJson(shared), APP).preset!.overview).toEqual(overview);
    expect(parseSharedCode(serializeSharedCode(shared), APP).preset!.overview).toEqual(overview);
  });

  it('omits the block when every field is empty', () => {
    expect(buildSharedPreset({ ...base, overview: { author: '', description: '', tags: [], models: [] } }, APP).overview).toBeUndefined();
    expect(buildSharedPreset(base, APP).overview).toBeUndefined();
  });

  it('writes the block when one field has content', () => {
    expect(buildSharedPreset({ ...base, overview: { author: '', description: '', tags: [], models: ['M'] } }, APP).overview)
      .toEqual({ author: '', description: '', tags: [], models: ['M'] });
  });

  it('imports a payload from before the Overview with none and no new warning', () => {
    const r = parseSharedJson(serializeSharedJson(buildSharedPreset(base, APP)), APP);
    expect(r.ok).toBe(true);
    expect(r.preset!.overview).toBeUndefined();
    expect(r.warnings).toEqual([]);
  });

  it('drops wrong types field by field and still imports', () => {
    const crafted = JSON.stringify({
      ...buildSharedPreset(base, APP),
      overview: { author: 42, description: 'Kept.', tags: ['ok', 7, null, { x: 1 }], models: 'not-an-array' },
    });
    const r = parseSharedJson(crafted, APP);
    expect(r.ok).toBe(true);
    expect(r.preset!.overview).toEqual({ author: '', description: 'Kept.', tags: ['ok'], models: [] });
    expect(r.warnings).toEqual([]);
  });

  it('drops an Overview that is not an object, or has nothing left after the type check', () => {
    for (const bad of ['text', 5, null, ['a'], {}, { author: 1, description: [], tags: [2], models: [' '] }]) {
      const r = parseSharedJson(JSON.stringify({ ...buildSharedPreset(base, APP), overview: bad }), APP);
      expect(r.ok).toBe(true);
      expect(r.preset!.overview).toBeUndefined();
    }
  });

  it('normalizes tags and models like a stored Overview, with no truncation', () => {
    const long = 'x'.repeat(50_000);
    const crafted = JSON.stringify({
      ...buildSharedPreset(base, APP),
      overview: { author: long, description: long, tags: [' Dark ', 'dark', 'Slow'], models: [' Cydonia ', 'cydonia', 'Nemo'] },
    });
    const o = parseSharedJson(crafted, APP).preset!.overview!;
    expect(o.tags).toEqual(['dark', 'slow']);
    expect(o.models).toEqual(['Cydonia', 'Nemo']);
    expect(o.author).toHaveLength(50_000);
    expect(o.description).toHaveLength(50_000);
  });
});
