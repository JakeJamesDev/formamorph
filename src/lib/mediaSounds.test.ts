import { describe, it, expect } from 'vitest';
import type { MediaList, MediaRef, World } from '@/types';
import { migrateWorld } from './version';
import { migrateSoundsToMediaList, resolveSound } from './mediaSounds';
import { mediaNameFromAsset } from './mediaList';

// "ABC" under two MIME labels: one file's bytes, two strings.
const ABC_OGG = 'data:audio/ogg;base64,QUJD';
const ABC_RAW = 'data:application/octet-stream;base64,QUJD';
const XYZ_MP3 = 'data:audio/mpeg;base64,WFla';
const WIND = 'https://host/sounds/wind.ogg';

const raw = () => ({
  worldOverview: { name: 'W', bgm: XYZ_MP3 },
  entities: [
    { id: 'wren', name: 'Wren', sound: { data: ABC_OGG, type: 'audio/ogg', name: 'growl.ogg' } },
    { id: 'kit', name: 'Kit', sound: { data: XYZ_MP3, type: 'audio/mpeg' } },
    { id: 'bare', name: 'Bare' },
  ],
  locations: [
    { id: 'yard', name: 'Yard', ambientSound: { data: ABC_RAW, type: 'audio/ogg', name: 'v1.5 rain' } },
    { id: 'gate', name: 'Gate', ambientSound: { data: ABC_OGG, type: 'audio/ogg', name: 'rain.ogg' } },
    { id: 'moor', name: 'Moor', ambientSound: { data: WIND, type: 'audio/ogg' } },
    { id: 'quiet', name: 'Quiet', ambientSound: null },
  ],
});

const load = (): World => migrateWorld(raw());
const listOf = (w: World): MediaList => w.worldOverview.mediaList ?? {};
const idOf = (value: unknown) => (value as MediaRef).mediaId;
const entity = (w: World, id: string) => w.entities.find((e) => e.id === id)!;
const location = (w: World, id: string) => w.locations.find((l) => l.id === id)!;

describe('migrateSoundsToMediaList', () => {
  it('links every entity sound, ambience and the world music, and each plays the same file', () => {
    const w = load();
    const list = listOf(w);
    expect(resolveSound(entity(w, 'wren').sound, list)).toMatchObject({ data: ABC_OGG, type: 'audio/ogg' });
    expect(resolveSound(entity(w, 'kit').sound, list)?.data).toBe(XYZ_MP3);
    expect(resolveSound(location(w, 'moor').ambientSound, list)?.data).toBe(WIND);
    expect(resolveSound(w.worldOverview.bgm, list)?.data).toBe(XYZ_MP3);
    for (const value of [entity(w, 'wren').sound, location(w, 'yard').ambientSound, w.worldOverview.bgm]) {
      expect(value).toEqual({ mediaId: expect.any(String) });
    }
    expect(entity(w, 'bare').sound).toBeUndefined();
    expect(location(w, 'quiet').ambientSound).toBeNull();
  });

  it('links two locations with the same ambience to one entry, whatever their MIME label (Q14)', () => {
    const w = load();
    expect(idOf(location(w, 'gate').ambientSound)).toBe(idOf(location(w, 'yard').ambientSound));
    // Wren's growl is the same bytes, so it shares the entry too.
    expect(idOf(entity(w, 'wren').sound)).toBe(idOf(location(w, 'yard').ambientSound));
    expect(idOf(w.worldOverview.bgm)).toBe(idOf(entity(w, 'kit').sound));
    expect(Object.values(listOf(w)).filter((e) => e.kind === 'sound')).toHaveLength(3);
  });

  it('names entries from the stored file name, dropping only a media extension (Q43), else the subject', () => {
    const w = migrateWorld({
      worldOverview: { name: 'Ashfall', bgm: 'data:audio/ogg;base64,TVVT' },
      entities: [
        { id: 'a', name: 'Wren', sound: { data: 'data:audio/ogg;base64,QQ==', type: 'audio/ogg', name: 'growl.mp3' } },
        { id: 'b', name: 'Kit', sound: { data: 'data:audio/ogg;base64,Qg==', type: 'audio/ogg', name: 'v1.5 sketch' } },
        { id: 'c', name: 'Bram', sound: { data: 'data:audio/ogg;base64,Qw==', type: 'audio/ogg' } },
      ],
      locations: [],
    });
    const nameOf = (value: unknown) => listOf(w)[idOf(value)].name;
    expect(nameOf(w.entities[0].sound)).toBe('growl');
    expect(nameOf(w.entities[1].sound)).toBe('v1.5 sketch');
    expect(nameOf(w.entities[2].sound)).toBe('Bram 1');
    // World music's subject is a fixed word, never the world's name.
    expect(nameOf(w.worldOverview.bgm)).toBe('Music 1');
  });

  it('keeps the placed file\'s MIME type on the entry (Q24)', () => {
    const w = load();
    expect(listOf(w)[idOf(location(w, 'yard').ambientSound)].type).toBe('audio/ogg');
  });

  it('is idempotent and deterministic', () => {
    // A new world's default dictionary takes a random id, so only the media fields compare.
    const media = (w: World) => ({ list: listOf(w), bgm: w.worldOverview.bgm, entities: w.entities, locations: w.locations });
    const once = load();
    const twice = migrateWorld(structuredClone(once) as unknown as Record<string, unknown>);
    expect(media(twice)).toEqual(media(once));
    expect(media(load())).toEqual(media(once));
  });

  it('passes a world already in list form through unchanged', () => {
    const world = structuredClone(load()) as unknown as Record<string, unknown>;
    const before = structuredClone(world);
    migrateSoundsToMediaList(world);
    expect(world).toEqual(before);
  });
});

describe('mediaNameFromAsset', () => {
  it('drops a media extension and keeps any other dot', () => {
    expect(mediaNameFromAsset('growl.MP3')).toBe('growl');
    expect(mediaNameFromAsset('portrait.webp')).toBe('portrait');
    expect(mediaNameFromAsset('v1.5 sketch')).toBe('v1.5 sketch');
    expect(mediaNameFromAsset('notes.txt')).toBe('notes.txt');
    expect(mediaNameFromAsset(undefined)).toBe('');
  });
});

describe('resolveSound', () => {
  it('reads an id the list lacks, or one that names an image, as no sound', () => {
    const list: MediaList = { pic: { id: 'pic', name: 'Pic', kind: 'image', data: 'data:image/png;base64,QQ==' } };
    expect(resolveSound({ mediaId: 'gone' }, list)).toBeUndefined();
    expect(resolveSound({ mediaId: 'pic' }, list)).toBeUndefined();
    expect(resolveSound({ data: ABC_OGG, type: 'audio/ogg' }, undefined)?.data).toBe(ABC_OGG);
  });
});
