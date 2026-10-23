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

  it('draws the budget slider for a llama.cpp target with Max Output, whatever its template reads', () => {
    for (const levels of [['none'], ['none', 'low', 'medium', 'high']] as const) {
      const props = promptReasoningFieldProps(input({ reasoning: { dialect: 'llamacpp', budget: true, levels: [...levels] }, maxTokens: 4096, budgetPct: 75 }));
      expect(props?.budget).toMatchObject({ value: 75, tokens: 3072 });
      expect(props?.room).toBeNull();
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
    expect(props?.room).toEqual({ tokens: 1024, strength: 'low' });
  });

  it('raises the room to the dialect floor where the room is the budget', () => {
    const props = promptReasoningFieldProps(input({
      reasoning: { dialect: 'anthropic-budget', budget: true }, maxTokens: undefined, setting: { enabled: true, level: 'minimal' },
    }));
    expect(props?.room).toEqual({ tokens: 1024, strength: 'minimal' });
  });

  it('reads the room of a budget-only target with no Max Output', () => {
    const props = promptReasoningFieldProps(input({
      localEngine: true, reasoning: { dialect: 'engine', budget: true, reasons: false }, maxTokens: undefined, setting: { enabled: true, level: 'high' },
    }));
    expect(props).toMatchObject({ level: false, budget: null, room: { tokens: 4096, strength: 'high' } });
  });

  it('reads no room beside a budget slider that has a Max Output to scale from', () => {
    const props = promptReasoningFieldProps(input({ reasoning: { dialect: 'lmstudio', budget: true }, maxTokens: 1000 }));
    expect(props?.room).toBeNull();
  });

  it('reads the room of the strength beside a level dropdown with no budget', () => {
    const rooms = (level: PromptReasoningSetting['level']) =>
      promptReasoningFieldProps(input({ reasoning: { dialect: 'openai', levels: ['low', 'high', 'max'] }, setting: { enabled: true, level } }))?.room;
    expect(rooms('low')).toEqual({ tokens: 1024, strength: 'low' });
    expect(rooms('max')).toEqual({ tokens: 16384, strength: 'max' });
    expect(rooms('auto')).toEqual({ tokens: 2048, strength: 'auto' });
  });

  it('follows the endpoint-wide strength for a prompt set to Global', () => {
    const props = promptReasoningFieldProps(input({
      reasoning: { dialect: 'openai', levels: ['low', 'high'] }, setting: { enabled: true, level: 'global' }, global: { enabled: true, level: 'high' },
    }));
    expect(props?.room).toEqual({ tokens: 4096, strength: 'high' });
  });

  it('reads no room for a prompt set to Global while the endpoint-wide switch is off, which sends none', () => {
    const props = promptReasoningFieldProps(input({
      reasoning: { dialect: 'openai', levels: ['low', 'high'] }, setting: { enabled: true, level: 'global' }, global: { enabled: false, level: 'high' },
    }));
    expect(props?.room).toBeNull();
  });

  it('marks the field inert under the endpoint-wide master off, its own setting untouched', () => {
    const setting: PromptReasoningSetting = { enabled: true, level: 'high' };
    const props = (global: { enabled: boolean; level: 'auto' }, reasoning: Partial<ReasoningCapability> = { dialect: 'openai', levels: ['low', 'high'] }) =>
      promptReasoningFieldProps(input({ kind: 'director', reasoning, setting, global }));
    expect(props({ enabled: false, level: 'auto' })?.globalOff).toBe(true);
    expect(props({ enabled: false, level: 'auto' })?.setting).toEqual(setting);
    expect(props({ enabled: true, level: 'auto' })?.globalOff).toBe(false);
    // An endpoint that refuses off keeps the prompt's own control: its strength still goes out.
    expect(props({ enabled: false, level: 'auto' }, { dialect: 'moonshot-k3', levels: ['low', 'high'], offAllowed: false })?.globalOff).toBe(false);
  });

  it('reads the kept strength for a prompt set to Global on an endpoint that refuses off', () => {
    const props = promptReasoningFieldProps(input({
      reasoning: { dialect: 'moonshot-k3', levels: ['low', 'high'], offAllowed: false },
      setting: { enabled: true, level: 'global' }, global: { enabled: false, level: 'high' },
    }));
    expect(props?.room).toEqual({ tokens: 4096, strength: 'high' });
  });

  it('reads the room of a llama.cpp target with Max Output off, in place of the slider', () => {
    const props = promptReasoningFieldProps(input({
      reasoning: { dialect: 'llamacpp', budget: true, levels: ['none', 'low'] }, setting: { enabled: true, level: 'low' }, maxTokens: undefined,
    }));
    expect(props?.room).toEqual({ tokens: 1024, strength: 'low' });
    expect(props?.budget).toBeNull();
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
