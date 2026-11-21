import { describe, it, expect } from 'vitest';
import type { MediaFileEntry, MediaList, TraitRequirementRow } from '@/types';
import {
  embedGallery, fallbackMediaName, mediaEntry, mediaHashes, mediaNameFromFile, mediaToken, newMediaName, placeMedia,
  resolveMedia, uniqueMediaName, unhashedData,
} from './mediaList';
import { entityImages, migrateEntityImages, primaryPicture, withImageRules } from './entityImages';
import { locationImages } from './locationImages';
import { mapImages } from './mapBackground';

const KNIGHT: TraitRequirementRow[] = [{ all: [{ kind: 'trait', id: 'knight' }] }];
// "ABC" twice under different MIME labels: one file's bytes, two different strings.
const ABC_PNG = 'data:image/png;base64,QUJD';
const ABC_RAW = 'data:application/octet-stream;base64,QUJD';
const XYZ_PNG = 'data:image/png;base64,WFla';
const OGG = 'data:audio/ogg;base64,T2dnUw==';
const URL = 'https://host/wren.png';

const entry = (id: string, name: string, data: string, extra: Partial<MediaFileEntry> = {}): MediaFileEntry =>
  ({ id, name, kind: 'image', data, ...extra });
const listOf = (...entries: MediaFileEntry[]): MediaList => Object.fromEntries(entries.map((e) => [e.id, e]));

describe('names', () => {
  it('drops the extension (Q9)', () => {
    expect(mediaNameFromFile('knight portrait.png')).toBe('knight portrait');
    expect(mediaNameFromFile('archive.tar.gz')).toBe('archive.tar');
    expect(mediaNameFromFile(undefined)).toBe('');
  });

  it('suffixes a taken name, compared trimmed and case-insensitive (Q5)', () => {
    const list = listOf(entry('a', 'Knight', ABC_PNG), entry('b', 'knight (2)', XYZ_PNG));
    expect(uniqueMediaName('  KNIGHT ', list)).toBe('KNIGHT (3)');
    expect(uniqueMediaName('Squire', list)).toBe('Squire');
    expect(uniqueMediaName('Knight', list, 'a')).toBe('Knight');
  });

  it('names nameless media after the subject plus the next free number, from 1 (Q10)', () => {
    expect(fallbackMediaName('Wren', 'image', undefined)).toBe('Wren 1');
    expect(fallbackMediaName('Wren', 'image', listOf(entry('a', 'wren 1', ABC_PNG)))).toBe('Wren 2');
    expect(fallbackMediaName(' ', 'sound', undefined)).toBe('Sound 1');
  });

  it('starts a new entry on the file name, else the fallback', () => {
    expect(newMediaName('wren.png', 'Wren', 'image', undefined)).toBe('wren');
    expect(newMediaName(undefined, 'Wren', 'image', undefined)).toBe('Wren 1');
    expect(newMediaName('.png', 'Wren', 'image', undefined)).toBe('Wren 1');
  });
});

describe('resolveMedia', () => {
  const list = listOf(entry('img', 'Wren', ABC_PNG), { id: 'snd', name: 'Rain', kind: 'sound', data: OGG, type: 'audio/ogg' });

  it("returns an id's entry with its name", () => {
    expect(resolveMedia({ mediaId: 'snd' }, list)).toEqual({ data: OGG, type: 'audio/ogg', name: 'Rain' });
    expect(resolveMedia({ mediaId: 'img' }, list)?.data).toBe(ABC_PNG);
  });

  it('returns embedded data itself', () => {
    expect(resolveMedia(XYZ_PNG, list)).toEqual({ data: XYZ_PNG, type: 'image/png' });
    expect(resolveMedia({ data: OGG, type: 'audio/ogg', name: 'r.ogg' }, list)).toEqual({ data: OGG, type: 'audio/ogg', name: 'r.ogg' });
  });

  it('returns nothing for a missing id, or an entry of another kind', () => {
    expect(resolveMedia({ mediaId: 'gone' }, list)).toBeUndefined();
    expect(resolveMedia({ mediaId: 'snd' }, list, 'image')).toBeUndefined();
    expect(resolveMedia({ mediaId: 'img' }, undefined)).toBeUndefined();
  });
});

describe('gallery helpers through the resolver', () => {
  const list = listOf(entry('m1', 'Wren', ABC_PNG));
  const wren = { images: [{ mediaId: 'm1', requires: KNIGHT }, { data: XYZ_PNG }, { mediaId: 'gone' }] };

  it('resolve links, keep rules, and drop a missing id like a blank', () => {
    expect(entityImages(wren, list)).toEqual([{ data: ABC_PNG, name: 'Wren', requires: KNIGHT }, { data: XYZ_PNG }]);
    expect(primaryPicture(wren, list)).toBe(ABC_PNG);
    expect(locationImages(wren, list).map((img) => img.data)).toEqual([ABC_PNG, XYZ_PNG]);
  });

  it('read a link as nothing without a list', () => {
    expect(entityImages(wren)).toEqual([{ data: XYZ_PNG }]);
  });

  it('read the map through the overview\'s own list', () => {
    const overview = { mediaList: list, mapBackground: { images: [{ mediaId: 'm1' }], frame: { x: 0, y: 0, width: 1, height: 1 }, opacity: 1 } };
    expect(mapImages(overview).map((img) => img.data)).toEqual([ABC_PNG]);
  });

  it('keep links when a load migration normalizes the gallery', () => {
    const legacy = { images: ['', { mediaId: 'm1', requires: [] }, { data: XYZ_PNG, name: 'Wren 2' }] };
    expect(migrateEntityImages(legacy).images).toEqual([{ mediaId: 'm1' }, { data: XYZ_PNG, name: 'Wren 2' }]);
    const canonical = { images: [{ mediaId: 'm1' }] };
    expect(migrateEntityImages(canonical)).toBe(canonical);
  });

  it('keep links when a rule pass maps their Conditions', () => {
    const renamed = withImageRules({ images: [{ mediaId: 'm1', requires: KNIGHT }] }, (req) => (req.kind === 'trait' ? { ...req, id: 'squire' } : req));
    expect(renamed.images).toEqual([{ mediaId: 'm1', requires: [{ all: [{ kind: 'trait', id: 'squire' }] }] }]);
  });
});

