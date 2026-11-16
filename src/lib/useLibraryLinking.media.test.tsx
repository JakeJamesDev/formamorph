// @vitest-environment jsdom
// Must load before the storage singletons, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import EntityStorageService from '@/services/EntityStorageService';
import { useLibraryLinking } from './useLibraryLinking';
import { loadMediaHashes } from './libraryMedia';
import { saveCopyToLibrary } from './librarySources';
import { planOwnedWriteBack } from './libraryWriteBack';
import { buildEntityCardData, parseEntityCardData } from './entityFile';
import type { Entity, MediaList } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

// "ABC" under two MIME labels: one file, two strings.
const ABC_PNG = 'data:image/png;base64,QUJD';
const ABC_RAW = 'data:application/octet-stream;base64,QUJD';
const XYZ_PNG = 'data:image/png;base64,WFla';

async function portraitList(): Promise<MediaList> {
  const hashes = await loadMediaHashes([{ images: [{ data: ABC_PNG }] }], undefined);
  return { 'm-abc': { id: 'm-abc', name: 'Portrait', kind: 'image', data: ABC_PNG, hash: hashes.get(ABC_PNG) } };
}

function setup(entities: Entity[], mediaList: MediaList | undefined) {
  const noop = vi.fn();
  const added: Entity[] = [];
  const lists: (MediaList | undefined)[] = [];
  const hook = renderHook(() => useLibraryLinking({
    worldId: 'w', worldName: 'Sedge', entities, dictionaries: [], placeholders: [], worldPlaceholders: [],
    placeholderGroups: [], locations: [], traits: [], traitGroups: [], stats: [], statGroups: [],
    updateEntity: noop, updateDictionary: noop, setEntities: noop, setDictionaries: noop,
    addEntityToWorld: (entity) => { added.push(entity); }, addBookToWorld: noop, addPlaceholder: noop, addLocation: noop,
    vrmStore: undefined, setVrmStore: noop, mediaList, setMediaList: (list) => { lists.push(list); },
    setOwnedLibraryIds: noop, reopenPicker: noop, exportEntity: noop, exportDictionary: noop, supporterCopy: null,
  }));
  return { ...hook, added, lists };
}

beforeEach(async () => {
  for (const row of await EntityStorageService.getEntityMetadata()) await EntityStorageService.deleteEntity(row.id);
});
afterEach(cleanup);

describe('adding a library entity to a world with a Media List', () => {
  it('places its pictures, reusing the entry with the same file, and the copy holds ids', async () => {
    const { result, added, lists } = setup([], await portraitList());
    const item = { id: 'lib-1', name: 'Wren', images: [{ data: ABC_RAW }, { data: XYZ_PNG, name: 'Wounded' }] } as Entity;
    await act(async () => { await result.current.beginAdd([{ kind: 'entity', item }]); });

    expect(added).toHaveLength(1);
    const [first, second] = (added[0].images ?? []).map((img) => ('mediaId' in img ? img.mediaId : null));
    expect(first).toBe('m-abc');
    const list = lists.at(-1)!;
    expect(list[second!]).toMatchObject({ name: 'Wounded', data: XYZ_PNG });
    expect(Object.keys(list)).toHaveLength(2);
  });

  it('names a nameless image after its entity, and two copies of one file share an entry', async () => {
    const { result, added, lists } = setup([], await portraitList());
    const a = { id: 'lib-1', name: 'Wren', images: [{ data: XYZ_PNG }] } as Entity;
    const b = { id: 'lib-2', name: 'Wren', images: [{ data: XYZ_PNG }] } as Entity;
    await act(async () => { await result.current.beginAdd([{ kind: 'entity', item: a }, { kind: 'entity', item: b }]); });

    const linked = added.map((entity) => (entity.images ?? []).map((img) => ('mediaId' in img ? img.mediaId : null))[0]);
    expect(linked[0]).toBe(linked[1]);
    expect(lists.at(-1)![linked[0]!].name).toBe('Wren 1');
  });

  it('places a character card\'s images, names kept', async () => {
    const exported = buildEntityCardData(
      { id: 'w9', name: 'Wren', images: [{ mediaId: 'p' }, { mediaId: 'q' }] } as Entity, [], {}, undefined, undefined,
      { p: { id: 'p', name: 'Portrait', kind: 'image', data: ABC_PNG }, q: { id: 'q', name: 'v1.5 sketch', kind: 'image', data: XYZ_PNG } },
    );
    const card = parseEntityCardData(JSON.parse(JSON.stringify(exported)), ABC_PNG);
    const { result, added, lists } = setup([], {});
    await act(async () => { await result.current.beginAdd([{ kind: 'entity', item: card }]); });

    const list = lists.at(-1)!;
    const names = (added[0].images ?? []).map((img) => ('mediaId' in img ? list[img.mediaId].name : null));
    expect(names).toEqual(['Portrait', 'v1.5 sketch']);
  });

  it('keeps pictures embedded in a world without one', async () => {
    const { result, added, lists } = setup([], undefined);
    const item = { id: 'lib-1', name: 'Wren', images: [{ data: ABC_PNG }] } as Entity;
    await act(async () => { await result.current.beginAdd([{ kind: 'entity', item }]); });

    expect(added[0].images).toEqual([{ data: ABC_PNG }]);
    expect(lists).toEqual([]);
  });
});

