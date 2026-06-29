import { describe, it, expect } from 'vitest';
import {
  baseToken, isSummaryToken, summaryToken,
  variableForToken, labelForToken, colorForToken,
} from './promptVariables';

describe('summary token helpers', () => {
  it('detects the summary variant', () => {
    expect(isSummaryToken('<LOCATION|summary>')).toBe(true);
    expect(isSummaryToken('<LOCATION>')).toBe(false);
    expect(isSummaryToken('<NOTES>')).toBe(false);
  });

  it('round-trips base ↔ summary', () => {
    expect(summaryToken('<LOCATION>')).toBe('<LOCATION|summary>');
    expect(baseToken('<LOCATION|summary>')).toBe('<LOCATION>');
    expect(baseToken('<LOCATION>')).toBe('<LOCATION>');
  });
});

describe('variable lookup by token (base or variant)', () => {
  it('resolves a summary token to its base variable', () => {
    const v = variableForToken('<LOCATION|summary>');
    expect(v?.label).toBe('Location');
    expect(v?.hasSummary).toBe(true);
  });

  it('shares label/color across base and summary forms', () => {
    expect(labelForToken('<LOCATION|summary>')).toBe('Location');
    expect(colorForToken('<LOCATION|summary>')).toBe(colorForToken('<LOCATION>'));
  });

  it('marks non-summary variables', () => {
    expect(variableForToken('<NOTES>')?.hasSummary).toBe(false);
    expect(variableForToken('<UNKNOWN>')).toBeUndefined();
  });
});
