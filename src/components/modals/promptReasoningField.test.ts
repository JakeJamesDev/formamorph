import { describe, expect, it, vi } from 'vitest';
import { promptReasoningFieldProps, type PromptReasoningFieldInput } from './promptReasoningField';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';

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

  it('builds the budget slider with its tokens from the endpoint Max Output', () => {
    const onBudgetChange = vi.fn();
    const props = promptReasoningFieldProps(input({ reasoning: { dialect: 'lmstudio', budget: true }, maxTokens: 1000, budgetPct: 80, onBudgetChange }));
    expect(props?.budget).toMatchObject({ value: 80, tokens: 800, disabled: false });
    props?.budget?.set(55);
    expect(onBudgetChange).toHaveBeenCalledWith(55);
  });

  it('applies the dialect floor to the budget tokens', () => {
    const props = promptReasoningFieldProps(input({ reasoning: { dialect: 'anthropic-budget', budget: true }, maxTokens: 1000, budgetPct: 50 }));
    expect(props?.budget?.tokens).toBe(1024);
  });

  it('disables the budget slider with no Max Output to scale from', () => {
    const props = promptReasoningFieldProps(input({ reasoning: { dialect: 'lmstudio', budget: true }, maxTokens: undefined }));
    expect(props?.budget).toMatchObject({ disabled: true, tokens: undefined });
  });

  it('still reads the dialect floor with no Max Output to scale from', () => {
    const props = promptReasoningFieldProps(input({ reasoning: { dialect: 'anthropic-budget', budget: true }, maxTokens: undefined }));
    expect(props?.budget).toMatchObject({ disabled: true, tokens: 1024 });
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
