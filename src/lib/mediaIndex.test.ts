import { describe, expect, it } from 'vitest';
import type { World } from '@/types';
import {
  buildMediaIndex, filterSections, formatMediaBytes, groupSections, kindBreakdown, largestItems, mediaFileName, mediaHolds, mediaSections,
  sectionCards, sectionSelection, sortSectionsLargestFirst, storedBytes, totalBytes, type MediaFilter,
} from './mediaIndex';
import { IMAGE_CAPS } from './imageSlots';
import { measurePublishBytes } from './publishLimits';
import { LINKED_IMAGE, fakeDataUrl, mediaFixtureWorld } from '@/test/mediaFixture';

const where = (items: ReturnType<typeof buildMediaIndex>) => items.map((i) => `${i.kind} ${i.parent.kind}:${i.parent.name} ${i.slot}`);

/** The world with every media value emptied: what the publish measure counts besides media. */
function withoutMedia(world: World): World {
  const w = structuredClone(world);
  w.worldOverview.thumbnail = '';
  w.worldOverview.bgm = '';
  for (const vrm of Object.values(w.worldOverview.vrmStore ?? {})) vrm.file.data = '';
  for (const e of w.entities) {
    for (const img of e.images ?? []) img.data = '';
    if (e.sound) e.sound.data = '';
    if (e.model) e.model.data = '';
  }
  for (const l of w.locations) {
    if (l.backgroundImage) l.backgroundImage = '';
    if (l.ambientSound) l.ambientSound.data = '';
  }
  for (const d of w.dictionaries) if (d.thumbnail) d.thumbnail = '';
  return w;
}

describe('buildMediaIndex', () => {
  it('finds every media kind with its parent and slot, and nothing for parents with no media', () => {
    expect(where(buildMediaIndex(mediaFixtureWorld()))).toEqual([
      'image world:World Thumbnail',
      'sound world:World Background Music',
      'avatar world:World Fen Walker',
      'avatar world:World Spare',
      'image entity:Odd Wick Image 1',
      'image entity:Odd Wick Image 2',
      'image entity:Odd Wick Image 3',
      'sound entity:Odd Wick Sound',
      'model entity:Odd Wick 3D Model',
      'image entity:Bram Image 1',
      'image location:Marsh Background Image',
      'image location:Harbor Steps Background Image',
      'image location:Lamp Room Background Image',
      'sound location:Lamp Room Ambient Sound',
      'image dictionary:Fen Lore Cover Image',
    ]);
  });

  it('lists each Avatar once, with the entities that pick it', () => {
    const avatars = buildMediaIndex(mediaFixtureWorld()).filter((i) => i.kind === 'avatar');

    expect(avatars.map((a) => [a.slot, a.users?.map((u) => u.name)])).toEqual([
      ['Fen Walker', ['Odd Wick', 'Bram']],
      ['Spare', []],
    ]);
  });

  it("sums to the publish measure, less exactly the world's non-media JSON bytes", () => {
    // The bound: what the publish measure counts beyond the index is the world with every media value emptied.
    const world = mediaFixtureWorld();

    expect(measurePublishBytes(world) - totalBytes(buildMediaIndex(world))).toBe(measurePublishBytes(withoutMedia(world)));
  });

  it('flags a linked image and counts only its URL bytes', () => {
    const linked = buildMediaIndex(mediaFixtureWorld()).filter((i) => i.linked);

    expect(linked.map((i) => i.slot)).toEqual(['Image 3']);
    expect(linked[0].bytes).toBe(new TextEncoder().encode(LINKED_IMAGE).length);
    expect(linked[0].overBudget).toBe(false);
  });

  it('flags images over the cap for their kind only; sounds, 3D Models and Avatars never flag', () => {
    const items = buildMediaIndex(mediaFixtureWorld());

    // Both images are about 700 KB: over the entity cap, under the background one.
    expect(items.filter((i) => i.overBudget).map((i) => `${i.parent.name} ${i.slot}`)).toEqual(['Bram Image 1']);
    expect(items.find((i) => i.parent.name === 'Harbor Steps')?.budget).toBe(IMAGE_CAPS.background);
    expect(items.find((i) => i.parent.name === 'Bram')?.budget).toBe(IMAGE_CAPS.entity);

    const huge = fakeDataUrl('audio/ogg', 5_000_000);
    const world = mediaFixtureWorld();
    world.worldOverview.bgm = huge;
    world.entities[0].model = { data: huge, type: 'model/gltf-binary' };
    world.worldOverview.vrmStore!.spare.file.data = huge;

    expect(buildMediaIndex(world).filter((i) => i.overBudget && i.kind !== 'image')).toEqual([]);
  });

  it("keeps an entity image's rule rows and gallery position", () => {
    const wick = buildMediaIndex(mediaFixtureWorld()).filter((i) => i.parent.name === 'Odd Wick' && i.kind === 'image');

    expect(wick.map((i) => [i.galleryIndex, i.rules?.length ?? 0])).toEqual([[0, 0], [1, 1], [2, 0]]);
  });
});

