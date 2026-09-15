import { describe, it, expect, vi, afterEach } from 'vitest';
import { reasoningEffortBody, reasoningLevelOptions, promptReasoningLevelOptions, defaultPromptReasoning, defaultPromptReasoningSetting, resolvePromptReasoning, resolveReasoningSetting, resolvePromptReasoningSetting, parseReasoningSetting, parsePromptReasoningSetting, defaultReasoningBudgetPct, resolveReasoningBudgetPct, reasoningBudgetBody, isReasoningEngaged, nativeReasoningSuppressed, MIN_REASONING_BUDGET_PCT, detectReasoningCapability, detectSupportedReasoningEfforts } from './reasoningEffort';
import type { AIRequestType } from '@/types';

const ALL_KINDS: AIRequestType[] = [
  'thinking', 'director', 'character', 'storyboard', 'narration', 'choices', 'statUpdates', 'locationChange',
  'summary', 'milestoneSelect', 'diary', 'discoverEntity', 'timePassed', 'openingTime', 'sceneTags',
];

describe('reasoningEffortBody', () => {
  const all = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

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
    const ollama = ['none', 'low', 'medium', 'high', 'max'] as const;
    expect(reasoningEffortBody('minimal', ollama)).toEqual({});
    expect(reasoningEffortBody('max', ollama)).toEqual({ reasoning_effort: 'max' });
    expect(reasoningEffortBody('none', ['low', 'medium', 'high'])).toEqual({});
  });

  it('sends nothing until support is confirmed — unknown (null/undefined) omits the field', () => {
    expect(reasoningEffortBody('low', null)).toEqual({});
    expect(reasoningEffortBody('low')).toEqual({});
  });

  it('sends nothing to a conclusively non-reasoning endpoint (empty support), even none', () => {
    expect(reasoningEffortBody('none', [])).toEqual({});
    expect(reasoningEffortBody('high', [])).toEqual({});
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
    const opts = promptReasoningLevelOptions(['high', 'none', 'low']); // out of order in
    expect(opts.map((o) => o.value)).toEqual(['global', 'auto', 'low', 'high']);
    expect(opts.map((o) => o.label)).toEqual(['Global', 'Model Default', 'Low', 'High']);
    expect(promptReasoningLevelOptions(null).map((o) => o.value)).toEqual(['global', 'auto', 'low', 'medium', 'high']); // safe fallback
  });

  it('lists the endpoint-wide strengths with full-word labels for backend-specific levels', () => {
    const cloud = reasoningLevelOptions(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
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

describe('detectReasoningCapability (LM Studio native /api/v1/models)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubFetch = (impl: (url: string) => { ok: boolean; json?: () => Promise<unknown> }) =>
    vi.stubGlobal('fetch', vi.fn(async (u: string) => impl(u) as unknown as Response));

  const list = (models: unknown[]) => ({ ok: true, json: async () => ({ models }) });

  it('returns false when the model is listed without a reasoning capability', async () => {
    stubFetch(() => list([{ key: 'cydonia-24b', capabilities: { vision: false, trained_for_tool_use: false } }]));
    expect(await detectReasoningCapability('http://localhost:1234/v1/chat/completions', '', 'cydonia-24b')).toBe(false);
  });

  it('returns true when the model exposes a reasoning capability object', async () => {
    stubFetch(() => list([{ key: 'g4-meromero-31b', capabilities: { reasoning: { allowed_options: ['off', 'on'], default: 'on' } } }]));
    expect(await detectReasoningCapability('http://localhost:1234/v1/chat/completions', '', 'g4-meromero-31b')).toBe(true);
  });

  it('hits the origin-derived native path, not the configured completions URL', async () => {
    const fetchMock = vi.fn(async () => list([{ key: 'm', capabilities: {} }]) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    await detectReasoningCapability('http://localhost:1234/v1/chat/completions', '', 'm');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:1234/api/v1/models', expect.anything());
  });

  it('falls back to the loaded model when the configured name is unmatched (e.g. "default")', async () => {
    stubFetch(() => list([
      { key: 'cydonia-24b@q4_k_m', loaded_instances: [{ id: 'cydonia-24b@q4_k_m' }], capabilities: { vision: false } },
      { key: 'g4-meromero-31b', loaded_instances: [], capabilities: { reasoning: { allowed_options: ['off', 'on'], default: 'on' } } },
    ]));
    // "default" matches no key → resolves to the loaded (Cydonia) entry, which has no reasoning capability.
    expect(await detectReasoningCapability('http://127.0.0.1:1234/v1/chat/completions', '', 'default')).toBe(false);
  });

  it('is inconclusive (null) when the model is absent, the shape is foreign, or the endpoint errors', async () => {
    stubFetch(() => list([{ key: 'other', capabilities: {} }]));
    expect(await detectReasoningCapability('http://x/v1/chat/completions', '', 'missing')).toBeNull();
    stubFetch(() => ({ ok: true, json: async () => ({ data: [] }) })); // OpenAI shape, not native
    expect(await detectReasoningCapability('http://x/v1/chat/completions', '', 'm')).toBeNull();
    stubFetch(() => ({ ok: false })); // 404 on non-LM-Studio backends
    expect(await detectReasoningCapability('http://x/v1/chat/completions', '', 'm')).toBeNull();
    expect(await detectReasoningCapability('not a url', '', 'm')).toBeNull();
  });

  it('short-circuits detectSupportedReasoningEfforts to [] without sending any effort probe', async () => {
    const fetchMock = vi.fn(async (u: string) =>
      (u.includes('/api/v1/models')
        ? list([{ key: 'cydonia', capabilities: {} }])
        : { ok: true, status: 200, text: async () => '' }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);
    expect(await detectSupportedReasoningEfforts('http://localhost:1234/v1/chat/completions', '', 'cydonia')).toEqual([]);
    // Only the capability GET fired — no POST probe reached the completions URL.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:1234/api/v1/models', expect.anything());
  });
});
