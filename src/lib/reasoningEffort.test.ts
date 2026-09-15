import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reasoningEffortBody, reasoningLevelOptions, promptReasoningLevelOptions, defaultPromptReasoning, defaultPromptReasoningSetting, resolvePromptReasoning, resolveReasoningSetting, resolvePromptReasoningSetting, parseReasoningSetting, parsePromptReasoningSetting, parseReasoningCapability, reasoningCapabilityFromLevels, reasoningRuledOut, defaultReasoningBudgetPct, resolveReasoningBudgetPct, reasoningBudgetBody, isReasoningEngaged, nativeReasoningSuppressed, MIN_REASONING_BUDGET_PCT, resolveReasoningCapability, type ReasoningCapability, type ReasoningEffortField } from './reasoningEffort';
import { resetProbeMemo } from '@/lib/probeMemo';
import type { AIRequestType } from '@/types';

/** A record answering the levels question only, as a probe leaves it. */
const accepts = (...levels: ReasoningEffortField[]): ReasoningCapability => reasoningCapabilityFromLevels(levels, 'probe');

const ALL_KINDS: AIRequestType[] = [
  'thinking', 'director', 'character', 'storyboard', 'narration', 'choices', 'statUpdates', 'locationChange',
  'summary', 'milestoneSelect', 'diary', 'discoverEntity', 'timePassed', 'openingTime', 'sceneTags',
];

describe('reasoningEffortBody', () => {
  const all = accepts('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max');

  it('sends the hint verbatim for every non-auto level the endpoint accepts', () => {
    expect(reasoningEffortBody('none', all)).toEqual({ reasoning_effort: 'none' });
    expect(reasoningEffortBody('low', all)).toEqual({ reasoning_effort: 'low' });
    expect(reasoningEffortBody('medium', all)).toEqual({ reasoning_effort: 'medium' });
    expect(reasoningEffortBody('high', all)).toEqual({ reasoning_effort: 'high' });
    expect(reasoningEffortBody('max', all)).toEqual({ reasoning_effort: 'max' });
  });

  it('omits the field for auto (send nothing → endpoint default)', () => {
    expect(reasoningEffortBody('auto', all)).toEqual({});
    expect('reasoning_effort' in reasoningEffortBody('auto', all)).toBe(false);
  });

  it('omits a value the active endpoint does not accept (a stale selection cannot 400 a turn)', () => {
    // Ollama-like: accepts max, not minimal.
    const ollama = accepts('none', 'low', 'medium', 'high', 'max');
    expect(reasoningEffortBody('minimal', ollama)).toEqual({});
    expect(reasoningEffortBody('max', ollama)).toEqual({ reasoning_effort: 'max' });
    expect(reasoningEffortBody('none', accepts('low', 'medium', 'high'))).toEqual({});
  });

  it('sends nothing until the levels question is answered — an unknown record omits the field', () => {
    expect(reasoningEffortBody('low', { reasons: null, levels: null, budget: null, sources: {} })).toEqual({});
    expect(reasoningEffortBody('low', null)).toEqual({});
    expect(reasoningEffortBody('low')).toEqual({});
  });

  it('sends nothing to a conclusively non-reasoning endpoint (empty levels), even none', () => {
    expect(reasoningEffortBody('none', accepts())).toEqual({});
    expect(reasoningEffortBody('high', accepts())).toEqual({});
  });

  it('sends nothing to a model the record says does not reason, whatever levels it lists', () => {
    const listedButNotReasoning: ReasoningCapability = {
      reasons: false, levels: ['none', 'low', 'high'], budget: null, sources: { reasons: 'native' },
    };
    expect(reasoningEffortBody('high', listedButNotReasoning)).toEqual({});
  });
});

