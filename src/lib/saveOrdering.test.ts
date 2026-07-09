import { describe, it, expect } from 'vitest';
import { mergeOrder, folderRefFor, groupSaves, type SaveMeta } from './saveOrdering';

const meta = (id: string, worldId: string | undefined, worldName: string | null, timestamp: number): SaveMeta =>
  ({ id, name: id, worldId, worldName, timestamp });

describe('mergeOrder', () => {
  const items = [meta('a', 'w', 'W', 10), meta('b', 'w', 'W', 30), meta('c', 'w', 'W', 20)];
  const idOf = (m: SaveMeta) => m.id;
  const timeOf = (m: SaveMeta) => m.timestamp;

  it('sorts unlisted items newest-first when no stored order', () => {
    expect(mergeOrder(items, idOf, timeOf, []).map(idOf)).toEqual(['b', 'c', 'a']);
  });

  it('respects a stored order for listed items', () => {
    expect(mergeOrder(items, idOf, timeOf, ['a', 'b', 'c']).map(idOf)).toEqual(['a', 'b', 'c']);
  });

  it('prepends new/unlisted items (newest-first) above the stored order', () => {
    // 'b' is unlisted (e.g. a fresh save) → goes on top even though the rest were manually ordered.
    expect(mergeOrder(items, idOf, timeOf, ['c', 'a']).map(idOf)).toEqual(['b', 'c', 'a']);
  });

  it('skips stored ids that no longer exist', () => {
    expect(mergeOrder(items, idOf, timeOf, ['gone', 'b', 'a', 'c']).map(idOf)).toEqual(['b', 'a', 'c']);
  });
});

describe('folderRefFor', () => {
  const worlds = [{ id: 'w1', name: 'Alpha' }, { id: 'w2', name: 'Beta' }];
  const nameToId = new Map(worlds.map((w) => [w.name, w.id] as const));
  const idToName = new Map(worlds.map((w) => [w.id, w.name] as const));

  it('keys by worldId when present', () => {
    expect(folderRefFor(meta('s', 'w1', 'Alpha', 1), nameToId, idToName)).toMatchObject({ key: 'w1', worldId: 'w1', worldName: 'Alpha' });
  });

  it('unifies a legacy name-only save with an installed world id', () => {
    expect(folderRefFor(meta('s', undefined, 'Beta', 1), nameToId, idToName)).toMatchObject({ key: 'w2', worldId: 'w2' });
  });

  it('falls back to a name key for an orphaned world', () => {
    const ref = folderRefFor(meta('s', undefined, 'Ghost', 1), nameToId, idToName);
    expect(ref.key).toBe('name:Ghost');
    expect(ref.worldId).toBeUndefined();
  });
});

describe('groupSaves', () => {
  const worlds = [{ id: 'w1', name: 'Alpha' }, { id: 'w2', name: 'Beta' }];
  const current = { id: 'w1', name: 'Alpha' };

  it('always includes the current world folder even with no saves', () => {
    const folders = groupSaves([], worlds, current);
    const cur = folders.find((f) => f.key === 'w1');
    expect(cur).toBeDefined();
    expect(cur!.saves).toHaveLength(0);
  });

  it('groups by world and computes lastPlayed as the newest timestamp', () => {
    const saves = [
      meta('a', 'w1', 'Alpha', 100),
      meta('b', 'w1', 'Alpha', 300),
      meta('c', 'w2', 'Beta', 50),
    ];
    const folders = groupSaves(saves, worlds, current);
    const alpha = folders.find((f) => f.key === 'w1')!;
    const beta = folders.find((f) => f.key === 'w2')!;
    expect(alpha.saves.map((s) => s.id)).toEqual(['b', 'a']); // newest-first within a folder
    expect(alpha.lastPlayed).toBe(300);
    expect(beta.lastPlayed).toBe(50);
  });

  it('omits the current-world folder when no current world is given (main menu)', () => {
    const saves = [meta('a', 'w1', 'Alpha', 100)];
    const folders = groupSaves(saves, worlds); // no current
    expect(folders.map((f) => f.key)).toEqual(['w1']); // only the world that has a save
    expect(folders.every((f) => f.saves.length > 0)).toBe(true);
  });

  it('unifies legacy name-only saves into the same folder as id-stamped ones', () => {
    const saves = [meta('new', 'w2', 'Beta', 10), meta('old', undefined, 'Beta', 20)];
    const folders = groupSaves(saves, worlds, current);
    const beta = folders.find((f) => f.key === 'w2')!;
    expect(beta.saves.map((s) => s.id).sort()).toEqual(['new', 'old']);
  });
});