describe('mediaSections', () => {
  it('follows entity groups and location nesting, and makes no section from parents with no media', () => {
    const sections = mediaSections(mediaFixtureWorld());

    expect(sections.map((s) => [s.path.join(' › '), s.items.map((i) => `${i.parent.name} ${i.slot}`)])).toEqual([
      ['World', ['World Thumbnail', 'World Background Music']],
      ['World › Avatars', ['World Fen Walker', 'World Spare']],
      ['Entities', ['Odd Wick Image 1', 'Odd Wick Image 2', 'Odd Wick Image 3', 'Odd Wick Sound', 'Odd Wick 3D Model']],
      // Crew holds only Hollow, which has no media, so only its subgroup makes a section.
      ['Entities › Crew › Deckhands', ['Bram Image 1']],
      ['Locations', ['Marsh Background Image']],
      ['Locations › Harbor Steps', ['Harbor Steps Background Image', 'Lamp Room Background Image', 'Lamp Room Ambient Sound']],
      ['Dictionaries', ['Fen Lore Cover Image']],
    ]);
  });

  it("holds a card's id and a section header's, and drops a card once its field is gone", () => {
    const world = mediaFixtureWorld();

    expect(mediaHolds(world, 'location:lamp:ambientSound')).toBe(true);
    expect(mediaHolds(world, sectionSelection('dictionaries'))).toBe(true);
    world.locations.find((l) => l.id === 'lamp')!.ambientSound = undefined;
    world.dictionaries[0].thumbnail = '';
    expect(mediaHolds(world, 'location:lamp:ambientSound')).toBe(false);
    expect(mediaHolds(world, sectionSelection('dictionaries'))).toBe(false);
  });
});

describe('mediaFileName', () => {
  const find = (world: World, parent: string, slot: string) => buildMediaIndex(world).find((i) => i.parent.name === parent && i.slot === slot)!;

  it("names a file for its parent and slot, with the extension of the data's type over the uploaded name's", () => {
    const world = mediaFixtureWorld();
    world.entities[0].sound = { data: fakeDataUrl('audio/ogg', 10), type: 'audio/ogg', name: 'old.mp3' };

    expect(mediaFileName(find(world, 'Odd Wick', 'Sound'), 'Odd Wick')).toBe('Odd Wick Sound.ogg');
    expect(mediaFileName(find(world, 'World', 'Thumbnail'), 'World')).toBe('Thumbnail.webp');
  });

  it("keeps an Avatar's own extension, since .vrm and .glb share one type", () => {
    expect(mediaFileName(find(mediaFixtureWorld(), 'World', 'Fen Walker'), 'World')).toBe('Fen Walker.vrm');
  });
});

describe('totals and summaries', () => {
  it('breaks items down by kind and lists the largest first', () => {
    const items = mediaSections(mediaFixtureWorld()).find((s) => s.id === 'entities')!.items;

    expect(kindBreakdown(items).map((r) => [r.kind, r.count])).toEqual([['image', 3], ['sound', 1], ['model', 1]]);
    expect(largestItems(items, 2).map((i) => i.slot)).toEqual(['3D Model', 'Sound']);
  });

  it('counts UTF-8 bytes of a link, and formats sizes 1024-based', () => {
    expect(storedBytes('https://x.test/é🐸')).toBe(new TextEncoder().encode('https://x.test/é🐸').length);
    expect(formatMediaBytes(512)).toBe('512 B');
    expect(formatMediaBytes(2048)).toBe('2 KB');
    expect(formatMediaBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatMediaBytes(1.25 * 1024 * 1024)).toBe('1.3 MB');
  });
});

const names = (items: readonly { parent: { name: string }; slot: string }[]) => items.map((i) => `${i.parent.name} ${i.slot}`);

