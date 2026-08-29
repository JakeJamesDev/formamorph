import { describe, it, expect, beforeEach } from 'vitest';
import { LEGACY_ORDER_KEYS, TILE_STORAGE_KEYS, loadTabOrganization, saveTabOrganization } from './codec';
import { addToGroup, createGroupFromDrop, setTileSize } from './operations';
import { emptyTabOrganization, type LibraryTabOrganization } from './types';

const stored = (tab: 'worlds' | 'entities') =>
  JSON.parse(localStorage.getItem(TILE_STORAGE_KEYS[tab]) ?? 'null');

const grouped = (): LibraryTabOrganization =>
  setTileSize(
    createGroupFromDrop({ ...emptyTabOrganization(), order: ['a', 'b', 'c'] }, {
      groupId: 'g1', dragId: 'b', targetId: 'a',
    }),
    'c',
    'small',
  );

describe('loadTabOrganization', () => {
  beforeEach(() => localStorage.clear());

  it('reads an untouched library as empty', () => {
    expect(loadTabOrganization('worlds')).toEqual(emptyTabOrganization());
  });

  it('adopts the old flat card order, so an existing library is not scrambled by the update', () => {
    localStorage.setItem(LEGACY_ORDER_KEYS.worlds, JSON.stringify(['w3', 'w1', 'w2']));

    expect(loadTabOrganization('worlds')).toEqual({ order: ['w3', 'w1', 'w2'], groups: {}, sizes: {} });
  });

  it('prefers organized state over the old order once the player has arranged anything', () => {
    localStorage.setItem(LEGACY_ORDER_KEYS.worlds, JSON.stringify(['w3', 'w1', 'w2']));
    saveTabOrganization('worlds', { ...emptyTabOrganization(), order: ['w1'] });

    expect(loadTabOrganization('worlds').order).toEqual(['w1']);
  });

  it('round-trips groups, sizes, and settings', () => {
    const org = grouped();
    saveTabOrganization('worlds', org);

    expect(loadTabOrganization('worlds')).toEqual(org);
  });

  it('keeps each tab to itself, so a world group never reaches the entities grid', () => {
    saveTabOrganization('worlds', { ...emptyTabOrganization(), order: ['w1'] });
    saveTabOrganization('entities', { ...emptyTabOrganization(), order: ['e1'] });

    expect(loadTabOrganization('worlds').order).toEqual(['w1']);
    expect(loadTabOrganization('entities').order).toEqual(['e1']);
    expect(stored('worlds')).not.toEqual(stored('entities'));
  });

  it('falls back to the old order when the stored state is corrupt', () => {
    localStorage.setItem(LEGACY_ORDER_KEYS.worlds, JSON.stringify(['w1']));
    localStorage.setItem(TILE_STORAGE_KEYS.worlds, '{not json');

    expect(loadTabOrganization('worlds').order).toEqual(['w1']);
  });

  it('drops entries that are not the shape it stores', () => {
    localStorage.setItem(TILE_STORAGE_KEYS.worlds, JSON.stringify({
      order: ['a', 7, null, 'b'],
      groups: {
        g1: { id: 'g1', name: 'Keep', members: ['a', 3], settings: { promptPreset: 'noir' } },
        g2: { id: 'g2', name: 'No members', members: [], settings: {} },
        g3: 'not a group',
      },
      sizes: { a: 'small', b: 'enormous', c: 4 },
    }));

    const org = loadTabOrganization('worlds');

    // `a` belongs to g1, so it leaves the top level; the numbers and nulls in the order are dropped.
    expect(org.order).toEqual(['b', 'g1']);
    expect(Object.keys(org.groups)).toEqual(['g1']);
    expect(org.groups.g1.members).toEqual(['a']);
    expect(org.groups.g1.settings).toEqual({ promptPreset: 'noir' });
    expect(org.sizes).toEqual({ a: 'small' });
  });

  it('never leaves an id both grouped and loose in the grid', () => {
    localStorage.setItem(TILE_STORAGE_KEYS.worlds, JSON.stringify({
      order: ['a', 'g1'],
      groups: { g1: { id: 'g1', name: 'Folder', members: ['a'], settings: {} } },
      sizes: {},
    }));

    expect(loadTabOrganization('worlds').order).toEqual(['g1']);
  });

  it('lists a group that the order forgot, so a folder is never invisible', () => {
    localStorage.setItem(TILE_STORAGE_KEYS.worlds, JSON.stringify({
      order: ['b'],
      groups: { g1: { id: 'g1', name: 'Folder', members: ['a'], settings: {} } },
      sizes: {},
    }));

    expect(loadTabOrganization('worlds').order).toEqual(['b', 'g1']);
  });

  it('reads a member listed in two folders as belonging to the first one only', () => {
    localStorage.setItem(TILE_STORAGE_KEYS.worlds, JSON.stringify({
      order: ['g1', 'g2'],
      groups: {
        g1: { id: 'g1', name: 'One', members: ['a', 'b'], settings: {} },
        g2: { id: 'g2', name: 'Two', members: ['b', 'c'], settings: {} },
      },
      sizes: {},
    }));

    const org = loadTabOrganization('worlds');

    expect(org.groups.g1.members).toEqual(['a', 'b']);
    expect(org.groups.g2.members).toEqual(['c']);
  });
});

describe('saveTabOrganization', () => {
  beforeEach(() => localStorage.clear());

  it('survives a storage that refuses to write', () => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('quota'); };
    try {
      expect(() => saveTabOrganization('worlds', grouped())).not.toThrow();
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });

  it('writes a library with a folder in it, and reads back what the player arranged', () => {
    const org = addToGroup(grouped(), 'c', 'g1');
    saveTabOrganization('models', org);

    expect(loadTabOrganization('models')).toEqual(org);
  });
});
