import { describe, expect, it } from 'vitest';
import type { GameLocation, MediaList, WorldOverview } from '@/types';
import { galleryLinks } from './entityImages';
import { editGallery, galleryView, migrateGalleriesToMediaList, placeGalleryFile } from './mediaGallery';
import { mediaEntryItems } from './mediaEntries';
import { groupSections, mediaSections, MASKS_SECTION_ID, type MediaWorld } from './mediaIndex';
import { writeGalleryImage } from './mediaParents';
import { locationWithoutMedia, overviewWithoutMedia } from './mediaUnlink';
import { mediaUsage, mediaUseLabel } from './mediaUsage';
import { sandboxMediaOf } from './sandboxMedia';
import { maskUseCount, newMaskEntry, withSlotMask } from './weatherMask';

const DAY = 'data:image/png;base64,REFZ';
const NIGHT = 'data:image/png;base64,TklHSFQ=';
const WINDOW = 'data:image/png;base64,V0lORE9X';

const LIST: MediaList = {
  day: { id: 'day', name: 'Dock Day', kind: 'image', data: DAY },
  night: { id: 'night', name: 'Dock Night', kind: 'image', data: NIGHT },
  win: { id: 'win', name: 'Dock Window', kind: 'mask', data: WINDOW },
};

const overview = (mediaList: MediaList = LIST): WorldOverview => ({
  name: 'W', description: '', author: '', systemPrompt: '', tags: [], thumbnail: null, bgm: null, mediaList,
});

const dock: GameLocation = { id: 'dock', name: 'Dock', images: [{ mediaId: 'day', weatherMask: 'win' }, { mediaId: 'night', weatherMask: 'win' }] };
const shed: GameLocation = { id: 'shed', name: 'Shed', images: [{ mediaId: 'day' }] };

const world = (locations: GameLocation[] = [dock, shed], mediaList: MediaList = LIST): MediaWorld =>
  ({ worldOverview: overview(mediaList), entities: [], locations, dictionaries: [] });

describe('Delete From World on a Mask', () => {
  it('unlinks every slot that links it and keeps each image', () => {
    expect(locationWithoutMedia(dock, 'win').images).toEqual([{ mediaId: 'day' }, { mediaId: 'night' }]);
    expect(overviewWithoutMedia(overview(), 'win').mediaList?.win).toBeUndefined();
  });

  it('leaves a location that never linked it unchanged', () => {
    expect(locationWithoutMedia(shed, 'win')).toBe(shed);
  });

  it('keeps the Mask when the image it covers is deleted', () => {
    expect(locationWithoutMedia(dock, 'day').images).toEqual([{ mediaId: 'night', weatherMask: 'win' }]);
  });
});

describe('the "kept by" index', () => {
  it('lists each location image slot that links a Mask', () => {
    const uses = mediaUsage(world()).get('win') ?? [];
    expect(uses.map((use) => mediaUseLabel(use))).toEqual(['Dock, Image 1 Weather Mask', 'Dock, Image 2 Weather Mask']);
  });

  it('gives each Mask one Media tab card with its size and uses', () => {
    const card = mediaEntryItems(world()).find((item) => item.mediaId === 'win')!;
    expect(card).toMatchObject({ kind: 'mask', slot: 'Dock Window', bytes: WINDOW.length });
    expect(card.uses?.map((use) => use.owner.name)).toEqual(['Dock', 'Dock']);
    expect(card.unused).toBeUndefined();
  });

  it('marks a Mask nothing links as Unused', () => {
    const card = mediaEntryItems(world([shed])).find((item) => item.mediaId === 'win')!;
    expect(card.unused).toBe(true);
  });

  it('shows Masks in their own section, by parent and by type', () => {
    const w = world();
    const entries = mediaEntryItems(w);
    const byParent = groupSections(mediaSections(w), 'parent', entries);
    expect(byParent.find((s) => s.id === MASKS_SECTION_ID)?.items.map((i) => i.mediaId)).toEqual(['win']);
    const byType = groupSections(mediaSections(w), 'type', entries);
    expect(byType.find((s) => s.id === 'type:mask')?.items.map((i) => i.mediaId)).toEqual(['win']);
    // A Mask is never counted as an image.
    expect(byType.find((s) => s.id === 'type:image')?.items.some((i) => i.mediaId === 'win')).toBe(false);
  });
});