describe('placeMedia', () => {
  it('reuses the entry holding the same bytes: placing a file twice adds one entry (Q14)', async () => {
    const hashes = await mediaHashes([ABC_PNG, ABC_RAW]);
    const first = placeMedia(undefined, { data: ABC_PNG, name: 'wren.png', type: 'image/png' }, { kind: 'image', hashes });
    const again = placeMedia(first.list, { data: ABC_RAW, name: 'other.png' }, { kind: 'image', hashes });
    expect(again.id).toBe(first.id);
    expect(again.list).toBe(first.list);
    expect(Object.values(again.list)).toEqual([{ id: first.id, name: 'wren', kind: 'image', data: ABC_PNG, type: 'image/png', hash: hashes.get(ABC_PNG) }]);
  });

  it('adds `name (2)` for different bytes under a taken name', async () => {
    const hashes = await mediaHashes([ABC_PNG, XYZ_PNG]);
    const first = placeMedia(undefined, { data: ABC_PNG, name: 'portrait.png' }, { kind: 'image', hashes });
    const second = placeMedia(first.list, { data: XYZ_PNG, name: 'Portrait.webp' }, { kind: 'image', hashes });
    expect(second.id).not.toBe(first.id);
    expect(second.list[second.id].name).toBe('Portrait (2)');
  });

  it('names a nameless file after its subject', async () => {
    const hashes = await mediaHashes([ABC_PNG]);
    const { list, id } = placeMedia(undefined, { data: ABC_PNG }, { kind: 'image', subject: 'Wren', hashes });
    expect(list[id].name).toBe('Wren 1');
  });

  it('reuses a link by its exact URL and stores no hash for it', () => {
    const first = placeMedia(undefined, { data: URL }, { kind: 'image', subject: 'Wren', hashes: new Map() });
    expect(placeMedia(first.list, { data: URL }, { kind: 'image', hashes: new Map() }).id).toBe(first.id);
    expect(mediaEntry(first.list, first.id)?.hash).toBeUndefined();
  });

  it('refuses embedded data it has no hash for, rather than add a duplicate', () => {
    expect(() => placeMedia(undefined, { data: ABC_PNG }, { kind: 'image', hashes: new Map() })).toThrow(/no hash/);
  });

  it('never reuses an entry of the other kind', async () => {
    const hashes = await mediaHashes([ABC_PNG]);
    const image = placeMedia(undefined, { data: ABC_PNG }, { kind: 'image', subject: 'Wren', hashes });
    const sound = placeMedia(image.list, { data: ABC_PNG }, { kind: 'sound', subject: 'Wren', hashes });
    expect(sound.id).not.toBe(image.id);
  });
});

describe('embedGallery', () => {
  it('gives back each embedded file with its entry name and rule (Q18)', () => {
    const list = listOf(entry('m1', 'Wren', ABC_PNG));
    expect(embedGallery([{ mediaId: 'm1', requires: KNIGHT }, { data: XYZ_PNG }, { mediaId: 'gone' }], list))
      .toEqual([{ data: ABC_PNG, name: 'Wren', requires: KNIGHT }, { data: XYZ_PNG }]);
  });
});

describe('mediaToken', () => {
  it('reads an embedded file and an id holding the same bytes as equal, different bytes as different', async () => {
    // The entry's string differs from the embedded one; only a byte compare sees them as one file.
    const list = listOf(entry('m1', 'Wren', ABC_RAW), entry('m2', 'Other', XYZ_PNG));
    const hashes = await mediaHashes(unhashedData([ABC_PNG], list));
    expect(mediaToken(ABC_PNG, list, hashes)).toBe(mediaToken({ mediaId: 'm1' }, list, hashes));
    expect(mediaToken({ data: ABC_PNG }, list, hashes)).toBe(mediaToken({ mediaId: 'm1' }, list, hashes));
    expect(mediaToken(ABC_PNG, list, hashes)).not.toBe(mediaToken({ mediaId: 'm2' }, list, hashes));
  });

  it("uses an entry's stored hash", () => {
    const list = listOf(entry('m1', 'Wren', ABC_RAW, { hash: 'h1' }));
    expect(mediaToken({ mediaId: 'm1' }, list, new Map())).toBe('media:h1');
  });

  it('compares a link by URL, and a missing id as nothing', () => {
    const list = listOf(entry('m1', 'Wren', URL));
    expect(mediaToken(URL, list, new Map())).toBe(mediaToken({ mediaId: 'm1' }, list, new Map()));
    expect(mediaToken({ mediaId: 'gone' }, list, new Map())).toBeUndefined();
  });
});
