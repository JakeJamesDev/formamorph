import { describe, it, expect } from 'vitest';
import { endpointTipLine, withEndpointLine } from './endpointTip';

describe('endpoint tip line', () => {
  it('names the endpoint and its model, once when they match', () => {
    expect(endpointTipLine('GLM 5.3', 'glm-5.3')).toBe('Sends to GLM 5.3 · glm-5.3');
    expect(endpointTipLine('kimi-3', 'kimi-3')).toBe('Sends to kimi-3');
    expect(endpointTipLine('DeepSeek', '')).toBe('Sends to DeepSeek');
  });

  it('goes under the tip, and leaves the tip alone without one', () => {
    expect(withEndpointLine('Send', 'Sends to Kimi 3')).toBe('Send\nSends to Kimi 3');
    expect(withEndpointLine('Send', '')).toBe('Send');
  });
});
