import { describe, it, expect, vi, afterEach } from 'vitest';
import { reasoningEffortBody, reasoningTabs, reasoningPromptTabs, defaultPromptReasoning, resolvePromptReasoning, defaultReasoningBudgetPct, resolveReasoningBudgetPct, reasoningBudgetBody, isReasoningEngaged, nativeReasoningSuppressed, SAFE_REASONING_EFFORTS, detectReasoningCapability, detectSupportedReasoningEfforts } from './reasoningEffort';
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

describe('reasoningTabs', () => {
  it('always leads with Default, then the supported levels in canonical order', () => {
    const tabs = reasoningTabs(['high', 'none', 'low']); // out of order in
    expect(tabs.map((t) => t.value)).toEqual(['auto', 'none', 'low', 'high']);
    expect(tabs[0].label).toBe('Default');
  });

  it('falls back to the universal safe levels when support is unknown', () => {
    const tabs = reasoningTabs(null);
    expect(tabs.map((t) => t.value)).toEqual(['auto', ...SAFE_REASONING_EFFORTS]);
  });

  it('surfaces backend-specific levels (minimal, xhigh, max) when the endpoint accepts them', () => {
    const cloud = reasoningTabs(['none', 'minimal', 'low', 'medium', 'high']);
    expect(cloud.map((t) => t.value)).toContain('minimal');
    const ollama = reasoningTabs(['none', 'low', 'medium', 'high', 'max']);
    expect(ollama.map((t) => t.label)).toContain('Max');
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

  it('leads the prompt tabs with Global, then the supported levels (no Default)', () => {
    const tabs = reasoningPromptTabs(['none', 'low', 'high']);
    expect(tabs[0]).toEqual({ value: 'global', label: 'Global' });
    expect(tabs.map((t) => t.value)).not.toContain('auto');
    expect(tabs.map((t) => t.value)).toEqual(['global', 'none', 'low', 'high']);
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
  it('ships narration at 40%, the planning and memory passes at 25%, the rest at 0%', () => {
    expect(defaultReasoningBudgetPct('narration')).toBe(40);
    for (const kind of ['thinking', 'director', 'character', 'storyboard', 'summary', 'diary'] as const) {
      expect(defaultReasoningBudgetPct(kind)).toBe(25);
    }
    expect(defaultReasoningBudgetPct('choices')).toBe(0);
    expect(defaultReasoningBudgetPct('statUpdates')).toBe(0);
  });

  it('resolves every kind to its stored/default %, clamped', () => {
    expect(resolveReasoningBudgetPct('narration', {})).toBe(40);
    expect(resolveReasoningBudgetPct('narration', { narration: 20 })).toBe(20);
    expect(resolveReasoningBudgetPct('choices', {})).toBe(0);
    expect(resolveReasoningBudgetPct('choices', { choices: 30 })).toBe(30);
    expect(resolveReasoningBudgetPct('summary', { summary: 90 })).toBe(90);
    expect(resolveReasoningBudgetPct('statUpdates', { statUpdates: -5 })).toBe(0); // clamp low
    expect(resolveReasoningBudgetPct('narration', { narration: 250 })).toBe(100); // clamp high
  });

  it('converts the % to a token cap against max output', () => {
    expect(reasoningBudgetBody('off', 'narration', {}, 500)).toEqual({ thinking_budget_tokens: 200 }); // 40% of 500
    expect(reasoningBudgetBody('off', 'narration', { narration: 20 }, 500)).toEqual({ thinking_budget_tokens: 100 });
    expect(reasoningBudgetBody('off', 'choices', {}, 500)).toEqual({ thinking_budget_tokens: 0 }); // choices off by default
    expect(reasoningBudgetBody('off', 'choices', { choices: 30 }, 400)).toEqual({ thinking_budget_tokens: 120 });
    expect(reasoningBudgetBody('off', 'summary', { summary: 50 }, 500)).toEqual({ thinking_budget_tokens: 250 });
    expect(reasoningBudgetBody('off', 'director', {}, 400)).toEqual({ thinking_budget_tokens: 100 }); // 25% tier
  });

  it('keeps each pass its own budget under the guided modes', () => {
    expect(reasoningBudgetBody('staged', 'narration', {}, 500)).toEqual({ thinking_budget_tokens: 200 });
    expect(reasoningBudgetBody('staged', 'director', {}, 400)).toEqual({ thinking_budget_tokens: 100 });
    expect(reasoningBudgetBody('precall', 'thinking', { thinking: 50 }, 400)).toEqual({ thinking_budget_tokens: 200 });
    expect(reasoningBudgetBody('inline', 'summary', {}, 400)).toEqual({ thinking_budget_tokens: 100 });
  });

  it('forces 0 on Inline narration (local engine ignores reasoning_effort, so this is how it suppresses)', () => {
    expect(reasoningBudgetBody('inline', 'narration', { narration: 40 }, 500)).toEqual({ thinking_budget_tokens: 0 });
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
