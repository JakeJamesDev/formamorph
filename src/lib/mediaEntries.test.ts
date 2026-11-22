import { describe, expect, it } from 'vitest';
import type { World } from '@/types';
import { mediaEntryItems, mediaSearchText, searchSections } from './mediaEntries';
import { filterSections, groupSections, mediaHolds, mediaSections, worldOptimizeTargets } from './mediaIndex';
import { IMAGE_CAPS } from './imageSlots';
import { migrateWorld } from './version';
import { blankItem } from './items';
import { fakeDataUrl, mediaFixtureWorld } from '@/test/mediaFixture';

const SKETCH = fakeDataUrl('image/webp', 300, 'u');
const RULE = [{ all: [{ kind: 'playingAs' as const, id: 'wick' }] }];

/** The fixture on the list, Bram and a lantern item sharing Odd Wick's first picture, plus one entry nothing links. */
function listWorld(): World {
  const raw = mediaFixtureWorld();
  const first = (raw.entities.find((e) => e.id === 'wick')!.images![0] as { data: string }).data;
  raw.entities.find((e) => e.id === 'bram')!.images = [{ data: first, requires: RULE }];
  raw.items = [{ ...blankItem('lantern', 'Tin Lantern'), images: [{ data: first }] }];
  const world = migrateWorld(raw);
  world.worldOverview.mediaList = { ...world.worldOverview.mediaList, sketch: { id: 'sketch', name: 'Lantern Sketch', kind: 'image', data: SKETCH } };
  return world;
}

/** `listWorld` plus a Layered Image holding the Unused Lantern Sketch in a Layer. */
function rigWorld(): World {
  const w = listWorld();
  w.worldOverview.mediaList = {
    ...w.worldOverview.mediaList,
    rig: { id: 'rig', name: 'Scout Rig', kind: 'layered', layers: [{ id: 'hat', name: 'Hat', variants: [{ mediaId: 'sketch' }] }] },
  };
  return w;
}

const sharedId = (w: World) => (w.entities.find((e) => e.id === 'wick')!.images![0] as { mediaId: string }).mediaId;

describe('mediaEntryItems', () => {
  it('gives each entry one card with every use, item pictures included, and its links\' rules', () => {
    const w = listWorld();
    const shared = mediaEntryItems(w).find((i) => i.mediaId === sharedId(w))!;

    expect(shared.uses!.map((u) => `${u.owner.name} ${u.field}`)).toEqual(['Odd Wick images', 'Bram images', 'Tin Lantern images']);
    expect(shared.rules).toEqual(RULE);
    expect(shared.unused).toBeUndefined();
    expect(shared.budget).toEqual(IMAGE_CAPS.entity);
  });

  it('marks an entry nothing links Unused, measured against the background cap', () => {
    const sketch = mediaEntryItems(listWorld()).find((i) => i.mediaId === 'sketch')!;
    expect(sketch).toMatchObject({ unused: true, uses: [], budget: IMAGE_CAPS.background, slot: 'Lantern Sketch' });
  });

  it('measures a used entry against its largest use\'s budget', () => {
    const w = listWorld();
    w.locations.find((l) => l.id === 'marsh')!.images = [{ mediaId: sharedId(w) }];
    expect(mediaEntryItems(w).find((i) => i.mediaId === sharedId(w))!.budget).toEqual(IMAGE_CAPS.background);
  });

  it('lists a Layered Image as a file-less card with its uses, and its gallery link as a layered item', () => {
    const w = listWorld();
    w.worldOverview.mediaList = { ...w.worldOverview.mediaList, rig: { id: 'rig', name: 'Scout Rig', kind: 'layered', layers: [] } };
    w.entities.find((e) => e.id === 'bram')!.images = [{ mediaId: 'rig' }];
    expect(mediaEntryItems(w).find((i) => i.mediaId === 'rig')).toMatchObject({ kind: 'layered', slot: 'Scout Rig', value: '', bytes: 0, uses: [{ owner: { name: 'Bram' } }] });
    const bram = mediaSections(w).flatMap((s) => s.items).filter((i) => i.parent.id === 'bram' && i.galleryIndex !== undefined);
    expect(bram).toEqual([expect.objectContaining({ kind: 'layered', mediaId: 'rig', value: '', bytes: 0 })]);
    expect(bram[0].budget).toBeUndefined();
  });

  it('counts a Variant use, so an image only a Layer holds is not Unused and takes the rig’s slot budget', () => {
    const w = listWorld();
    w.worldOverview.mediaList = {
      ...w.worldOverview.mediaList,
      rig: { id: 'rig', name: 'Scout Rig', kind: 'layered', layers: [{ id: 'hat', name: 'Hat', variants: [{ mediaId: 'sketch' }] }] },
    };
    w.locations.find((l) => l.id === 'marsh')!.images = [{ mediaId: 'rig' }];
    const sketch = mediaEntryItems(w).find((i) => i.mediaId === 'sketch')!;
    expect(sketch.unused).toBeUndefined();
    expect(sketch.variantUses).toEqual([{ entryId: 'rig', entryName: 'Scout Rig', layerId: 'hat', layerName: 'Hat' }]);
    expect(sketch.budget).toEqual(IMAGE_CAPS.background);
    expect(mediaSearchText(sketch)).toContain('Scout Rig · Hat');
  });

  it('searches an entry by its name and the places that use it', () => {
    const w = listWorld();
    const shared = mediaEntryItems(w).find((i) => i.mediaId === sharedId(w))!;
    expect(mediaSearchText(shared)).toContain('Tin Lantern, Image 1');
    expect(mediaSearchText(shared)).toContain(shared.slot);
  });
});