describe('the capability record', () => {
  it('reads an empty levels answer as conclusive: the model does not reason, from that same source', () => {
    expect(reasoningCapabilityFromLevels([], 'probe')).toEqual({
      reasons: false, levels: [], budget: null, sources: { levels: 'probe', reasons: 'probe' },
    });
  });

  it('leaves the reasons question open when levels came back non-empty (accepting `none` proves nothing)', () => {
    expect(reasoningCapabilityFromLevels(['none', 'low'], 'probe')).toEqual({
      reasons: null, levels: ['none', 'low'], budget: null, sources: { levels: 'probe' },
    });
  });

  it('rules reasoning out on a negative reasons answer or an empty levels list, never on an unknown one', () => {
    expect(reasoningRuledOut({ reasons: false, levels: null, budget: null, sources: {} })).toBe(true);
    expect(reasoningRuledOut(accepts())).toBe(true);
    expect(reasoningRuledOut(accepts('none', 'low'))).toBe(false);
    expect(reasoningRuledOut({ reasons: null, levels: null, budget: null, sources: {} })).toBe(false);
    expect(reasoningRuledOut(null)).toBe(false);
  });

  it('loads a cache entry written as a bare effort list, so an update re-detects nothing', () => {
    expect(parseReasoningCapability(['none', 'low', 'high'])).toEqual({
      reasons: null, levels: ['none', 'low', 'high'], budget: null, sources: { levels: 'cache' },
    });
  });

  it('keeps a cached empty list hiding the controls, though its reasons answer is unknown', () => {
    const migrated = parseReasoningCapability([]);
    expect(migrated).toEqual({ reasons: null, levels: [], budget: null, sources: { levels: 'cache' } });
    expect(reasoningRuledOut(migrated)).toBe(true);
  });

  it('loads a stored record back verbatim', () => {
    const stored: ReasoningCapability = {
      reasons: true, levels: ['none', 'low'], budget: true, sources: { reasons: 'native', levels: 'probe', budget: 'engine' },
    };
    expect(parseReasoningCapability(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it('drops a stored source it does not know, rather than letting it stand as one', () => {
    const loaded = parseReasoningCapability({
      reasons: true, levels: null, budget: null, sources: { reasons: 'astrology', levels: 'probe', mood: 'probe' },
    });
    expect(loaded?.sources).toEqual({ levels: 'probe' });
  });

  it('rejects anything that is not a record or a list of known levels', () => {
    expect(parseReasoningCapability(['none', 'turbo'])).toBeNull();
    expect(parseReasoningCapability('high')).toBeNull();
    expect(parseReasoningCapability(null)).toBeNull();
    expect(parseReasoningCapability({ reasons: 'yes', levels: null, budget: null })).toBeNull();
    expect(parseReasoningCapability({ reasons: null, levels: ['turbo'], budget: null })).toBeNull();
  });
});

describe('nativeReasoningSuppressed', () => {
  it('suppresses only the narration call under Inline mode, which writes its own <think> block', () => {
    expect(nativeReasoningSuppressed('inline', 'narration')).toBe(true);
  });

  it('leaves every other kind under Inline, and every kind under the other modes, to its own choice', () => {
    for (const kind of ALL_KINDS.filter((k) => k !== 'narration')) expect(nativeReasoningSuppressed('inline', kind)).toBe(false);
    for (const mode of ['off', 'precall', 'staged'] as const) {
      for (const kind of ALL_KINDS) expect(nativeReasoningSuppressed(mode, kind)).toBe(false);
    }
  });
});

describe('per-prompt reasoning', () => {
  it('ships tiered defaults: narration Global, planning and memory passes Low, parsers and choices None', () => {
    expect(defaultPromptReasoning('narration')).toBe('global');
    for (const kind of ['thinking', 'director', 'character', 'storyboard', 'summary', 'diary'] as const) {
      expect(defaultPromptReasoning(kind)).toBe('low');
    }
    for (const kind of ['choices', 'statUpdates', 'locationChange', 'milestoneSelect', 'discoverEntity', 'timePassed', 'openingTime', 'sceneTags'] as const) {
      expect(defaultPromptReasoning(kind)).toBe('none');
    }
  });

  it('ships the switch shape: narration on at Global, tiers on at Low, the rest off remembering Global', () => {
    expect(defaultPromptReasoningSetting('narration')).toEqual({ enabled: true, level: 'global' });
    expect(defaultPromptReasoningSetting('director')).toEqual({ enabled: true, level: 'low' });
    expect(defaultPromptReasoningSetting('choices')).toEqual({ enabled: false, level: 'global' });
  });

  it('lists a prompt\'s strengths as Global, Model Default, then the accepted levels in order, never none', () => {
    const opts = promptReasoningLevelOptions(accepts('high', 'none', 'low')); // out of order in
    expect(opts.map((o) => o.value)).toEqual(['global', 'auto', 'low', 'high']);
    expect(opts.map((o) => o.label)).toEqual(['Global', 'Model Default', 'Low', 'High']);
    expect(promptReasoningLevelOptions(null).map((o) => o.value)).toEqual(['global', 'auto', 'low', 'medium', 'high']); // safe fallback
  });

  it('lists the endpoint-wide strengths with full-word labels for backend-specific levels', () => {
    const cloud = reasoningLevelOptions(accepts('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'));
    expect(cloud.map((o) => o.label)).toEqual(['Model Default', 'Minimal', 'Low', 'Medium', 'High', 'Extra High', 'Max']);
    expect(cloud.map((o) => o.value)).not.toContain('none');
  });

  it('resolves Global to the endpoint-wide effort, explicit choices to themselves', () => {
    expect(resolvePromptReasoning('narration', {}, 'high', 'off')).toBe('high'); // default global → follows global
    expect(resolvePromptReasoning('narration', { narration: 'low' }, 'high', 'off')).toBe('low'); // override wins
    expect(resolvePromptReasoning('choices', {}, 'high', 'off')).toBe('none'); // default none, ignores global
    expect(resolvePromptReasoning('choices', { choices: 'global' }, 'medium', 'off')).toBe('medium');
  });

  it('honors a stored level on every kind, in every mode', () => {
    for (const mode of ['off', 'precall', 'staged', 'inline'] as const) {
      expect(resolvePromptReasoning('summary', { summary: 'high' }, 'low', mode)).toBe('high');
      expect(resolvePromptReasoning('statUpdates', { statUpdates: 'global' }, 'medium', mode)).toBe('medium');
      expect(resolvePromptReasoning('director', {}, 'high', mode)).toBe('low'); // shipped tier
    }
  });

  it('resolves Inline narration to none whatever is stored or set globally', () => {
    expect(resolvePromptReasoning('narration', { narration: 'high' }, 'high', 'inline')).toBe('none');
    expect(resolvePromptReasoning('narration', {}, 'max', 'inline')).toBe('none');
    expect(resolvePromptReasoning('narration', { narration: 'high' }, 'high', 'staged')).toBe('high');
  });
});

describe('reasoning budget (local engine)', () => {
  it('ships narration at 40% and every other prompt at 25%; the switch, not the %, decides off', () => {
    expect(defaultReasoningBudgetPct('narration')).toBe(40);
    for (const kind of ALL_KINDS.filter((k) => k !== 'narration')) expect(defaultReasoningBudgetPct(kind)).toBe(25);
  });

  it('resolves every kind to its stored/default %, clamped to the slider floor and 100', () => {
    expect(resolveReasoningBudgetPct('narration', {})).toBe(40);
    expect(resolveReasoningBudgetPct('narration', { narration: 20 })).toBe(20);
    expect(resolveReasoningBudgetPct('choices', { choices: 30 })).toBe(30);
    expect(resolveReasoningBudgetPct('summary', { summary: 90 })).toBe(90);
    expect(resolveReasoningBudgetPct('statUpdates', { statUpdates: 0 })).toBe(MIN_REASONING_BUDGET_PCT); // clamp low
    expect(resolveReasoningBudgetPct('narration', { narration: 250 })).toBe(100); // clamp high
  });

  it('converts the % to a token cap against max output for any resolved level', () => {
    expect(reasoningBudgetBody('auto', 'narration', {}, 500)).toEqual({ thinking_budget_tokens: 200 }); // 40% of 500
    expect(reasoningBudgetBody('high', 'narration', { narration: 20 }, 500)).toEqual({ thinking_budget_tokens: 100 });
    expect(reasoningBudgetBody('low', 'choices', { choices: 30 }, 400)).toEqual({ thinking_budget_tokens: 120 });
    expect(reasoningBudgetBody('low', 'director', {}, 400)).toEqual({ thinking_budget_tokens: 100 }); // 25% default
  });

  it('sends 0 when the resolved choice is none, whatever % is stored', () => {
    expect(reasoningBudgetBody('none', 'narration', { narration: 40 }, 500)).toEqual({ thinking_budget_tokens: 0 });
    expect(reasoningBudgetBody('none', 'choices', {}, 500)).toEqual({ thinking_budget_tokens: 0 });
  });
});

describe('reasoning settings (switch + strength)', () => {
  it('resolves to the level while on and to none while off', () => {
    expect(resolveReasoningSetting({ enabled: true, level: 'high' })).toBe('high');
    expect(resolveReasoningSetting({ enabled: true, level: 'auto' })).toBe('auto');
    expect(resolveReasoningSetting({ enabled: false, level: 'high' })).toBe('none');
    expect(resolvePromptReasoningSetting({ enabled: true, level: 'global' })).toBe('global');
    expect(resolvePromptReasoningSetting({ enabled: false, level: 'global' })).toBe('none');
  });

  it('reads the current object and rejects a malformed one', () => {
    expect(parseReasoningSetting({ enabled: false, level: 'medium' })).toEqual({ enabled: false, level: 'medium' });
    expect(parseReasoningSetting({ enabled: 'yes', level: 'medium' })).toBeNull();
    expect(parseReasoningSetting({ enabled: true, level: 'none' })).toBeNull(); // none is the switch, not a level
    expect(parseReasoningSetting({ enabled: true, level: 'global' })).toBeNull(); // global is prompt-only
    expect(parsePromptReasoningSetting({ enabled: true, level: 'global' })).toEqual({ enabled: true, level: 'global' });
    expect(parsePromptReasoningSetting(42)).toBeNull();
  });

  it('folds the plain string written before the switch existed: none → off, a level → on at that level', () => {
    expect(parseReasoningSetting('none')).toEqual({ enabled: false, level: 'auto' });
    expect(parseReasoningSetting('auto')).toEqual({ enabled: true, level: 'auto' });
    expect(parseReasoningSetting('xhigh')).toEqual({ enabled: true, level: 'xhigh' });
    expect(parseReasoningSetting('bogus')).toBeNull();
    expect(parsePromptReasoningSetting('none')).toEqual({ enabled: false, level: 'global' });
    expect(parsePromptReasoningSetting('global')).toEqual({ enabled: true, level: 'global' });
    expect(parsePromptReasoningSetting('low')).toEqual({ enabled: true, level: 'low' });
  });
});

describe('isReasoningEngaged', () => {
  it('is false for the off/auto setup when no prompt carries a positive level', () => {
    expect(isReasoningEngaged('off', 'auto', { narration: 'global', choices: 'none' })).toBe(false);
    expect(isReasoningEngaged('off', 'auto', {})).toBe(false);
  });
  it('is true when a Thinking mode is active', () => {
    expect(isReasoningEngaged('staged', 'auto', {})).toBe(true);
    expect(isReasoningEngaged('inline', 'auto', {})).toBe(true);
  });
  it('is true when a global native effort is chosen', () => {
    expect(isReasoningEngaged('off', 'high', {})).toBe(true);
  });
  it('is true when a per-prompt positive level is set, but not for global/none', () => {
    expect(isReasoningEngaged('off', 'auto', { narration: 'high' })).toBe(true);
    expect(isReasoningEngaged('off', 'auto', { narration: 'global', choices: 'none' })).toBe(false);
  });
});

describe('resolveReasoningCapability: the budget answer', () => {
  // Each source's own shape is covered in reasoningCapability.test.ts. These cases guard one contract:
  // which answers settle the budget question, since the request builder and the Options tab both read it.
  beforeEach(() => resetProbeMemo());

  const TARGET = { url: 'http://localhost:1234/v1/chat/completions', token: '', model: 'meromero' };
  const NATIVE_LIST = 'http://localhost:1234/api/v1/models';

  /** LM Studio answering its native list with one model, and 404ing every other advertisement path. */
  const lmStudio = (models: unknown[]) => vi.fn(async (u: string) => (
    u === NATIVE_LIST
      ? { ok: true, status: 200, json: async () => ({ models }), text: async () => '' }
      : { ok: false, status: 404, json: async () => ({}), text: async () => '' }
  ) as unknown as Response);

  it('takes a token budget when the native list calls the model reasoning', async () => {
    const record = await resolveReasoningCapability(TARGET, lmStudio([{ key: 'meromero', capabilities: { reasoning: {} } }]));
    expect(record?.budget).toBe(true);
    expect(record?.sources.budget).toBe('native');
  });

  it('never takes a budget on a model the native list calls non-reasoning', async () => {
    const record = await resolveReasoningCapability({ ...TARGET, model: 'cydonia' }, lmStudio([{ key: 'cydonia', capabilities: {} }]));
    expect(record?.budget).not.toBe(true);
  });

  it('answers every question from the native list when it calls the model non-reasoning, sending no probe', async () => {
    const doFetch = lmStudio([{ key: 'cydonia', capabilities: {} }]);
    expect(await resolveReasoningCapability({ ...TARGET, model: 'cydonia' }, doFetch)).toEqual({
      reasons: false, levels: [], budget: null, sources: { reasons: 'native', levels: 'native' },
    });
    // Only the capability GET fired — no POST probe reached the completions URL.
    expect(doFetch.mock.calls.filter(([u]) => u === TARGET.url)).toHaveLength(0);
  });

  it('leaves the budget question unanswered when only the probe spoke', async () => {
    const doFetch = vi.fn(async (u: string) => (
      u === TARGET.url
        ? { ok: true, status: 200, json: async () => ({}), text: async () => '' }
        : { ok: false, status: 404, json: async () => ({}), text: async () => '' }
    ) as unknown as Response);
    expect((await resolveReasoningCapability({ ...TARGET, model: 'plain' }, doFetch))?.budget).toBeNull();
  });
});
