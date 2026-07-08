import { describe, it, expect } from 'vitest';
import { REVEAL_TEST_PROFILES, REVEAL_TEST_NARRATION, DEFAULT_REVEAL_TEST_PROFILE } from './revealTestScripts';

const LEN = REVEAL_TEST_NARRATION.length;

describe('reveal test scripts', () => {
  it('every profile produces a monotonic schedule that ends at the full length', () => {
    for (const [name, profile] of Object.entries(REVEAL_TEST_PROFILES)) {
      const events = profile.schedule(LEN);
      expect(events.length, name).toBeGreaterThan(0);
      let prevMs = -1;
      let prevChars = 0;
      for (const e of events) {
        expect(e.atMs, `${name} time monotonic`).toBeGreaterThanOrEqual(prevMs);
        expect(e.chars, `${name} chars monotonic`).toBeGreaterThan(prevChars - 1); // non-decreasing
        prevMs = e.atMs;
        prevChars = e.chars;
      }
      expect(events[events.length - 1].chars, `${name} reaches full length`).toBe(LEN);
    }
  });

  it('the default profile is a real profile', () => {
    expect(REVEAL_TEST_PROFILES[DEFAULT_REVEAL_TEST_PROFILE]).toBeDefined();
  });

  it('burst delivers a large flush at t=0 (as many stepped pushes), then streams the rest', () => {
    const events = REVEAL_TEST_PROFILES.burst.schedule(LEN);
    // The flush is many events all timestamped 0 (per-sentence granularity, like production), covering
    // ≥200 chars before any time passes — that's what poisons a cumulative rate estimate.
    const flushed = events.filter((e) => e.atMs === 0);
    expect(flushed.length).toBeGreaterThan(1);
    expect(flushed[flushed.length - 1].chars).toBeGreaterThanOrEqual(200);
    // Then a genuine time-spread stream carries the rest.
    expect(events.some((e) => e.atMs > 0)).toBe(true);
  });

  it('steady arrives gradually — no instant flush, first chunk is one small step', () => {
    const events = REVEAL_TEST_PROFILES.steady.schedule(LEN);
    expect(events[0].chars).toBeLessThanOrEqual(8); // a small first step, not a big flush
    expect(events[0].atMs).toBeGreaterThan(0); // and it takes time to arrive (unlike burst's t=0 flush)
  });

  it('slow takes materially longer than fast for the same text', () => {
    const slowEnd = REVEAL_TEST_PROFILES.slow.schedule(LEN).at(-1)!.atMs;
    const fastEnd = REVEAL_TEST_PROFILES.fast.schedule(LEN).at(-1)!.atMs;
    expect(slowEnd).toBeGreaterThan(fastEnd * 3);
  });

  it('erratic advances in instant chunks separated by gaps', () => {
    const events = REVEAL_TEST_PROFILES.erratic.schedule(LEN);
    // Consecutive events jump by a chunk of chars, and time advances in steps between them.
    expect(events.length).toBeGreaterThan(1);
    const gaps = events.slice(1).map((e, idx) => e.atMs - events[idx].atMs);
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(400); // real dead air between chunks
  });
});
