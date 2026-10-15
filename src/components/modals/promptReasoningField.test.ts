import { describe, expect, it, vi } from 'vitest';
import { promptReasoningFieldProps, type PromptReasoningFieldInput } from './promptReasoningField';
import { UNKNOWN_REASONING_CAPABILITY, type PromptReasoningSetting, type ReasoningCapability } from '@/lib/reasoningEffort';

const capability = (over: Partial<ReasoningCapability>): ReasoningCapability => ({ ...UNKNOWN_REASONING_CAPABILITY, ...over });

const input = (over: Partial<PromptReasoningFieldInput> & { reasoning?: Partial<ReasoningCapability>; localEngine?: boolean; maxTokens?: number }): PromptReasoningFieldInput => {
  const { reasoning, localEngine = false, ...rest } = over;
  const maxTokens = 'maxTokens' in over ? over.maxTokens : 1000;
  return {
    target: { reasoning: capability(reasoning ?? {}), localEngine, maxTokens },
    kind: 'narration',
    setting: { enabled: true, level: 'global' },
    budgetPct: 80,
    suppressed: false,
    onChange: vi.fn(),
    onBudgetChange: vi.fn(),
    ...rest,
  };
};

describe('promptReasoningFieldProps', () => {
  it('draws no field where the model does not reason', () => {
    expect(promptReasoningFieldProps(input({ reasoning: { reasons: false } }))).toBeNull();
    expect(promptReasoningFieldProps(input({ reasoning: { levels: [] } }))).toBeNull();
  });

  it('draws no field while the dialect awaits proof', () => {
    expect(promptReasoningFieldProps(input({ reasoning: { dialect: 'vllm' } }))).toBeNull();
    expect(promptReasoningFieldProps(input({ reasoning: { dialect: 'vllm', budget: true } }))).not.toBeNull();
  });

  it('draws the field while the dialect awaits proof when the caller asks, and still none where the model does not reason', () => {
    expect(promptReasoningFieldProps(input({ reasoning: { dialect: 'vllm' }, showAwaitingProof: true }))).not.toBeNull();
    expect(promptReasoningFieldProps(input({ reasoning: { reasons: false }, showAwaitingProof: true }))).toBeNull();
  });

  it('draws no field on a suppressed call', () => {
    expect(promptReasoningFieldProps(input({ suppressed: true }))).toBeNull();
  });

  it('keeps the field on the local engine even where the record rules reasoning out', () => {
    const props = promptReasoningFieldProps(input({ localEngine: true, reasoning: { reasons: false, dialect: 'engine', budget: true } }));
    expect(props).not.toBeNull();
    expect(props?.level).toBe(false);
  });

  it('offers Global plus the listed levels where the dialect takes a level', () => {
    const props = promptReasoningFieldProps(input({ reasoning: { dialect: 'openai', levels: ['low', 'high'] }, setting: { enabled: true, level: 'high' } }));
    expect(props?.level).toBe(true);
    expect(props?.options.map((o) => o.value)).toEqual(['global', 'auto', 'low', 'high']);
    expect(props?.budget).toBeNull();
  });

  // The strength sizes a llama.cpp budget, so a slider there would move nothing.
  it('draws no budget slider for a llama.cpp target, which still takes a budget', () => {
    for (const levels of [['none'], ['none', 'low', 'medium', 'high']] as const) {
      const props = promptReasoningFieldProps(input({ reasoning: { dialect: 'llamacpp', budget: true, levels: [...levels] } }));
      expect(props).not.toBeNull();
      expect(props?.budget).toBeNull();
    }
  });

  it('builds the budget slider with its tokens from the endpoint Max Output', () => {
    const onBudgetChange = vi.fn();
    const props = promptReasoningFieldProps(input({ reasoning: { dialect: 'lmstudio', budget: true }, maxTokens: 1000, budgetPct: 80, onBudgetChange }));
    expect(props?.budget).toMatchObject({ value: 80, tokens: 800 });
    props?.budget?.set(55);
    expect(onBudgetChange).toHaveBeenCalledWith(55);
  });

  it('applies the dialect floor to the budget tokens', () => {
    const props = promptReasoningFieldProps(input({ reasoning: { dialect: 'anthropic-budget', budget: true }, maxTokens: 1000, budgetPct: 50 }));
    expect(props?.budget?.tokens).toBe(1024);
  });

  it('draws no slider and reads the room with no Max Output to scale from', () => {
    const props = promptReasoningFieldProps(input({
      reasoning: { dialect: 'lmstudio', budget: true }, maxTokens: undefined, setting: { enabled: true, level: 'low' },
    }));
    expect(props?.budget).toBeNull();
    expect(props?.room).toEqual({ strength: 'Low', tokens: 1024 });
  });

  it('raises the room to the dialect floor where the room is the budget', () => {
    const props = promptReasoningFieldProps(input({
      reasoning: { dialect: 'anthropic-budget', budget: true }, maxTokens: undefined, setting: { enabled: true, level: 'minimal' },
    }));
    expect(props?.room).toEqual({ strength: 'Minimal', tokens: 1024 });
  });

  it('reads the room of a budget-only target with no Max Output', () => {
    const props = promptReasoningFieldProps(input({
      localEngine: true, reasoning: { dialect: 'engine', budget: true, reasons: false }, maxTokens: undefined, setting: { enabled: true, level: 'high' },
    }));
    expect(props).toMatchObject({ level: false, budget: null, room: { strength: 'High', tokens: 4096 } });
  });

  it('reads no room beside a budget slider that has a Max Output to scale from', () => {
    const props = promptReasoningFieldProps(input({ reasoning: { dialect: 'lmstudio', budget: true }, maxTokens: 1000 }));
    expect(props?.room).toBeNull();
  });

  it('reads the room of the strength beside a level dropdown with no budget', () => {
    const rooms = (level: PromptReasoningSetting['level']) =>
      promptReasoningFieldProps(input({ reasoning: { dialect: 'openai', levels: ['low', 'high', 'max'] }, setting: { enabled: true, level } }))?.room;
    expect(rooms('low')).toEqual({ strength: 'Low', tokens: 1024 });
    expect(rooms('max')).toEqual({ strength: 'Max', tokens: 16384 });
    expect(rooms('auto')).toEqual({ strength: 'Model Default', tokens: 2048 });
  });

  it('follows the endpoint-wide strength for a prompt set to Global', () => {
    const props = promptReasoningFieldProps(input({
      reasoning: { dialect: 'openai', levels: ['low', 'high'] }, setting: { enabled: true, level: 'global' }, globalLevel: 'high',
    }));
    expect(props?.room).toEqual({ strength: 'High', tokens: 4096 });
  });

  it('reads the room of a llama.cpp target, which has no slider', () => {
    const props = promptReasoningFieldProps(input({
      reasoning: { dialect: 'llamacpp', budget: true, levels: ['none', 'low'] }, setting: { enabled: true, level: 'low' },
    }));
    expect(props?.room).toEqual({ strength: 'Low', tokens: 1024 });
  });

  it('reads no room where the target has no level and no budget to show it beside', () => {
    expect(promptReasoningFieldProps(input({ reasoning: { dialect: 'novita' } }))?.room).toBeNull();
  });

  it('draws no slider where the record says the endpoint takes no budget', () => {
    expect(promptReasoningFieldProps(input({ reasoning: { dialect: 'lmstudio', budget: false } }))?.budget).toBeNull();
  });

  it('locks the switch on where the endpoint refuses off', () => {
    expect(promptReasoningFieldProps(input({ reasoning: { offAllowed: false } }))?.lockedOn).toBe(true);
    expect(promptReasoningFieldProps(input({ reasoning: { dialect: 'google-3' } }))?.lockedOn).toBe(true);
    expect(promptReasoningFieldProps(input({ reasoning: { offAllowed: true } }))?.lockedOn).toBe(false);
  });

  it('passes the setting through and routes changes to the caller', () => {
    const onChange = vi.fn();
    const props = promptReasoningFieldProps(input({ setting: { enabled: false, level: 'low' }, onChange }));
    expect(props?.setting).toEqual({ enabled: false, level: 'low' });
    props?.onChange({ enabled: true, level: 'low' });
    expect(onChange).toHaveBeenCalledWith({ enabled: true, level: 'low' });
  });
});
