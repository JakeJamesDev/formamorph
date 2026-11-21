import { describe, it, expect } from 'vitest';
import type { Entity, MediaEntry, MediaList, TraitRequirementRow } from '@/types';
import { loadMediaHashes, loadMediaLookup, placeEntityMedia, withEmbeddedMedia } from './libraryMedia';
import { contentMatchesSource, planWriteBack, type LibrarySource } from './linkedContent';
import { diffContent, diffHasChanges } from './componentUpdates';
import { toLibraryItem } from './librarySources';
import { buildEntityCardData, parseEntityCardData } from './entityFile';
import { entityPublishPayload } from './publishPayload';
import { applyUpdate, type LiveWorld } from './componentUpdateRun';
import { applyRepair } from './sourceChecks';
import { resolveBundledLinks } from './worldBundle';

const KNIGHT: TraitRequirementRow[] = [{ all: [{ kind: 'trait', id: 'knight' }] }];
// "ABC" twice under different MIME labels: one file's bytes, two different strings.
const ABC_PNG = 'data:image/png;base64,QUJD';
const ABC_RAW = 'data:application/octet-stream;base64,QUJD';
const XYZ_PNG = 'data:image/png;base64,WFla';
const QRS_PNG = 'data:image/png;base64,UVJT';

const entry = (id: string, name: string, data: string, hash?: string): MediaEntry =>
  ({ id, name, kind: 'image', data, ...(hash ? { hash } : {}) });
const listOf = (...entries: MediaEntry[]): MediaList => Object.fromEntries(entries.map((e) => [e.id, e]));
const wren = (extra: Partial<Entity> = {}): Entity => ({ id: 'w1', name: 'Wren', ...extra } as Entity);
const ids = (entity: Entity) => (entity.images ?? []).map((img) => ('mediaId' in img ? img.mediaId : null));

/** A world list holding ABC as "Portrait", hashed as placement leaves it. */
async function portraitList(): Promise<MediaList> {
  const hashes = await loadMediaHashes([{ images: [{ data: ABC_PNG }] }], undefined);
  return listOf(entry('m-abc', 'Portrait', ABC_PNG, hashes.get(ABC_PNG)));
}

describe('placement into a world (Add from Library)', () => {
  it('places each picture, reusing the entry with the same file, and the entity holds ids', async () => {
    const list = await portraitList();
    // The library copy carries the same bytes under another string, plus a new file.
    const incoming = wren({ images: [{ data: ABC_RAW, requires: KNIGHT }, { data: XYZ_PNG, name: 'v1.5 sketch' }] });
    const placed = placeEntityMedia(incoming, list, await loadMediaHashes([incoming], list));
    expect(ids(placed.entity)[0]).toBe('m-abc');
    expect(placed.entity.images?.[0]).toEqual({ mediaId: 'm-abc', requires: KNIGHT });
    const added = placed.list![ids(placed.entity)[1]!];
    // A carried name is an entry name: no extension drop (Q31).
    expect(added).toMatchObject({ name: 'v1.5 sketch', data: XYZ_PNG });
    expect(Object.keys(placed.list!)).toHaveLength(2);
  });

  it('leaves a world without a Media List embedded, entity untouched', async () => {
    const incoming = wren({ images: [{ data: ABC_PNG }] });
    const placed = placeEntityMedia(incoming, undefined, await loadMediaHashes([incoming], undefined));
    expect(placed.entity).toBe(incoming);
    expect(placed.list).toBeUndefined();
  });
});

describe('resolution out of a world (Save to Library, publish)', () => {
  it('stores embedded pictures with their entry names and no ids', async () => {
    const list = await portraitList();
    const copy = wren({ images: [{ mediaId: 'm-abc', requires: KNIGHT }] });
    const item = toLibraryItem(copy, [], [], undefined, list);
    expect(item.images).toEqual([{ data: ABC_PNG, name: 'Portrait', requires: KNIGHT }]);
    expect(JSON.stringify(item)).not.toContain('mediaId');
    // Publishing reads the library item, so the listing carries the file.
    expect(JSON.stringify((await entityPublishPayload(item)).contentData)).not.toContain('mediaId');
    expect((await entityPublishPayload(item)).thumbnail).toBe(ABC_PNG);
  });

  it('leaves an embedded world copy as it was', async () => {
    const copy = wren({ images: [{ data: ABC_PNG }] });
    expect(withEmbeddedMedia(copy, undefined)).toBe(copy);
    expect(toLibraryItem(copy, [], []).images).toEqual([{ data: ABC_PNG }]);
  });
});