describe('library sync into a world with a Media List', () => {
  it('places an updated copy\'s new picture and relinks it', async () => {
    const source = await saveCopyToLibrary({ id: 'x', name: 'Wren', images: [{ data: XYZ_PNG, name: 'Wounded' }] } as Entity, []);
    const copy = { id: 'w1', name: 'Wren', images: [{ mediaId: 'm-abc' }], link: { libraryId: source.id, sourceRevision: 'older' } } as Entity;
    const written: Entity[][] = [];
    const lists: (MediaList | undefined)[] = [];
    const noop = vi.fn();
    const listRef = await portraitList();
    renderHook(() => useLibraryLinking({
      worldId: 'w', worldName: 'Sedge', entities: [copy], dictionaries: [], placeholders: [], worldPlaceholders: [],
      placeholderGroups: [], locations: [], traits: [], traitGroups: [], stats: [], statGroups: [],
      updateEntity: noop, updateDictionary: noop, setEntities: (next) => { written.push(next); }, setDictionaries: noop,
      addEntityToWorld: noop, addBookToWorld: noop, addPlaceholder: noop, addLocation: noop,
      vrmStore: undefined, setVrmStore: noop, mediaList: listRef, setMediaList: (list) => { lists.push(list); },
      setOwnedLibraryIds: noop, reopenPicker: noop, exportEntity: noop, exportDictionary: noop, supporterCopy: null,
    }));

    await waitFor(() => expect(written).toHaveLength(1));
    const image = written[0][0].images?.[0];
    const id = image && 'mediaId' in image ? image.mediaId : '';
    expect(lists.at(-1)?.[id]).toMatchObject({ name: 'Wounded', data: XYZ_PNG });
  });
});

describe('owned write-back from a world with a Media List', () => {
  const writeBack = async (copy: Entity, list: MediaList) => (await planOwnedWriteBack({
    worldId: 'w', entities: [copy], dictionaries: [], placeholders: [], locations: [], traits: [], traitGroups: [],
    mediaList: list, supporterCopy: null,
  }))();

  it('writes nothing when the linked copy holds the same files', async () => {
    // The library holds the bytes under another string and without a name.
    const source = await saveCopyToLibrary({ id: 'x', name: 'Wren', images: [{ data: ABC_RAW }] } as Entity, []);
    const copy = { id: 'w1', name: 'Wren', images: [{ mediaId: 'm-abc' }], link: { libraryId: source.id, sourceRevision: source.revision } } as Entity;
    expect(await writeBack(copy, await portraitList())).toEqual([]);
  });

  it('writes an edited copy as embedded images with their names', async () => {
    const source = await saveCopyToLibrary({ id: 'x', name: 'Wren', images: [{ data: ABC_RAW }] } as Entity, []);
    const copy = { id: 'w1', name: 'Wren', images: [{ mediaId: 'm-abc' }, { mediaId: 'm-xyz' }], link: { libraryId: source.id, sourceRevision: source.revision } } as Entity;
    const list = { ...await portraitList(), 'm-xyz': { id: 'm-xyz', name: 'Wounded', kind: 'image' as const, data: XYZ_PNG } };
    expect(await writeBack(copy, list)).toHaveLength(1);
    const stored = await EntityStorageService.getEntityData(source.id);
    expect(stored.images).toEqual([{ data: ABC_PNG, name: 'Portrait' }, { data: XYZ_PNG, name: 'Wounded' }]);
  });
});

describe('Save to Library from a world with a Media List', () => {
  it('stores embedded pictures with their names and no ids', async () => {
    const copy = { id: 'w1', name: 'Wren', images: [{ mediaId: 'm-abc' }] } as Entity;
    const { result } = setup([copy], await portraitList());
    await act(async () => { result.current.controlFor(copy, false).onFace(); });

    await waitFor(async () => expect(await EntityStorageService.getEntityMetadata()).toHaveLength(1));
    const [row] = await EntityStorageService.getEntityMetadata();
    const stored = await EntityStorageService.getEntityData(row.id);
    expect(stored.images).toEqual([{ data: ABC_PNG, name: 'Portrait' }]);
  });
});
