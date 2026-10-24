import { describe, expect, it } from 'vitest';
import type { World } from '@/types';
import {
  blankSections, buildMediaIndex, filterSections, formatMediaBytes, groupSections, kindBreakdown, largestItems, mediaFileName, mediaHolds, mediaSections,
  sectionCards, sectionSelection, sortSectionsLargestFirst, storedBytes, totalBytes, withAvatarsSection, worldImageSlots, type MediaFilter,
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
    for (const img of l.images ?? []) img.data = '';
    if (l.ambientSound) l.ambientSound.data = '';
  }
  for (const d of w.dictionaries) if (d.thumbnail) d.thumbnail = '';
  for (const img of w.worldOverview.mapBackground?.images ?? []) img.data = '';
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
      'image location:Marsh Image 1',
      'image location:Harbor Steps Image 1',
      'image location:Lamp Room Image 1',
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
      ['Locations', ['Marsh Image 1']],
      ['Locations › Harbor Steps', ['Harbor Steps Image 1', 'Lamp Room Image 1', 'Lamp Room Ambient Sound']],
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

describe('withAvatarsSection', () => {
  const bare = () => {
    const w = mediaFixtureWorld();
    w.worldOverview.vrmStore = undefined;
    return w;
  };
  const ids = (sections: ReturnType<typeof mediaSections>) => sections.map((s) => s.id);

  it('adds an empty Avatars section after World when no Avatar exists', () => {
    const sections = withAvatarsSection(mediaSections(bare()), 'parent');
    expect(ids(sections).slice(0, 2)).toEqual(['world', 'avatars']);
    expect(sections[1].items).toEqual([]);
    expect(sections[1].path).toEqual(['World', 'Avatars']);
  });

  it('puts it first when the world has no World media', () => {
    const w = bare();
    w.worldOverview.thumbnail = '';
    w.worldOverview.bgm = '';
    expect(ids(withAvatarsSection(mediaSections(w), 'parent'))[0]).toBe('avatars');
  });

  it('adds it last under type grouping', () => {
    const sections = withAvatarsSection(groupSections(mediaSections(bare()), 'type'), 'type');
    expect(ids(sections).at(-1)).toBe('type:avatar');
    expect(sections.at(-1)?.items).toEqual([]);
  });

  it('leaves an existing Avatars section as it is', () => {
    const sections = mediaSections(mediaFixtureWorld());
    expect(withAvatarsSection(sections, 'parent')).toEqual(sections);
  });

  it('adds nothing to the index: an empty section holds no item', () => {
    const w = bare();
    expect(withAvatarsSection(mediaSections(w), 'parent').flatMap((s) => s.items)).toEqual(buildMediaIndex(w));
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
        'Marsh Image 1', 'Harbor Steps Image 1', 'Lamp Room Image 1', 'Fen Lore Cover Image',
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

describe('blankSections', () => {
  const blanks = (w: World) => blankSections(w).flatMap((s) => s.items);

  it('reports an empty Map Background, each entity and location with no image, and no dictionary', () => {
    expect(where(blanks(mediaFixtureWorld()))).toEqual([
      'image map:Map Background Image 1',
      'image entity:Hollow Image 1',
      'image location:Bare Flat Image 1',
    ]);
  });

  it('reports an empty world thumbnail', () => {
    const world = mediaFixtureWorld();
    world.worldOverview.thumbnail = '';

    expect(where(blanks(world))[0]).toBe('image world:World Thumbnail');
  });

  it('holds no bytes and the id the filled slot takes', () => {
    const world = mediaFixtureWorld();
    const hollow = blanks(world).find((i) => i.parent.id === 'empty')!;
    world.entities.find((e) => e.id === 'empty')!.images = [{ data: fakeDataUrl('image/webp', 500) }];
    const filled = buildMediaIndex(world).find((i) => i.parent.id === 'empty')!;

    expect(hollow).toMatchObject({ blank: true, bytes: 0, value: '' });
    expect(filled.id).toBe(hollow.id);
  });

  it('never reaches the media index, the sections, or any filter but No Images', () => {
    const world = mediaFixtureWorld();
    world.worldOverview.thumbnail = '';
    const real = mediaSections(world);

    expect(buildMediaIndex(world).some((i) => i.blank)).toBe(false);
    for (const filter of ['all', 'linked', 'embedded', 'rules', 'overBudget'] as const) {
      expect(filterSections(real, filter).flatMap((s) => s.items).some((i) => i.blank)).toBe(false);
    }
    expect(filterSections(blankSections(world), 'noImages').flatMap((s) => s.items)).toHaveLength(4);
    expect(filterSections(blankSections(world), 'linked')).toEqual([]);
  });

  it('adds no bytes to a total', () => {
    const world = mediaFixtureWorld();
    world.worldOverview.thumbnail = '';

    expect(blanks(world).length).toBeGreaterThan(0);
    expect(totalBytes(blanks(world))).toBe(0);
  });

  it('keeps the usual sections and sorts blank cards in author order under Largest First', () => {
    const sorted = sortSectionsLargestFirst(blankSections(mediaFixtureWorld()));

    expect(sorted.map((s) => s.id)).toEqual(['mapBackground', 'group:crew', 'locations']);
    expect(groupSections(blankSections(mediaFixtureWorld()), 'type').map((s) => s.path)).toEqual([['Images']]);
  });
});

describe('location galleries', () => {
  const HURT = [{ all: [{ kind: 'stat' as const, id: 'health', operator: '<' as const, value: 20, unit: 'percent' as const }] }];
  const galleryWorld = () => {
    const world = mediaFixtureWorld();
    world.locations.find((l) => l.id === 'marsh')!.images = [
      { data: fakeDataUrl('image/jpeg', IMAGE_CAPS.background.maxBytes * 2, 'a') },
      { data: fakeDataUrl('image/jpeg', 700, 'b'), requires: HURT },
    ];
    return world;
  };
  const marshItems = () => buildMediaIndex(galleryWorld()).filter((i) => i.parent.id === 'marsh');

  it('lists each image with its gallery position and rule', () => {
    expect(marshItems().map((i) => [i.id, i.slot, i.galleryIndex, i.rules])).toEqual([
      ['location:marsh:image:0', 'Image 1', 0, undefined],
      ['location:marsh:image:1', 'Image 2', 1, HURT],
    ]);
  });

  it('stacks a location with two or more images', () => {
    const locations = mediaSections(galleryWorld()).find((s) => s.id === 'locations')!;
    const stack = sectionCards(locations.items).find((c) => c.item.parent.id === 'marsh')!;
    expect(stack.images?.map((i) => i.slot)).toEqual(['Image 1', 'Image 2']);
  });

  it('feeds every location image to the rules and size filters and the optimize walk', () => {
    const pick = (filter: MediaFilter) => filterSections(mediaSections(galleryWorld()), filter)
      .flatMap((s) => s.items).filter((i) => i.parent.id === 'marsh').map((i) => i.slot);
    expect(pick('rules')).toEqual(['Image 2']);
    expect(pick('overBudget')).toEqual(['Image 1']);
    expect(worldImageSlots(galleryWorld()).filter((s) => s.path.startsWith('location:marsh:')).map((s) => s.path))
      .toEqual(['location:marsh:image:0', 'location:marsh:image:1']);
  });
});

describe('Map Background', () => {
  const RUINED = [{ all: [{ kind: 'stat' as const, id: 'ruin', operator: '>' as const, value: 4, unit: 'raw' as const }] }];
  // Over the background budget, under the map's own.
  const BIG = fakeDataUrl('image/webp', 2_000_000, 'd');
  const mapWorld = () => {
    const world = mediaFixtureWorld();
    world.worldOverview.mapBackground = {
      images: [{ data: BIG }, { data: fakeDataUrl('image/webp', IMAGE_CAPS.map.maxBytes + 1_000, 'r'), requires: RUINED }],
      frame: { x: 0, y: 0, width: 1000, height: 600 },
      opacity: 0.8,
    };
    return world;
  };
  const mapItems = () => buildMediaIndex(mapWorld()).filter((i) => i.parent.kind === 'map');

  it('lists each image in World › Map Background with its position, rule and the map budget', () => {
    const section = mediaSections(mapWorld()).find((s) => s.id === 'mapBackground')!;
    expect(section.path).toEqual(['World', 'Map Background']);
    expect(mapItems().map((i) => [i.id, i.parent.name, i.slot, i.galleryIndex, i.rules, i.budget])).toEqual([
      ['map:map:image:0', 'Map Background', 'Image 1', 0, undefined, IMAGE_CAPS.map],
      ['map:map:image:1', 'Map Background', 'Image 2', 1, RUINED, IMAGE_CAPS.map],
    ]);
  });

  it('stacks two or more images on one card', () => {
    const section = mediaSections(mapWorld()).find((s) => s.id === 'mapBackground')!;
    expect(sectionCards(section.items).map((c) => c.images?.length)).toEqual([2]);
  });

  it('judges size against the 2560 px, 2.5 MB cap, and feeds the optimize walk with it', () => {
    expect(mapItems().map((i) => i.overBudget)).toEqual([false, true]);
    expect(worldImageSlots(mapWorld()).filter((s) => s.path.startsWith('map:'))).toEqual([
      { url: BIG, cap: IMAGE_CAPS.map, path: 'map:map:image:0' },
      expect.objectContaining({ cap: IMAGE_CAPS.map, path: 'map:map:image:1' }),
    ]);
  });

  it('counts toward the publish measure like other media', () => {
    const world = mapWorld();
    expect(measurePublishBytes(world) - totalBytes(buildMediaIndex(world))).toBe(measurePublishBytes(withoutMedia(world)));
  });

  it('shows no blank card once it holds an image', () => {
    expect(blankSections(mapWorld()).flatMap((s) => s.items).some((i) => i.parent.kind === 'map')).toBe(false);
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
