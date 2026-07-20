import { describe, it, expect, vi, afterEach } from 'vitest';
import { reasoningEffortBody, reasoningTabs, reasoningPromptTabs, defaultPromptReasoning, resolvePromptReasoning, defaultReasoningBudgetPct, resolveReasoningBudgetPct, reasoningBudgetBody, isReasoningEngaged, SAFE_REASONING_EFFORTS, detectReasoningCapability, detectSupportedReasoningEfforts } from './reasoningEffort';

describe('reasoningEffortBody', () => {
  const all = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

  it('sends the hint verbatim under Native mode for every non-auto level the endpoint accepts', () => {
    expect(reasoningEffortBody('off', 'none', all)).toEqual({ reasoning_effort: 'none' });
    expect(reasoningEffortBody('off', 'low', all)).toEqual({ reasoning_effort: 'low' });
    expect(reasoningEffortBody('off', 'medium', all)).toEqual({ reasoning_effort: 'medium' });
    expect(reasoningEffortBody('off', 'high', all)).toEqual({ reasoning_effort: 'high' });
    expect(reasoningEffortBody('off', 'max', all)).toEqual({ reasoning_effort: 'max' });
  });

  it('omits the field for auto (send nothing → endpoint default)', () => {
    expect(reasoningEffortBody('off', 'auto', all)).toEqual({});
    expect('reasoning_effort' in reasoningEffortBody('off', 'auto', all)).toBe(false);
  });

  it('forces none in guided modes to suppress native reasoning fighting the guided step', () => {
    for (const mode of ['precall', 'inline', 'staged'] as const) {
      expect(reasoningEffortBody(mode, 'high', all)).toEqual({ reasoning_effort: 'none' });
      expect(reasoningEffortBody(mode, 'auto', all)).toEqual({ reasoning_effort: 'none' });
    }
  });

  it('omits none on a guided-mode request when the endpoint does not accept it (no 400)', () => {
    expect(reasoningEffortBody('inline', 'high', [])).toEqual({});
    expect(reasoningEffortBody('staged', 'low', ['low', 'medium', 'high'])).toEqual({});
  });

  it('omits a value the active endpoint does not accept (a stale selection cannot 400 a turn)', () => {
    // Ollama-like: accepts max, not minimal.
    const ollama = ['none', 'low', 'medium', 'high', 'max'] as const;
    expect(reasoningEffortBody('off', 'minimal', ollama)).toEqual({});
    expect(reasoningEffortBody('off', 'max', ollama)).toEqual({ reasoning_effort: 'max' });
  });

  it('sends nothing until support is confirmed — unknown (null/undefined) omits the field', () => {
    expect(reasoningEffortBody('off', 'low', null)).toEqual({});
    expect(reasoningEffortBody('off', 'low')).toEqual({});
    expect(reasoningEffortBody('inline', 'high', null)).toEqual({});
  });

  it('sends nothing to a conclusively non-reasoning endpoint (empty support), even none', () => {
    expect(reasoningEffortBody('off', 'none', [])).toEqual({});
    expect(reasoningEffortBody('inline', 'high', [])).toEqual({});
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
  it('ships narration as Global and everything else as None', () => {
    expect(defaultPromptReasoning('narration')).toBe('global');
    expect(defaultPromptReasoning('choices')).toBe('none');
    expect(defaultPromptReasoning('summary')).toBe('none');
  });

  it('leads the prompt tabs with Global, then the supported levels (no Default)', () => {
    const tabs = reasoningPromptTabs(['none', 'low', 'high']);
    expect(tabs[0]).toEqual({ value: 'global', label: 'Global' });
    expect(tabs.map((t) => t.value)).not.toContain('auto');
    expect(tabs.map((t) => t.value)).toEqual(['global', 'none', 'low', 'high']);
  });

  it('resolves Global to the endpoint-wide effort, explicit choices to themselves', () => {
    expect(resolvePromptReasoning('narration', {}, 'high')).toBe('high'); // default global → follows global
    expect(resolvePromptReasoning('narration', { narration: 'low' }, 'high')).toBe('low'); // override wins
    expect(resolvePromptReasoning('choices', {}, 'high')).toBe('none'); // default none, ignores global
    expect(resolvePromptReasoning('choices', { choices: 'global' }, 'medium')).toBe('medium');
  });

  it('forces uncontrolled prompts to none regardless of stored prefs or global', () => {
    expect(resolvePromptReasoning('summary', { summary: 'high' }, 'high')).toBe('none');
    expect(resolvePromptReasoning('statUpdates', {}, 'high')).toBe('none');
  });
});

describe('reasoning budget (local engine)', () => {
  it('ships narration at 40% and everything else at 0%', () => {
    expect(defaultReasoningBudgetPct('narration')).toBe(40);
    expect(defaultReasoningBudgetPct('choices')).toBe(0);
    expect(defaultReasoningBudgetPct('summary')).toBe(0);
  });

  it('resolves a controlled prompt to its stored/default %, others to 0, clamped', () => {
    expect(resolveReasoningBudgetPct('narration', {})).toBe(40);
    expect(resolveReasoningBudgetPct('narration', { narration: 20 })).toBe(20);
    expect(resolveReasoningBudgetPct('choices', {})).toBe(0);
    expect(resolveReasoningBudgetPct('choices', { choices: 30 })).toBe(30);
    expect(resolveReasoningBudgetPct('summary', { summary: 90 })).toBe(0); // uncontrolled → 0
    expect(resolveReasoningBudgetPct('narration', { narration: 250 })).toBe(100); // clamp
  });

  it('converts the % to a token cap against max output under Native mode', () => {
    expect(reasoningBudgetBody('off', 'narration', {}, 500)).toEqual({ thinking_budget_tokens: 200 }); // 40% of 500
    expect(reasoningBudgetBody('off', 'narration', { narration: 20 }, 500)).toEqual({ thinking_budget_tokens: 100 });
    expect(reasoningBudgetBody('off', 'choices', {}, 500)).toEqual({ thinking_budget_tokens: 0 }); // choices off by default
    expect(reasoningBudgetBody('off', 'choices', { choices: 30 }, 400)).toEqual({ thinking_budget_tokens: 120 });
    expect(reasoningBudgetBody('off', 'summary', { summary: 50 }, 500)).toEqual({ thinking_budget_tokens: 0 }); // uncontrolled
  });

  it('forces 0 in guided modes (local engine ignores reasoning_effort, so this is how they suppress)', () => {
    expect(reasoningBudgetBody('inline', 'narration', { narration: 40 }, 500)).toEqual({ thinking_budget_tokens: 0 });
    expect(reasoningBudgetBody('staged', 'narration', {}, 500)).toEqual({ thinking_budget_tokens: 0 });
  });
});

describe('isReasoningEngaged', () => {
  it('is false for the default off/auto setup with default per-prompt reasoning', () => {
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
