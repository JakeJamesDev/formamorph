import { describe, expect, it } from 'vitest';
import type { World } from '@/types';
import { mediaEntryItems, mediaSearchText } from './mediaEntries';
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
