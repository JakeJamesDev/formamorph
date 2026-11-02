import { describe, it, expect } from 'vitest';
import type { AiRequestStats } from '@/lib/aiContext/requestStats';
import type { DebugEndpointInfo } from '@/lib/promptEndpoints';
import type { ReasoningWireField } from '@/lib/reasoningDialect';
import { reasoningText, samplersText, secondsText, speedText } from './requestLineText';

const endpoint = (fields: Partial<DebugEndpointInfo>): DebugEndpointInfo => ({
  preset: 'LM Studio', routed: false, model: 'meromero-31b', url: 'http://127.0.0.1:1234/v1', reasoningFields: [], samplers: [], ...fields,
});

const effort = (value: string): ReasoningWireField => ({ label: 'Effort', name: 'reasoning_effort', value });
const budget = (value: number): ReasoningWireField => ({ label: 'Budget', name: 'thinking_budget_tokens', value });

describe('reasoningText', () => {
  it('shows both values, and names the wire fields in the tip', () => {
    const text = reasoningText(endpoint({ reasoningFields: [effort('high'), budget(4096)] }));
    expect(text?.value).toBe('High · 4,096');
    expect(text?.tip).toBe('reasoning_effort: high · thinking_budget_tokens: 4096');
  });

  it('shows a zero cap, which is how a switched-off prompt reads', () => {
    expect(reasoningText(endpoint({ reasoningFields: [effort('none'), budget(0)] }))?.value).toBe('None · 0');
  });

  it('reads a boolean switch as on or off, and keeps the wire value in the tip', () => {
    const text = reasoningText(endpoint({ reasoningFields: [{ label: 'Reasoning', name: 'enable_thinking', value: false }] }));
    expect(text?.value).toBe('Off');
    expect(text?.tip).toBe('enable_thinking: false');
  });

  it('says nothing when the request carried no field', () => {
    expect(reasoningText(endpoint({}))).toBeNull();
  });
});

describe('samplersText', () => {
  it('shows the first sampler and tips all of them', () => {
    const text = samplersText(endpoint({ samplers: [{ name: 'temperature', value: 0.8 }, { name: 'top_p', value: 0.95 }] }));
    expect(text).toEqual({ value: '0.8', tip: 'temperature: 0.8 · top_p: 0.95' });
  });

  it('says nothing when the request carried none', () => {
    expect(samplersText(endpoint({}))).toBeNull();
  });
});

describe('speedText', () => {
  const stats: AiRequestStats = { totalMs: 6000, firstTokenMs: 1000, generatingMs: 5000, tokens: 200, tokensEstimated: true, finishReason: 'stop' };

  it('marks a counted speed as approximate', () => {
    expect(speedText(stats)?.value).toBe('~40 t/s');
    expect(speedText(stats)?.tip).toContain('counted');
  });

  it('shows a reported speed plainly', () => {
    expect(speedText({ ...stats, tokensEstimated: false })?.value).toBe('40 t/s');
    expect(speedText({ ...stats, tokensEstimated: false })?.tip).toContain('reported');
  });

  it('keeps one decimal on a slow model', () => {
    expect(speedText({ ...stats, tokens: 12 })?.value).toBe('~2.4 t/s');
  });

  it('shows no speed for a reply that arrived in one burst', () => {
    expect(speedText({ ...stats, generatingMs: 99 })).toBeNull();
  });

  it('shows no speed for a reply with no tokens', () => {
    expect(speedText({ ...stats, tokens: 0 })).toBeNull();
  });
});

describe('secondsText', () => {
  it('rounds to a tenth of a second', () => {
    expect(secondsText(6249)).toBe('6.2s');
  });
});
