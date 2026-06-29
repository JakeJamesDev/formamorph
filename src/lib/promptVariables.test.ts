import { describe, it, expect } from 'vitest';
import {
  baseToken, isSummaryToken, summaryToken, variableForToken, labelForToken, colorForToken,
} from './promptVariables';

describe('summary token helpers', () => {
  it('detects the summary variant', () => {
    expect(isSummaryToken('<LOCATION JSON DATA|summary>')).toBe(true);
    expect(isSummaryToken('<LOCATION JSON DATA>')).toBe(false);
    expect(isSummaryToken('<NOTES>')).toBe(false);
  });

  it('round-trips base ↔ summary', () => {
    expect(summaryToken('<LOCATION JSON DATA>')).toBe('<LOCATION JSON DATA|summary>');
    expect(baseToken('<LOCATION JSON DATA|summary>')).toBe('<LOCATION JSON DATA>');
    expect(baseToken('<LOCATION JSON DATA>')).toBe('<LOCATION JSON DATA>');
  });
});

describe('variable lookup by token (base or variant)', () => {
  it('resolves a summary token to its base variable', () => {
    const v = variableForToken('<LOCATION JSON DATA|summary>');
    expect(v?.label).toBe('Location');
    expect(v?.hasSummary).toBe(true);
  });

  it('shares label/color across base and summary forms', () => {
    expect(labelForToken('<LOCATION JSON DATA|summary>')).toBe('Location');
    expect(colorForToken('<LOCATION JSON DATA|summary>')).toBe(colorForToken('<LOCATION JSON DATA>'));
  });

  it('marks non-summary variables', () => {
    expect(variableForToken('<NOTES>')?.hasSummary).toBe(false);
    expect(variableForToken('<UNKNOWN>')).toBeUndefined();
  });
});
