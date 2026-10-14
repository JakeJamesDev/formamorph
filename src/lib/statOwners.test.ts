import { describe, expect, it } from 'vitest';
import type { PlayerStat } from '@/types';
import { regenOwners, statsOf } from './statOwners';

const stat = (over: Partial<PlayerStat> = {}): PlayerStat => ({
  id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 2, descriptors: [],
  ...over,
});

describe('statsOf', () => {
  it('reads an owner the map does not hold as no stats', () => {
    expect(statsOf({ odette: [stat()] }, 'bram')).toEqual([]);
  });
});

describe('regenOwners', () => {
  it('regenerates each owner on its own stats and reports by owner, then stat id', () => {
    // Two owners hold one stat id, as two links to one Blueprint do.
    const out = regenOwners([
      { id: 'odette', stats: [stat({ value: 50 })], enabled: {} },
      { id: 'bram', stats: [stat({ value: 99 })], enabled: {} },
    ], 3);
    expect(statsOf(out.stats, 'odette')[0].value).toBe(56);
    expect(statsOf(out.stats, 'bram')[0].value).toBe(100);
    expect(out.applied).toEqual({ odette: { vigor: 6 }, bram: { vigor: 1 } });
  });

  it("reads each owner's own enabled map", () => {
    const out = regenOwners([
      { id: 'odette', stats: [stat()], enabled: { vigor: false } },
      { id: 'bram', stats: [stat()], enabled: {} },
    ], 1);
    expect(statsOf(out.stats, 'odette')[0].value).toBe(50);
    expect(statsOf(out.stats, 'bram')[0].value).toBe(52);
    expect(out.applied).toEqual({ odette: {}, bram: { vigor: 2 } });
  });
});
