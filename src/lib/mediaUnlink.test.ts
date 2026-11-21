import { describe, expect, it } from 'vitest';
import type { Body, Entity, GameLocation, Item, MediaList, WorldOverview } from '@/types';
import {
  bodyWithoutMedia, entityWithoutMedia, itemWithoutMedia, locationWithoutMedia, overviewWithoutMedia, renameMediaEntry,
} from './mediaUnlink';
import { urlFileName } from './mediaList';
import { mediaUseLabel } from './mediaUsage';

const LIST: MediaList = {
  gone: { id: 'gone', name: 'Wren 1', kind: 'image', data: 'data:image/png;base64,AA' },
  kept: { id: 'kept', name: 'Knight', kind: 'image', data: 'data:image/png;base64,BB' },
};

const overview = (patch: Partial<WorldOverview> = {}): WorldOverview => ({
  name: 'W', description: '', author: '', systemPrompt: '', tags: [], thumbnail: null, bgm: null, mediaList: LIST, ...patch,
});

describe('Delete from World, record by record', () => {
  it('drops every gallery link to the entry and an entity sound that links it, keeping the rest in order', () => {
    const wren = {
      id: 'wren', name: 'Wren',
      images: [{ mediaId: 'gone' }, { mediaId: 'kept', requires: [] }, { mediaId: 'gone', requires: [] }, { data: 'data:x' }],
      sound: { mediaId: 'gone' },
    } as unknown as Entity;
    const next = entityWithoutMedia(wren, 'gone');
    expect(next.images).toEqual([{ mediaId: 'kept', requires: [] }, { data: 'data:x' }]);
    expect('sound' in next).toBe(false);
  });

  it('returns a record that never linked the entry unchanged, so history records no edit', () => {
    const wren = { id: 'wren', name: 'Wren', images: [{ mediaId: 'kept' }] } as Entity;
    expect(entityWithoutMedia(wren, 'gone')).toBe(wren);
    const room = { id: 'r', name: 'Room', images: [{ mediaId: 'kept' }] } as GameLocation;
    expect(locationWithoutMedia(room, 'gone')).toBe(room);
  });

  it('clears a location gallery link and its ambient sound, and an item gallery link', () => {
    const room = { id: 'r', name: 'Room', images: [{ mediaId: 'gone' }], ambientSound: { mediaId: 'gone' } } as unknown as GameLocation;
    expect(locationWithoutMedia(room, 'gone')).toEqual({ id: 'r', name: 'Room', images: [] });
    const lamp = { id: 'i', name: 'Lamp', images: [{ mediaId: 'gone' }, { mediaId: 'kept' }] } as unknown as Item;
    expect(itemWithoutMedia(lamp, 'gone').images).toEqual([{ mediaId: 'kept' }]);
  });

  it('turns a Body whose Custom Image links the entry back to the Humanoid outline', () => {
    const body = { id: 'b', name: 'B', aspect: 1, backdrop: { kind: 'image', image: { mediaId: 'gone' } } } as unknown as Body;
    expect(bodyWithoutMedia(body, 'gone').backdrop).toEqual({ kind: 'humanoid' });
  });

  it('removes the entry, clears the cover and music links, and drops the map field with its last image', () => {
    const next = overviewWithoutMedia(overview({
      thumbnail: { mediaId: 'gone' } as unknown as string,
      bgm: { mediaId: 'gone' } as unknown as string,
      mapBackground: { images: [{ mediaId: 'gone' }], frame: { x: 0, y: 0, width: 1, height: 1 }, opacity: 1 },
    }), 'gone');
    expect(next.mediaList).toEqual({ kept: LIST.kept });
    expect(next.thumbnail).toBeNull();
    expect(next.bgm).toBeNull();
    expect('mapBackground' in next).toBe(false);
  });

  it('drops the entry from every Layer that holds it as a Variant, keeping the emptied Layer (Q28)', () => {
    const rig: MediaList[string] = {
      id: 'rig', name: 'Rig', kind: 'layered', layers: [
        { id: 'a', name: 'A', variants: [{ mediaId: 'gone' }] },
        { id: 'b', name: 'B', variants: [{ mediaId: 'kept' }, { mediaId: 'gone' }] },
      ],
    };
    const next = overviewWithoutMedia(overview({ mediaList: { ...LIST, rig } }), 'gone');
    expect(next.mediaList?.rig).toEqual({ ...rig, layers: [{ id: 'a', name: 'A', variants: [] }, { id: 'b', name: 'B', variants: [{ mediaId: 'kept' }] }] });
    expect(next.mediaList?.gone).toBeUndefined();
  });

  it('keeps the map field while it still holds another image', () => {
    const next = overviewWithoutMedia(overview({
      mapBackground: { images: [{ mediaId: 'gone' }, { mediaId: 'kept' }], frame: { x: 0, y: 0, width: 1, height: 1 }, opacity: 1 },
    }), 'gone');
    expect(next.mapBackground?.images).toEqual([{ mediaId: 'kept' }]);
  });
});

describe('renameMediaEntry', () => {
  it('suffixes a name another entry holds, compared trimmed and case-insensitive (Q5)', () => {
    expect(renameMediaEntry(LIST, 'gone', ' knight ')?.gone.name).toBe('knight (2)');
  });

  it('keeps the entry as it is for a blank name or a missing id', () => {
    expect(renameMediaEntry(LIST, 'gone', '  ')).toBe(LIST);
    expect(renameMediaEntry(LIST, 'nope', 'Fen')).toBe(LIST);
  });

  it('lets an entry keep its own name', () => {
    expect(renameMediaEntry(LIST, 'kept', 'Knight')).toBe(LIST);
  });
});

describe('urlFileName', () => {
  it('reads a link’s last path segment, decoded, and nothing for a bare host or a non-URL', () => {
    expect(urlFileName('https://example.com/art/knight%20portrait.png?w=2')).toBe('knight portrait.png');
    expect(urlFileName('https://example.com/')).toBe('');
    expect(urlFileName('not a url')).toBe('');
  });
});

describe('mediaUseLabel', () => {
  it('names a gallery position and a single field', () => {
    expect(mediaUseLabel({ owner: { kind: 'entity', id: 'w', name: 'Wren' }, field: 'images', index: 1 })).toBe('Wren, Image 2');
    expect(mediaUseLabel({ owner: { kind: 'world', id: 'world', name: 'World' }, field: 'thumbnail' })).toBe('World, Cover');
  });
});