describe('comparison across the two forms', () => {
  const source = (images: Entity['images']) => wren({ id: 'lib-1', images });
  const owned = (data: Entity): LibrarySource => ({ id: 'lib-1', name: 'Wren', revision: 'r1', owned: true, data });

  it('reads a linked copy and its embedded source with the same files as unchanged', async () => {
    const list = await portraitList();
    const copy = wren({ images: [{ mediaId: 'm-abc', requires: KNIGHT }], link: { libraryId: 'lib-1', sourceRevision: 'r1' } });
    // Same bytes, another string and no name: a byte compare reads these as different.
    const item = source([{ data: ABC_RAW, requires: KNIGHT }]);
    const media = await loadMediaLookup([copy, item], list);
    expect(contentMatchesSource(copy, item, undefined, undefined, undefined, media)).toBe(true);
    expect(diffHasChanges(diffContent(copy, item, undefined, undefined, media))).toBe(false);
    // No write-back: the copy shaped as a library item still matches.
    const plan = planWriteBack({ entities: [copy], dictionaries: [] }, [owned(item)], (c) => toLibraryItem(c, [], [], undefined, list), undefined, undefined, media);
    expect(plan).toEqual([]);
  });

  it('reads a changed file, or a changed rule, as changed', async () => {
    const list = await portraitList();
    const copy = wren({ images: [{ mediaId: 'm-abc', requires: KNIGHT }] });
    const changedFile = source([{ data: XYZ_PNG, requires: KNIGHT }]);
    const changedRule = source([{ data: ABC_RAW }]);
    const media = await loadMediaLookup([copy, changedFile, changedRule], list);
    expect(contentMatchesSource(copy, changedFile, undefined, undefined, undefined, media)).toBe(false);
    expect(contentMatchesSource(copy, changedRule, undefined, undefined, undefined, media)).toBe(false);
    expect(diffHasChanges(diffContent(copy, changedFile, undefined, undefined, media))).toBe(true);
  });

  it('keeps an imported world copy linked when its bundled listing holds the same files', async () => {
    const list = await portraitList();
    const copy = wren({ images: [{ mediaId: 'm-abc' }], link: { sourceId: 'listing-1' } });
    const held = { id: 'lib-1', name: 'Wren', revision: 'r1', sourceId: 'listing-1', data: source([{ data: ABC_RAW }]) };
    const world = { entities: [copy], dictionaries: [], worldOverview: { mediaList: list } };
    const media = await loadMediaLookup([copy, held.data], list);
    const resolved = resolveBundledLinks(world, [held], media);
    expect(resolved.entities[0].link).toMatchObject({ libraryId: 'lib-1' });
    expect(resolved.entities[0].link?.localReplacement).toBeUndefined();
  });
});

describe('library updates into a world', () => {
  const row = { worldId: 'world-1', worldName: 'Sedge', itemId: 'w1', itemName: 'Wren', kind: 'entity' as const, state: 'linked' as const };
  const source: LibrarySource = { id: 'lib-1', name: 'Wren', revision: 'r2', owned: true };

  it('adds a changed portrait to the list and relinks the copy (Check for Updates)', async () => {
    const list = await portraitList();
    let written: Entity | undefined;
    let nextList: MediaList | undefined;
    const world: LiveWorld = {
      id: 'world-1', name: 'Sedge', entities: [wren({ images: [{ mediaId: 'm-abc' }], link: { libraryId: 'lib-1', sourceRevision: 'r1' } })],
      dictionaries: [], placeholders: [], locations: [],
      getMediaList: () => list, setMediaList: (next) => { nextList = next; },
      writeItem: (item) => { written = item as Entity; }, addPlaceholder: () => {},
    };
    await applyUpdate(row, 'update', source, wren({ id: 'lib-1', images: [{ data: XYZ_PNG, name: 'Wounded' }] }), [world]);
    const id = ids(written!)[0]!;
    expect(id).not.toBe('m-abc');
    expect(nextList![id]).toMatchObject({ name: 'Wounded', data: XYZ_PNG });
    // The old entry stays: an entry nothing links is kept (Q7).
    expect(nextList!['m-abc']).toBeDefined();
  });

  it('places a replacement picked for a missing source (Replace Source)', async () => {
    const list = await portraitList();
    const world = {
      entities: [wren({ images: [{ mediaId: 'm-abc' }], link: { sourceId: 'gone' } })], dictionaries: [], worldOverview: { mediaList: list },
    };
    const data = wren({ id: 'lib-1', images: [{ data: ABC_RAW }, { data: QRS_PNG }] });
    const next = applyRepair(world, 'w1', 'replace', { source, data }, await loadMediaHashes([data], list));
    const [first, second] = ids(next.entities[0]);
    expect(first).toBe('m-abc');
    expect(next.worldOverview?.mediaList?.[second!]).toMatchObject({ name: 'Wren 1', data: QRS_PNG });
  });
});

describe('character cards', () => {
  it('exports an id-form entity with its pictures and names, and reads them back', async () => {
    const list = listOf(entry('m-abc', 'Portrait', ABC_PNG), entry('m-xyz', 'Wounded', XYZ_PNG));
    const card = buildEntityCardData(wren({ images: [{ mediaId: 'm-abc' }, { mediaId: 'm-xyz', requires: KNIGHT }] }), [], {}, undefined, undefined, list);
    expect(card.primaryImageName).toBe('Portrait');
    expect(card.extraImages).toEqual([{ data: XYZ_PNG, name: 'Wounded', requires: KNIGHT }]);
    const parsed = parseEntityCardData(JSON.parse(JSON.stringify(card)), ABC_PNG);
    expect(parsed.images).toEqual([{ data: ABC_PNG, name: 'Portrait' }, { data: XYZ_PNG, name: 'Wounded', requires: KNIGHT }]);
  });
});