describe('groupSections with the Media List', () => {
  it('by type, lists a shared entry once at its first use, and media off the list once per use', () => {
    const w = listWorld();
    const entries = mediaEntryItems(w);
    const images = groupSections(mediaSections(w), 'type', entries).find((s) => s.id === 'type:image')!.items;

    expect(images.filter((i) => i.mediaId === sharedId(w))).toHaveLength(1);
    expect(images.filter((i) => i.parent.kind === 'dictionary')).toHaveLength(1);
    // Every image entry shows, the item-only and Unused ones included.
    expect(images.filter((i) => i.uses).length).toBe(entries.filter((e) => e.kind === 'image').length);
    expect(images.at(-1)!.mediaId).toBe('sketch');
  });

  it('by parent, keeps the sections and adds the Unused entries last', () => {
    const w = listWorld();
    const sections = groupSections(mediaSections(w), 'parent', mediaEntryItems(w));
    expect(sections.slice(0, -1)).toEqual(mediaSections(w));
    expect(sections.at(-1)).toMatchObject({ id: 'unused', path: ['Unused'], items: [expect.objectContaining({ mediaId: 'sketch' })] });
  });

  it('leaves an image only Layers use out of both groupings, and keeps the rig Unused', () => {
    const w = rigWorld();
    const parent = groupSections(mediaSections(w), 'parent', mediaEntryItems(w));
    expect(parent.map((s) => s.id)).not.toContain('layerVariants');
    expect(parent.flatMap((s) => s.items).map((i) => i.mediaId)).not.toContain('sketch');
    expect(parent.at(-1)).toMatchObject({ id: 'unused', items: [expect.objectContaining({ mediaId: 'rig' })] });
    const images = groupSections(mediaSections(w), 'type', mediaEntryItems(w)).find((s) => s.id === 'type:image')!.items;
    expect(images.map((i) => i.mediaId)).not.toContain('sketch');
  });

  it('shows a Layer image again once a field links it directly', () => {
    const w = rigWorld();
    w.locations.find((l) => l.id === 'marsh')!.images = [{ mediaId: 'sketch' }];
    const parent = groupSections(mediaSections(w), 'parent', mediaEntryItems(w)).flatMap((s) => s.items);
    expect(parent.some((i) => i.mediaId === 'sketch')).toBe(true);
    // By type the part's own entry card (the one that carries its uses) lists it.
    const images = groupSections(mediaSections(w), 'type', mediaEntryItems(w)).find((s) => s.id === 'type:image')!.items;
    expect(images.some((i) => i.mediaId === 'sketch' && i.uses?.length)).toBe(true);
  });

  it('adds no Unused section when every entry is used', () => {
    const w = migrateWorld(mediaFixtureWorld());
    expect(groupSections(mediaSections(w), 'parent', mediaEntryItems(w))).toEqual(mediaSections(w));
  });

  it('filters to the Unused entries alone', () => {
    const w = listWorld();
    for (const grouping of ['parent', 'type'] as const) {
      const shown = filterSections(groupSections(mediaSections(w), grouping, mediaEntryItems(w)), 'unused').flatMap((s) => s.items);
      expect(shown.map((i) => i.mediaId)).toEqual(['sketch']);
    }
  });
});

