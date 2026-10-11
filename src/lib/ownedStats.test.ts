import { describe, it, expect } from 'vitest';
import {
  addOwnedStat, addOwnedStatGroup, duplicateOwnedStatNode, removeOwnedStat,
  updateOwnedStat, updateOwnedStatGroup,
} from './ownedStats';
import { removeEntityStatGroup } from './statLinks';
import type { Entity, Stat, StatGroup } from '@/types';

const stat = (id: string, extra: Partial<Stat> = {}): Stat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...extra,
});
const group = (id: string, extra: Partial<StatGroup> = {}): StatGroup => ({ id, name: id, parentId: null, ...extra });

const bram = (stats?: Stat[], groups?: StatGroup[]): Entity => ({
  id: 'bram', name: 'Bram', ...(stats ? { stats } : {}), ...(groups ? { statGroups: groups } : {}),
});

describe('owned stat edits', () => {
  it('adds a stat with the defaults the Stats tab gives, at the end of the entity\'s list', () => {
    const next = addOwnedStat(bram([stat('trust')]), 'vigor', 'Vigor');
    expect(next.stats?.map((s) => s.id)).toEqual(['trust', 'vigor']);
    expect(next.stats?.[1]).toMatchObject({ name: 'Vigor', type: 'number', min: 0, max: 100, value: 0, regen: 0 });
    expect(next.stats?.[1].descriptors?.length).toBeGreaterThan(0);
  });

  it('places a new stat after every top-level stat and group, not inside a group', () => {
    const next = addOwnedStat(bram([stat('trust', { order: 0 })], [group('mind', { order: 1 })]), 'vigor');
    expect(next.stats?.[1]).toMatchObject({ groupId: null, order: 2 });
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

  it('keeps the entity\'s groups when its last stat goes', () => {
    const next = removeOwnedStat(bram([stat('a')], [group('g')]), 'a');
    expect(next.statGroups?.map((g) => g.id)).toEqual(['g']);
  });
});

describe('owned stat groups', () => {
  it('adds a group at the end of the top level and stores the list on the entity', () => {
    const next = addOwnedStatGroup(bram([stat('a', { order: 0 })]), 'g', 'Mind');
    expect(next.statGroups).toEqual([expect.objectContaining({ id: 'g', name: 'Mind', parentId: null, order: 1 })]);
    expect(next.stats?.map((s) => s.id)).toEqual(['a']);
  });

  it('renames and describes one group by id and leaves the rest', () => {
    const start = bram([], [group('a'), group('b')]);
    const next = updateOwnedStatGroup(start, group('b', { name: 'Bee', aiDescription: 'About bees' }));
    expect(next.statGroups?.map((g) => g.name)).toEqual(['a', 'Bee']);
    expect(next.statGroups?.[1].aiDescription).toBe('About bees');
  });

  it('removes a group, moves its stats up and stores an empty list as absent', () => {
    const start = bram([stat('a', { groupId: 'g' })], [group('g')]);
    const next = removeEntityStatGroup(start, 'g');
    expect(next.stats?.[0].groupId).toBeNull();
    expect('statGroups' in next).toBe(false);
  });

  it('leaves the entity as it was for a group it does not hold', () => {
    const start = bram([stat('a')], [group('g')]);
    expect(removeEntityStatGroup(start, 'nope')).toBe(start);
  });

  it('copies a stat right after its original with a fresh id and a "(Copy)" name', () => {
    const { entity, newId } = duplicateOwnedStatNode(bram([stat('a', { value: 7, order: 0 }), stat('b', { order: 1 })]), 'a');
    expect(entity.stats?.map((s) => s.id)).toEqual(['a', newId, 'b']);
    expect(entity.stats?.[1]).toMatchObject({ name: 'a (Copy)', value: 7 });
  });

  it('copies a group with its stats, so the copy holds its own', () => {
    const start = bram([stat('a', { groupId: 'g', order: 0 })], [group('g', { order: 0 })]);
    const { entity, newId } = duplicateOwnedStatNode(start, 'g');
    expect(entity.statGroups).toHaveLength(2);
    expect(entity.stats).toHaveLength(2);
    expect(entity.stats?.filter((s) => s.groupId === newId)).toHaveLength(1);
  });

  it('leaves the entity as it was when it copies an id it lacks', () => {
    const start = bram([stat('a')]);
    expect(duplicateOwnedStatNode(start, 'nope').entity).toBe(start);
  });
});
