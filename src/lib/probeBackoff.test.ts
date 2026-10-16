import { describe, expect, it } from 'vitest';
import { ProbeBackoff, PROBE_RETRY_MAX_MS, PROBE_RETRY_MIN_MS } from './probeBackoff';

describe('ProbeBackoff', () => {
  it('holds a key while its probe is in flight', () => {
    const gate = new ProbeBackoff();
    expect(gate.begin('a', 0)).toBe(true);
    expect(gate.begin('a', 0)).toBe(false);
    expect(gate.begin('b', 0)).toBe(true);
  });

  it('waits out a doubling backoff after each failure, capped at the max', () => {
    const gate = new ProbeBackoff();
    let now = 0;
    let expected = PROBE_RETRY_MIN_MS;
    for (let i = 0; i < 6; i++) {
      gate.begin('a', now);
      gate.end('a', false, now);
      expect(gate.begin('a', now + expected - 1)).toBe(false);
      now += expected;
      expected = Math.min(expected * 2, PROBE_RETRY_MAX_MS);
    }
    expect(gate.begin('a', now)).toBe(true);
  });

  it('forgets a key after a success', () => {
    const gate = new ProbeBackoff();
    gate.begin('a', 0);
    gate.end('a', false, 0);
    gate.begin('a', PROBE_RETRY_MIN_MS);
    gate.end('a', true, PROBE_RETRY_MIN_MS);
    expect(gate.begin('a', PROBE_RETRY_MIN_MS)).toBe(true);
  });
});
