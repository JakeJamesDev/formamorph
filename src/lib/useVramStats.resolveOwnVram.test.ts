import { describe, it, expect } from 'vitest';
import { resolveOwnVram, type VramStats } from './useVramStats';

const base: VramStats = { status: 'online', gpus: [], processes: [], selfPid: null, lastUpdated: 0 };

describe('resolveOwnVram', () => {
  it('prefers the measured per-process figure for our pid (not estimated)', () => {
    const stats: VramStats = {
      ...base,
      selfPid: 42,
      processes: [
        { pid: 7, name: 'other', usedMB: 500 },
        { pid: 42, name: 'formamorph', usedMB: 2048 },
      ],
    };
    expect(resolveOwnVram(stats, 1800)).toEqual({ ownUsedMB: 2048, ownEstimated: false });
  });

  it('falls back to the engine estimate when our process row has null usage (Windows GeForce)', () => {
    const stats: VramStats = {
      ...base,
      selfPid: 42,
      processes: [{ pid: 42, name: 'formamorph', usedMB: null }],
    };
    expect(resolveOwnVram(stats, 1800)).toEqual({ ownUsedMB: 1800, ownEstimated: true });
  });

  it('falls back to the estimate when our pid is absent from the process list', () => {
    const stats: VramStats = { ...base, selfPid: 42, processes: [{ pid: 7, name: 'other', usedMB: 500 }] };
    expect(resolveOwnVram(stats, 1500)).toEqual({ ownUsedMB: 1500, ownEstimated: true });
  });

  it('reports no footprint when neither a measurement nor an estimate exists', () => {
    expect(resolveOwnVram(base, null)).toEqual({ ownUsedMB: null, ownEstimated: false });
  });

  it('ignores the process list when selfPid is unknown, using the estimate', () => {
    const stats: VramStats = { ...base, processes: [{ pid: 42, name: 'formamorph', usedMB: 2048 }] };
    expect(resolveOwnVram(stats, 900)).toEqual({ ownUsedMB: 900, ownEstimated: true });
  });
});
