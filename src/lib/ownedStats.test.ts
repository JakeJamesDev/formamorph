import { describe, it, expect } from 'vitest';
import {
  addOwnedStat, duplicateOwnedStat, moveOwnedStat, removeOwnedStat, updateOwnedStat,
} from './ownedStats';
import type { Entity, Stat } from '@/types';

const stat = (id: string, extra: Partial<Stat> = {}): Stat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...extra,
});

const bram = (stats?: Stat[]): Entity => ({ id: 'bram', name: 'Bram', ...(stats ? { stats } : {}) });

describe('owned stat edits', () => {
  it('adds a stat with the defaults the Stats tab gives, at the end of the entity\'s list', () => {
    const next = addOwnedStat(bram([stat('trust')]), 'vigor', 'Vigor');
    expect(next.stats?.map((s) => s.id)).toEqual(['trust', 'vigor']);
    expect(next.stats?.[1]).toMatchObject({ name: 'Vigor', type: 'number', min: 0, max: 100, value: 0, regen: 0 });
    expect(next.stats?.[1].descriptors?.length).toBeGreaterThan(0);
  });

  it('names a stat "New Stat" when the search text is empty', () => {
    expect(addOwnedStat(bram(), 'x').stats?.[0].name).toBe('New Stat');
  });

  it('replaces one stat by id and leaves the rest', () => {
    const next = updateOwnedStat(bram([stat('a'), stat('b')]), stat('b', { name: 'Bee', regen: 2 }));
    expect(next.stats?.map((s) => s.name)).toEqual(['a', 'Bee']);
    expect(next.stats?.[1].regen).toBe(2);
  });

  it('rebuilds a default descriptor from the new name, as a rename on the Stats tab does', () => {
    const added = addOwnedStat(bram(), 's1', 'New Stat');
    const renamed = updateOwnedStat(added, { ...added.stats![0], name: 'Trust' });
    expect(renamed.stats?.[0].descriptors.map((d) => d.description))
      .toEqual(['Trust is low', 'Trust is medium', 'Trust is high']);
  });

  it('removes one stat, and stores an empty list as absent', () => {
    const next = removeOwnedStat(bram([stat('a'), stat('b')]), 'a');
    expect(next.stats?.map((s) => s.id)).toEqual(['b']);
    expect('stats' in removeOwnedStat(next, 'b')).toBe(false);
  });

  it('copies a stat right after its original with a fresh id and a "(Copy)" name', () => {
    const next = duplicateOwnedStat(bram([stat('a', { value: 7 }), stat('b')]), 'a', 'a2');
    expect(next.stats?.map((s) => s.id)).toEqual(['a', 'a2', 'b']);
    expect(next.stats?.[1]).toMatchObject({ name: 'a (Copy)', value: 7 });
  });

  it('moves a stat to the place of the one it is dropped on', () => {
    const next = moveOwnedStat(bram([stat('a'), stat('b'), stat('c')]), 'a', 'c');
    expect(next.stats?.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('leaves the entity as it was for an id it does not hold', () => {
    const start = bram([stat('a'), stat('b')]);
    expect(moveOwnedStat(start, 'a', 'nope')).toBe(start);
    expect(duplicateOwnedStat(start, 'nope', 'z')).toBe(start);
  });
});
