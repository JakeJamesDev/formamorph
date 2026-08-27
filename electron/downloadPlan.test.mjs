import { describe, it, expect } from 'vitest';
import downloadPlan from './downloadPlan.cjs';

const {
  DEFAULT_CHUNK_SIZE, planChunks, doneBytes, legacyDoneIndices, resumePlan,
  initRamp, rampOnSample, rampOnError, RAMP,
} = downloadPlan;

describe('planChunks: the work queue', () => {
  it('covers the file exactly, with no gaps and no overlap', () => {
    const chunks = planChunks(10, 4);
    expect(chunks).toEqual([
      { index: 0, start: 0, end: 3, length: 4 },
      { index: 1, start: 4, end: 7, length: 4 },
      { index: 2, start: 8, end: 9, length: 2 },
    ]);
    expect(chunks.reduce((n, c) => n + c.length, 0)).toBe(10);
  });

  it('splits an exact multiple without a zero-length tail', () => {
    expect(planChunks(8, 4).map((c) => c.length)).toEqual([4, 4]);
  });

  it('makes one chunk for a file smaller than the chunk size', () => {
    expect(planChunks(3, 4)).toEqual([{ index: 0, start: 0, end: 2, length: 3 }]);
  });

  it('plans nothing for an unknown or empty total', () => {
    expect(planChunks(0, 4)).toEqual([]);
    expect(planChunks(-1, 4)).toEqual([]);
  });

  it('defaults to 64 MB chunks', () => {
    expect(DEFAULT_CHUNK_SIZE).toBe(64 * 1024 * 1024);
    expect(planChunks(DEFAULT_CHUNK_SIZE * 2).length).toBe(2);
  });
});

describe('doneBytes', () => {
  it('sums only the finished chunks', () => {
    const chunks = planChunks(10, 4);
    expect(doneBytes(chunks, [0, 2])).toBe(6);
    expect(doneBytes(chunks, [])).toBe(0);
  });
});

describe('legacyDoneIndices: an old contiguous .part', () => {
  const chunks = planChunks(10, 4);

  it('counts whole chunks covered by the prefix and re-queues the partial one', () => {
    expect(legacyDoneIndices(chunks, 9)).toEqual([0, 1]);
  });

  it('counts a chunk only when the prefix reaches its last byte', () => {
    expect(legacyDoneIndices(chunks, 4)).toEqual([0]);
    expect(legacyDoneIndices(chunks, 3)).toEqual([]);
  });

  it('counts the short final chunk when the prefix is the whole file', () => {
    expect(legacyDoneIndices(chunks, 10)).toEqual([0, 1, 2]);
  });
});

describe('resumePlan: what still has to be fetched', () => {
  it('queues everything for a fresh download', () => {
    const plan = resumePlan({ total: 10, chunkSize: 4, partLength: 0, sidecar: null });
    expect(plan.restart).toBe(false);
    expect(plan.done).toEqual([]);
    expect(plan.chunks.length).toBe(3);
  });

  it('keeps the finished chunks a sidecar records', () => {
    const sidecar = { total: 10, chunkSize: 4, done: [0, 2] };
    const plan = resumePlan({ total: 10, chunkSize: 4, partLength: 10, sidecar });
    expect(plan.done).toEqual([0, 2]);
    expect(plan.restart).toBe(false);
  });

  it('round-trips through an interrupt: only the unfinished chunks come back', () => {
    const first = resumePlan({ total: 10, chunkSize: 4, partLength: 0, sidecar: null });
    const done = [first.chunks[0].index]; // one chunk landed before the interrupt
    const second = resumePlan({ total: 10, chunkSize: 4, partLength: 10, sidecar: { total: 10, chunkSize: 4, done } });
    const remaining = second.chunks.filter((c) => !second.done.includes(c.index)).map((c) => c.index);
    expect(remaining).toEqual([1, 2]);
  });

  it('discards a sidecar whose total disagrees with the server', () => {
    const plan = resumePlan({ total: 12, chunkSize: 4, partLength: 10, sidecar: { total: 10, chunkSize: 4, done: [0, 1] } });
    expect(plan.restart).toBe(true);
    expect(plan.done).toEqual([]);
  });

  it('discards a sidecar written with a different chunk size', () => {
    const plan = resumePlan({ total: 10, chunkSize: 4, partLength: 10, sidecar: { total: 10, chunkSize: 8, done: [0] } });
    expect(plan.restart).toBe(true);
  });

  it('drops sidecar chunks the part file is too short to hold', () => {
    // The file was truncated behind our back; chunk 2 ends at byte 9 but only 8 bytes exist.
    const plan = resumePlan({ total: 10, chunkSize: 4, partLength: 8, sidecar: { total: 10, chunkSize: 4, done: [0, 2] } });
    expect(plan.done).toEqual([0]);
    expect(plan.restart).toBe(false);
  });

  it('maps a legacy .part with no sidecar onto its whole-chunk prefix', () => {
    const plan = resumePlan({ total: 10, chunkSize: 4, partLength: 9, sidecar: null });
    expect(plan.done).toEqual([0, 1]);
    expect(plan.restart).toBe(false);
  });

  it('restarts an unexplained full-length .part rather than trusting it', () => {
    // No sidecar but the file is already full size: it is either stale or a segmented part that
    // lost its sidecar, and its holes are invisible. Never rename that.
    const plan = resumePlan({ total: 10, chunkSize: 4, partLength: 10, sidecar: null });
    expect(plan.restart).toBe(true);
    expect(plan.done).toEqual([]);
  });
});

describe('ramp controller: how many connections', () => {
  it('starts at three and never exceeds the ceiling', () => {
    expect(initRamp().workers).toBe(3);
    expect(RAMP.start).toBe(3);
    expect(RAMP.ceiling).toBe(8);
  });

  it('adds a worker while throughput keeps growing', () => {
    let s = initRamp();
    s = rampOnSample(s, 10e6); // first sample only sets the baseline probe
    expect(s.workers).toBe(4);
    s = rampOnSample(s, 13e6); // +30%
    expect(s.workers).toBe(5);
  });

  it('stops ramping at a plateau and ignores later samples', () => {
    let s = initRamp();
    s = rampOnSample(s, 10e6);
    s = rampOnSample(s, 10.5e6); // +5%: not worth another connection
    expect(s.workers).toBe(4);
    expect(s.ramping).toBe(false);
    s = rampOnSample(s, 40e6);
    expect(s.workers).toBe(4);
  });

  it('stops at the ceiling however good the samples get', () => {
    let s = initRamp();
    for (let i = 0; i < 20; i++) s = rampOnSample(s, 10e6 * 2 ** i);
    expect(s.workers).toBe(RAMP.ceiling);
    expect(s.ramping).toBe(false);
  });

  it('halves the pool on an error signal and stops ramping', () => {
    let s = initRamp({ workers: 8 });
    s = rampOnError(s);
    expect(s).toMatchObject({ workers: 4, ramping: false });
  });

  it('never halves below one worker', () => {
    expect(rampOnError(initRamp({ workers: 1 })).workers).toBe(1);
    expect(rampOnError(initRamp({ workers: 3 })).workers).toBe(1);
  });

  it('leaves the caller\'s state untouched (pure)', () => {
    const s = initRamp();
    const next = rampOnSample(s, 10e6);
    expect(s.workers).toBe(3);
    expect(next).not.toBe(s);
  });
});
