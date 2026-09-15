import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReasoningChip } from './ReasoningChip';
import { reasoningChipText } from './reasoningChipText';
import type { DebugEndpointInfo } from '@/lib/promptEndpoints';

/**
 * What the AI Context viewer says a request carried. The chip reads in the settings' words and its tip names
 * the wire fields, so these assert the two faces of the same captured request.
 */

const endpoint = (over: Partial<DebugEndpointInfo> = {}): DebugEndpointInfo => ({
  preset: 'LM Studio', routed: false, model: 'meromero-31b', url: 'http://127.0.0.1:1234/v1', ...over,
});

describe('reasoningChipText', () => {
  it('names the cap beside the hint when the request carried both', () => {
    const chip = reasoningChipText(endpoint({ reasoningEffort: 'high', budgetTokens: 400 }));
    expect(chip?.label).toBe('Effort high · Budget 400');
    expect(chip?.tip).toBe('reasoning_effort: high · thinking_budget_tokens: 400');
  });

  it('names a zero cap, which is how a switched-off prompt reads', () => {
    expect(reasoningChipText(endpoint({ reasoningEffort: 'none', budgetTokens: 0 }))?.label)
      .toBe('Effort none · Budget 0');
  });

  it('names the hint alone on an endpoint that takes no budget', () => {
    expect(reasoningChipText(endpoint({ reasoningEffort: 'low' }))?.label).toBe('Effort low');
  });

  it('names the cap alone on the built-in engine, which takes no hint', () => {
    expect(reasoningChipText(endpoint({ budgetTokens: 250 }))?.label).toBe('Budget 250');
  });

  it('says nothing when the request carried neither field', () => {
    expect(reasoningChipText(endpoint())).toBeNull();
  });
});

describe('ReasoningChip', () => {
  it('draws both fields for a request that carried them', () => {
    render(<ReasoningChip endpoint={endpoint({ reasoningEffort: 'high', budgetTokens: 205 })} />);
    expect(screen.getByText('Effort high · Budget 205')).toBeTruthy();
  });

  it('draws a switched-off prompt as a zero cap rather than hiding it', () => {
    render(<ReasoningChip endpoint={endpoint({ reasoningEffort: 'none', budgetTokens: 0 })} />);
    expect(screen.getByText('Effort none · Budget 0')).toBeTruthy();
  });

  it('draws nothing at all for a request that carried neither field', () => {
    const { container } = render(<ReasoningChip endpoint={endpoint()} />);
    expect(container.textContent).toBe('');
  });
});
