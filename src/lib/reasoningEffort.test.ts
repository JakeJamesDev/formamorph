import { describe, it, expect } from 'vitest';
import { reasoningEffortBody, reasoningTabs, reasoningPromptTabs, defaultPromptReasoning, resolvePromptReasoning, defaultReasoningBudgetPct, resolveReasoningBudgetPct, reasoningBudgetBody, SAFE_REASONING_EFFORTS } from './reasoningEffort';

describe('reasoningEffortBody', () => {
  it('sends the hint verbatim under Native mode for every non-auto level', () => {
    expect(reasoningEffortBody('off', 'none')).toEqual({ reasoning_effort: 'none' });
    expect(reasoningEffortBody('off', 'low')).toEqual({ reasoning_effort: 'low' });
    expect(reasoningEffortBody('off', 'medium')).toEqual({ reasoning_effort: 'medium' });
    expect(reasoningEffortBody('off', 'high')).toEqual({ reasoning_effort: 'high' });
    expect(reasoningEffortBody('off', 'max')).toEqual({ reasoning_effort: 'max' });
  });

  it('omits the field for auto (the endpoint rejects the literal, so its default applies)', () => {
    expect(reasoningEffortBody('off', 'auto')).toEqual({});
    expect('reasoning_effort' in reasoningEffortBody('off', 'auto')).toBe(false);
  });

  it('forces none in guided modes to suppress native reasoning fighting the guided step', () => {
    for (const mode of ['precall', 'inline', 'staged'] as const) {
      expect(reasoningEffortBody(mode, 'high')).toEqual({ reasoning_effort: 'none' });
      expect(reasoningEffortBody(mode, 'auto')).toEqual({ reasoning_effort: 'none' });
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

  it('sends the value when support is unknown (null) — the UI only offered safe levels', () => {
    expect(reasoningEffortBody('off', 'low', null)).toEqual({ reasoning_effort: 'low' });
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
