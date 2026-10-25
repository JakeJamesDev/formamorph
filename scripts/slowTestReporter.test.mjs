import { describe, it, expect } from 'vitest';
import { classify, loadFactor, recordRun } from './slowTestReporter.mjs';

// The idle loop takes 10 ms; from t=10 000 on, the machine runs three times slower.
const REFERENCE = 10;
const samples = [
  { at: 0, ms: 10 },
  { at: 5_000, ms: 10 },
  { at: 10_000, ms: 30 },
  { at: 15_000, ms: 30 },
  { at: 20_000, ms: 30 },
];

describe('loadFactor', () => {
  it('reads the load from the samples inside the window', () => {
    expect(loadFactor(samples, 0, 5_000, REFERENCE)).toBe(1);
    expect(loadFactor(samples, 10_000, 20_000, REFERENCE)).toBe(3);
  });

  it('falls back to the run median when no sample falls inside', () => {
    expect(loadFactor(samples, 6_000, 7_000, REFERENCE)).toBe(3);
  });

  it('never reports a machine faster than idle', () => {
    expect(loadFactor([{ at: 0, ms: 5 }], 0, 1, REFERENCE)).toBe(1);
  });
});

describe('classify', () => {
  const test = (key, startTime, duration) => ({ key, startTime, duration });
  const history = { heavy: [3000, 3100, 2900], regressed: [1500, 1400, 1600], starved: [1500] };

  it('flags only a test slower than its own recent runs once load is taken out', () => {
    const { regressed, loaded, heavy } = classify([
      test('starved', 10_000, 4_500), // 1.5 s idle under 3× load: slow only from load
      test('heavy', 10_000, 9_000), // 3 s idle, as it always runs
      test('regressed', 0, 3_200), // 3.2 s idle against a 1.5 s median
      test('new', 0, 2_500), // no history yet: heavy, not a regression
      test('fast', 0, 500),
    ], samples, REFERENCE, 2000, history);
    expect(regressed.map((t) => [t.key, Math.round(t.idle), t.usual])).toEqual([['regressed', 3200, 1500]]);
    expect(loaded.map((t) => [t.key, Math.round(t.idle)])).toEqual([['starved', 1500]]);
    expect(heavy).toBe(2);
  });
});

describe('recordRun', () => {
  it('adds each test\'s idle cost and keeps the last five runs', () => {
    const next = recordRun({ a: [1, 2, 3, 4, 5] }, [{ key: 'a', startTime: 10_000, duration: 600 }, { key: 'b', startTime: 0, duration: 40 }], samples, REFERENCE);
    expect(next).toEqual({ a: [2, 3, 4, 5, 200], b: [40] });
  });
});