describe('searchSections', () => {
  const has = (term: string) => (text: string) => text.toLowerCase().includes(term);

  it('shows every Layered Image that holds a part the term matches, never the part', () => {
    const w = rigWorld();
    w.worldOverview.mediaList = {
      ...w.worldOverview.mediaList,
      rig2: { id: 'rig2', name: 'Pack Rig', kind: 'layered', layers: [{ id: 'bag', name: 'Bag', variants: [{ mediaId: 'sketch' }] }] },
    };
    w.entities.find((e) => e.id === 'bram')!.images = [{ mediaId: 'rig' }];
    const entries = mediaEntryItems(w);
    for (const grouping of ['parent', 'type'] as const) {
      const shown = searchSections(groupSections(mediaSections(w), grouping, entries), entries, has('lantern sketch')).flatMap((s) => s.items);
      expect(shown.map((i) => i.mediaId).sort()).toEqual(['rig', 'rig2']);
      // Bram's slot card by parent, the one entry card by type; Pack Rig is Unused.
      expect(shown.filter((i) => i.mediaId === 'rig')).toHaveLength(1);
    }
  });

  it('matches a part by its own name, so one holder\'s name does not pull in another holder', () => {
    const w = rigWorld();
    w.worldOverview.mediaList = {
      ...w.worldOverview.mediaList,
      rig2: { id: 'rig2', name: 'Pack Rig', kind: 'layered', layers: [{ id: 'bag', name: 'Bag', variants: [{ mediaId: 'sketch' }] }] },
    };
    const entries = mediaEntryItems(w);
    const shown = searchSections(groupSections(mediaSections(w), 'parent', entries), entries, has('scout')).flatMap((s) => s.items);
    expect(shown.map((i) => i.mediaId)).toEqual(['rig']);
  });

  it('keeps a hit out of the results when the filter already removed its Layered Image', () => {
    const w = rigWorld();
    w.entities.find((e) => e.id === 'bram')!.images = [{ mediaId: 'rig' }];
    const entries = mediaEntryItems(w);
    const unusedOnly = filterSections(groupSections(mediaSections(w), 'parent', entries), 'unused');
    expect(searchSections(unusedOnly, entries, has('lantern sketch'))).toEqual([]);
  });

  it('lists nothing for a term no part or Layered Image matches', () => {
    const w = rigWorld();
    const entries = mediaEntryItems(w);
    expect(searchSections(groupSections(mediaSections(w), 'parent', entries), entries, has('zzz'))).toEqual([]);
  });
});

describe('the Media List and the rest of the tab', () => {
  it('optimizes an Unused image entry at the background cap', () => {
    const { entries } = worldOptimizeTargets(listWorld());
    expect(entries.find((e) => e.id === 'sketch')).toEqual({ id: 'sketch', data: SKETCH, budget: IMAGE_CAPS.background });
  });

  it('holds an entry card\'s selection while the entry exists', () => {
    const w = listWorld();
    expect(mediaHolds(w, 'entry:sketch')).toBe(true);
    expect(mediaHolds(w, 'entry:gone')).toBe(false);
  });
});
