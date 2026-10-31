import { describe, expect, it } from 'vitest';
import { HOSTED_SUPPORT_LABEL, hostedStateCopy } from './hostedCopy';
import type { HostedPresetState } from './refusals';

const STATES: HostedPresetState[] = [
  'ready', 'warned', 'signed-out', 'privacy-required', 'suspended', 'age-gate', 'locked', 'exhausted', 'paused', 'outdated', 'unavailable',
];

/** Support is a donation, so no line sells a plan. */
const SALES_WORDS = /\b(upgrade|plan|purchase|subscri\w*|buy)\b/i;

describe('hosted preset copy reads as a donation', () => {
  it.each(STATES)('%s names no plan, purchase or upgrade', (state) => {
    const copy = hostedStateCopy(state, '2026-12-01T00:00:00.000Z');
    const lines = copy ? [copy.reason, copy.action?.label, copy.extra?.label] : [];

    for (const line of lines) expect(line ?? '').not.toMatch(SALES_WORDS);
  });

  it('offers Support on Patreon when the account has no support and when the allowance is spent', () => {
    expect(hostedStateCopy('locked')?.action?.label).toBe(HOSTED_SUPPORT_LABEL);
    expect(hostedStateCopy('exhausted')?.extra?.label).toBe(HOSTED_SUPPORT_LABEL);
  });
});