describe('groupSections by type', () => {
  it('makes one section per kind, in kind order, each keeping author order and naming its parent', () => {
    const sections = groupSections(mediaSections(mediaFixtureWorld()), 'type');

    expect(sections.map((s) => [s.path.join(' › '), names(s.items)])).toEqual([
      ['Images', [
        'World Thumbnail', 'Odd Wick Image 1', 'Odd Wick Image 2', 'Odd Wick Image 3', 'Bram Image 1',
        'Marsh Background Image', 'Harbor Steps Background Image', 'Lamp Room Background Image', 'Fen Lore Cover Image',
      ]],
      ['Sounds', ['World Background Music', 'Odd Wick Sound', 'Lamp Room Ambient Sound']],
      ['3D Models', ['Odd Wick 3D Model']],
      ['Avatars', ['World Fen Walker', 'World Spare']],
    ]);
  });

  it('leaves kinds with no items out, and keeps parent grouping as it is', () => {
    const world = mediaFixtureWorld();
    world.worldOverview.vrmStore = {};
    const parent = mediaSections(world);

    expect(groupSections(parent, 'type').map((s) => s.path[0])).not.toContain('Avatars');
    expect(groupSections(parent, 'parent')).toBe(parent);
  });

  it("still stacks one parent's images inside Images", () => {
    const images = groupSections(mediaSections(mediaFixtureWorld()), 'type')[0];

    expect(sectionCards(images.items).filter((c) => c.images && c.images.length > 1).map((c) => c.item.parent.name)).toEqual(['Odd Wick']);
  });
});

describe('sortSectionsLargestFirst', () => {
  it("orders each section's cards by size and keeps a stack's image order", () => {
    const sorted = sortSectionsLargestFirst(mediaSections(mediaFixtureWorld()));
    const entities = sorted.find((s) => s.id === 'entities')!;

    // The 3D Model outweighs the stack (two uploads and a link), and the stack outweighs the Sound.
    expect(names(entities.items)).toEqual(['Odd Wick 3D Model', 'Odd Wick Image 1', 'Odd Wick Image 2', 'Odd Wick Image 3', 'Odd Wick Sound']);
    expect(sorted.map((s) => s.id)).toEqual(mediaSections(mediaFixtureWorld()).map((s) => s.id));
  });

  it("sorts a stack by its total, not by its largest image", () => {
    const world = mediaFixtureWorld();
    // Three 1,900-byte images total more than the 3D Model, though each is smaller than it.
    world.entities[0].images = [1, 2, 3].map((n) => ({ data: fakeDataUrl('image/webp', 1_900, String(n)) }));
    const entities = sortSectionsLargestFirst(mediaSections(world)).find((s) => s.id === 'entities')!;

    expect(names(entities.items).slice(0, 3)).toEqual(['Odd Wick Image 1', 'Odd Wick Image 2', 'Odd Wick Image 3']);
  });
});

describe('filterSections', () => {
  const pick = (filter: MediaFilter) => names(filterSections(mediaSections(mediaFixtureWorld()), filter).flatMap((s) => s.items));

  it('keeps linked images only under Linked', () => {
    expect(pick('linked')).toEqual(['Odd Wick Image 3']);
  });

  it('keeps every item that is not a linked image under Embedded, sounds and Avatars included', () => {
    const embedded = pick('embedded');

    expect(embedded).not.toContain('Odd Wick Image 3');
    expect(embedded).toEqual(expect.arrayContaining(['World Background Music', 'Odd Wick 3D Model', 'World Spare', 'Odd Wick Image 1']));
    expect(embedded).toHaveLength(buildMediaIndex(mediaFixtureWorld()).length - 1);
  });

  it('keeps images with Visibility rules under Has Visibility Rules', () => {
    expect(pick('rules')).toEqual(['Odd Wick Image 2']);
  });

  it('keeps images over their budget under Over Size Budget, and no other kind', () => {
    expect(pick('overBudget')).toEqual(['Bram Image 1']);
  });

  it('leaves out a section with no match, and passes everything under All Media', () => {
    const all = mediaSections(mediaFixtureWorld());

    expect(filterSections(all, 'overBudget').map((s) => s.id)).toEqual(['group:deckhands']);
    expect(filterSections(all, 'all')).toBe(all);
  });

  it('forms a stack from the images that pass, so its count and total follow the filter', () => {
    const entities = filterSections(mediaSections(mediaFixtureWorld()), 'embedded').find((s) => s.id === 'entities')!;
    const stack = sectionCards(entities.items).find((c) => c.images)!.images!;
    const embeddedWick = buildMediaIndex(mediaFixtureWorld()).filter((i) => i.parent.name === 'Odd Wick' && i.kind === 'image' && !i.linked);

    expect(stack.map((i) => i.slot)).toEqual(['Image 1', 'Image 2']);
    expect(totalBytes(stack)).toBe(totalBytes(embeddedWick));
  });
});