describe('entity sounds across the boundary', () => {
  const GROWL = 'data:audio/ogg;base64,R1JPV0w=';
  const GROWL_RAW = 'data:application/octet-stream;base64,R1JPV0w=';
  const HISS = 'data:audio/ogg;base64,SElTUw==';
  const soundEntry = async (): Promise<MediaList> => {
    const hashes = await loadMediaHashes([{ sound: { data: GROWL, type: 'audio/ogg' } }], undefined);
    return listOf({ id: 'm-growl', name: 'Growl', kind: 'sound', data: GROWL, type: 'audio/ogg', hash: hashes.get(GROWL) });
  };
  const soundId = (entity: Entity) => (entity.sound && 'mediaId' in entity.sound ? entity.sound.mediaId : undefined);

  it('keeps the sound and its name through Save to Library and Add from Library', async () => {
    const list = await soundEntry();
    const item = toLibraryItem(wren({ sound: { mediaId: 'm-growl' } }), [], [], undefined, list);
    expect(item.sound).toEqual({ data: GROWL, type: 'audio/ogg', name: 'Growl' });
    expect(JSON.stringify(item)).not.toContain('mediaId');

    // Into another world: a new entry under the carried name, linked by id.
    const other = listOf(entry('m-abc', 'Portrait', ABC_PNG));
    const placed = placeEntityMedia(item as Entity, other, await loadMediaHashes([item as Entity], other));
    const id = soundId(placed.entity)!;
    expect(placed.list![id]).toMatchObject({ name: 'Growl', kind: 'sound', data: GROWL, type: 'audio/ogg' });
  });

  it('reuses the sound entry holding the same bytes, and drops only a media extension from a file name (Q43)', async () => {
    const list = await soundEntry();
    const same = wren({ sound: { data: GROWL_RAW, type: 'audio/ogg', name: 'growl.ogg' } });
    expect(soundId(placeEntityMedia(same, list, await loadMediaHashes([same], list)).entity)).toBe('m-growl');
    const fresh = wren({ sound: { data: HISS, type: 'audio/ogg', name: 'hiss.mp3' } });
    const placed = placeEntityMedia(fresh, list, await loadMediaHashes([fresh], list));
    expect(placed.list![soundId(placed.entity)!].name).toBe('hiss');
  });

  it('drops a sound whose entry is gone on the way out', async () => {
    const resolved = withEmbeddedMedia(wren({ sound: { mediaId: 'gone' } }), {});
    expect(resolved.sound).toBeUndefined();
  });

  it('compares a linked sound and its embedded source by content, so only a changed file reads changed', async () => {
    const list = await soundEntry();
    const copy = wren({ sound: { mediaId: 'm-growl' } });
    const sameFile = wren({ id: 'lib-1', sound: { data: GROWL_RAW, type: 'audio/ogg', name: 'growl.ogg' } });
    const changed = wren({ id: 'lib-1', sound: { data: HISS, type: 'audio/ogg' } });
    const media = await loadMediaLookup([copy, sameFile, changed], list);
    expect(contentMatchesSource(copy, sameFile, undefined, undefined, undefined, media)).toBe(true);
    expect(diffHasChanges(diffContent(copy, sameFile, undefined, undefined, media))).toBe(false);
    expect(contentMatchesSource(copy, changed, undefined, undefined, undefined, media)).toBe(false);
    expect(diffHasChanges(diffContent(copy, changed, undefined, undefined, media))).toBe(true);
  });

  it('adds a changed sound to the list on Check for Updates', async () => {
    const list = await soundEntry();
    let written: Entity | undefined;
    let nextList: MediaList | undefined;
    const row = { worldId: 'world-1', worldName: 'Sedge', itemId: 'w1', itemName: 'Wren', kind: 'entity' as const, state: 'linked' as const };
    const world: LiveWorld = {
      id: 'world-1', name: 'Sedge', entities: [wren({ sound: { mediaId: 'm-growl' }, link: { libraryId: 'lib-1', sourceRevision: 'r1' } })],
      dictionaries: [], placeholders: [], locations: [],
      getMediaList: () => list, setMediaList: (next) => { nextList = next; },
      writeItem: (item) => { written = item as Entity; }, addPlaceholder: () => {},
    };
    await applyUpdate(row, 'update', { id: 'lib-1', name: 'Wren', revision: 'r2', owned: true }, wren({ id: 'lib-1', sound: { data: HISS, type: 'audio/ogg', name: 'Hiss' } }), [world]);
    const id = soundId(written!)!;
    expect(nextList![id]).toMatchObject({ name: 'Hiss', kind: 'sound', data: HISS });
  });
});