describe('the gallery bridge', () => {
  const links = dock.images!;

  it('carries each slot Mask into the widget pictures', () => {
    expect(galleryView(links, LIST).images.map((image) => image.weatherMask)).toEqual(['win', 'win']);
  });

  it('moves a Mask with its image on reorder', () => {
    const w: GameLocation['images'] = [{ mediaId: 'day', weatherMask: 'win' }, { mediaId: 'night' }];
    const pictures = galleryView(w, LIST).images;
    expect(editGallery(w, LIST, [pictures[1], pictures[0]], 'Dock').links).toEqual([{ mediaId: 'night' }, { mediaId: 'day', weatherMask: 'win' }]);
  });

  it('keeps the slot Mask when the slot image is replaced, and drops it with a removed slot', () => {
    const pictures = galleryView(links, LIST).images;
    const NEW = 'data:image/png;base64,TkVX';
    const replaced = editGallery(links, LIST, writeGalleryImage(pictures, 0, { data: NEW, name: 'Redraw.png' }), 'Dock');
    expect(replaced.links[0]).toMatchObject({ weatherMask: 'win' });
    expect(replaced.links[0]).not.toMatchObject({ mediaId: 'day' });
    const removed = editGallery(links, LIST, writeGalleryImage(pictures, 0, null), 'Dock');
    expect(removed.links).toEqual([{ mediaId: 'night', weatherMask: 'win' }]);
  });

  it('keeps a Mask link through the load-time move into the Media List', () => {
    const raw: Record<string, unknown> = {
      worldOverview: overview(), locations: [{ id: 'dock', name: 'Dock', images: [{ data: DAY, weatherMask: 'win' }] }],
    };
    migrateGalleriesToMediaList(raw);
    const [moved] = raw.locations as GameLocation[];
    expect(moved.images).toEqual([{ mediaId: 'day', weatherMask: 'win' }]);
    expect(galleryLinks(moved)).toEqual([{ mediaId: 'day', weatherMask: 'win' }]);
  });

  it('never places an image into a Mask with the same bytes', () => {
    const placed = placeGalleryFile(LIST, { data: WINDOW }, 'image', 'Dock');
    expect(placed.id).not.toBe('win');
    expect(placed.list[placed.id].kind).toBe('image');
  });
});

describe('slot helpers', () => {
  it('counts the slots linking a Mask across locations', () => {
    const shedMasked = { ...shed, images: [{ mediaId: 'day', weatherMask: 'win' }] };
    expect(maskUseCount([dock, shedMasked], 'win')).toBe(3);
    expect(maskUseCount([shed], 'win')).toBe(0);
  });

  it('links and unlinks one slot only', () => {
    const pictures = [{ data: DAY }, { data: NIGHT, weatherMask: 'win' }];
    expect(withSlotMask(pictures, 0, 'win')).toEqual([{ data: DAY, weatherMask: 'win' }, pictures[1]]);
    expect(withSlotMask(pictures, 1, undefined)).toEqual([pictures[0], { data: NIGHT }]);
  });

  it('names a new Mask for its file, else for its location, unique in the list', () => {
    expect(newMaskEntry(LIST, WINDOW, 'Dock Window.png', 'Dock')).toMatchObject({ name: 'Dock Window (2)', kind: 'mask', type: 'image/png' });
    expect(newMaskEntry(LIST, WINDOW, undefined, 'Dock').name).toBe('Dock Mask 1');
  });
});

describe('script media reads', () => {
  it('never name a Mask', () => {
    const media = sandboxMediaOf({
      list: LIST, overrides: undefined, entities: [], locations: [dock], items: [], itemInstances: [], music: null,
      gate: () => { throw new Error('unread'); },
    });
    expect(media.entries.map((entry) => entry.id)).toEqual(['day', 'night']);
  });
});
