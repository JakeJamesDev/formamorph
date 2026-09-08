import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildInitialSelection, finalizeSelection } from './dictionarySelection';
import { restoreWorldAdditionDefaults, saveWorldAdditionDefaults } from './worldAdditionDefaults';

const initial = () => buildInitialSelection([
  { id: 'shared', name: 'World book', entries: [] },
  { id: 'removed', name: 'Removed book', entries: [] },
], [
  { id: 'shared', name: 'Library book' },
  { id: 'gone', name: 'Gone library book' },
]);

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('local world addition defaults', () => {
  it('reconciles renames, removed records, source collisions, and new content using current identities', () => {
    const items = initial();
    saveWorldAdditionDefaults('one', {
      entityIds: new Set(['survivor', 'missing']),
      dictionaryItems: [
        { ...items[2], enabled: true },
        { ...items[0], enabled: false },
        items[1], { ...items[3], enabled: true },
      ],
    });
    const current = buildInitialSelection([
      { id: 'shared', name: 'Renamed world book', entries: [] },
      { id: 'new-world', name: 'New authored book', entries: [] },
      { id: 'new-off', name: 'New disabled book', enabled: false, entries: [] },
    ], [
      { id: 'shared', name: 'Renamed library book' },
      { id: 'new-library', name: 'New library book' },
      { id: 'unrelated', name: 'Gone library book' },
    ]);
    const currentEntities = [
      { id: 'survivor', name: 'Renamed entity' },
      { id: 'unrelated', name: 'Missing entity' },
    ];
    const restored = restoreWorldAdditionDefaults('one', current, currentEntities);
    expect([...restored.entityIds]).toEqual(['survivor']);
    expect(restored.dictionaryItems.map(({ key, enabled, book }) => [key, enabled, book.name])).toEqual([
      ['library:shared', true, 'Renamed library book'],
      ['world:shared', false, 'Renamed world book'],
      ['world:new-world', true, 'New authored book'],
      ['world:new-off', false, 'New disabled book'],
      ['library:new-library', false, 'New library book'],
      ['library:unrelated', false, 'Gone library book'],
    ]);
    const payload = finalizeSelection(restored.dictionaryItems, new Map([
      ['shared', { id: 'shared', name: 'Updated library content', entries: [
        { id: 'entry', name: 'Updated entry', key: ['test'], value: 'Current content' },
      ] }],
    ]));
    expect(payload.map(({ name }) => name)).toEqual(['Updated library content', 'New authored book']);
    expect(payload[0].entries[0].value).toBe('Current content');
    expect(payload[0].entries[0].id).not.toBe('entry');
  });

  it('distinguishes no record from explicit none and keeps none when the library grows', () => {
    saveWorldAdditionDefaults('none', {
      entityIds: new Set(), dictionaryItems: initial().map((item) => ({ ...item, enabled: false })),
    });
    const expanded = [...initial(), ...buildInitialSelection([], [{ id: 'new', name: 'New library book' }])];
    expect(finalizeSelection(restoreWorldAdditionDefaults('none', expanded, [{ id: 'new' }]).dictionaryItems, new Map())).toEqual([]);
    expect(finalizeSelection(restoreWorldAdditionDefaults('absent', expanded, []).dictionaryItems, new Map()).map(({ id }) => id))
      .toEqual(['shared', 'removed']);
    expect([...restoreWorldAdditionDefaults('none', expanded, [{ id: 'new' }]).entityIds]).toEqual([]);
  });

  it('preserves prior defaults when storage refuses an overwrite', () => {
    saveWorldAdditionDefaults('one', { entityIds: new Set(['entity']), dictionaryItems: initial() });
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });
    expect(() => saveWorldAdditionDefaults('one', { entityIds: new Set(), dictionaryItems: [] })).toThrow('Storage full');
    write.mockRestore();
    expect([...restoreWorldAdditionDefaults('one', initial(), [{ id: 'entity' }]).entityIds]).toEqual(['entity']);
  });

  it.each([null, [], {}, { version: 2 }, { version: 1, entities: [7], dictionaries: [] },
    { version: 1, entities: [], dictionaries: [{ key: 'world:shared', enabled: 'yes' }] },
  ])('safely ignores an invalid preference record: %j', (record) => {
    localStorage.setItem('FORMAMORPH_worldAdditions:one', JSON.stringify(record));
    const restored = restoreWorldAdditionDefaults('one', initial(), []);
    expect(restored.dictionaryItems.map(({ key, enabled }) => [key, enabled])).toEqual([
      ['world:shared', true], ['world:removed', true], ['library:shared', false], ['library:gone', false],
    ]);
  });

  it('does not duplicate dictionaries from repeated stored references', () => {
    localStorage.setItem('FORMAMORPH_worldAdditions:one', JSON.stringify({
      version: 1, entities: [], dictionaries: [
        { key: 'world:shared', enabled: false }, { key: 'world:shared', enabled: true },
      ],
    }));
    const restored = restoreWorldAdditionDefaults('one', initial(), []);
    expect(restored.dictionaryItems.filter(({ key }) => key === 'world:shared')).toEqual([
      expect.objectContaining({ enabled: false }),
    ]);
  });
});
