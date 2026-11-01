import { describe, it, expect } from 'vitest';
import type { Body, Dictionary, Entity, GameLocation, WorldOverview } from '@/types';
import { buildMediaIndex, type MediaWorld } from './mediaIndex';
import { mapGalleryStepLabel, mapImages } from './mapBackground';
import { mediaParentSpec, writeMediaSlot, type MediaEditor } from './mediaParents';

const frame = { x: 0, y: 0, width: 10, height: 10 };
const rule = [{ all: [{ kind: 'stat', id: 'hp', operator: '<', value: 20, unit: 'percent' }] }];
const overview = {
  name: 'W', description: '', author: '', thumbnail: 'thumb', bgm: null, systemPrompt: '', tags: [],
  mapBackground: { images: [{ data: 'a', requires: rule }, { data: 'b' }], frame, opacity: 1 },
} as unknown as WorldOverview;
const entity = { id: 'e1', name: 'Ent', images: [{ data: 'e0' }, { data: 'e1', requires: rule }] } as unknown as Entity;
const location = { id: 'l1', name: 'Loc', images: [{ data: 'l0' }] } as unknown as GameLocation;
const book = { id: 'd1', name: 'Lore', entries: [], thumbnail: 'cover' } as unknown as Dictionary;
const body: Body = {
  id: 'b1', name: 'Imp', entries: [{ slotId: 'hand', boxes: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }] }],
  backdrop: { kind: 'image', image: { data: 'bd' } }, aspect: 2,
};
const outlineBody: Body = { ...body, id: 'b2', name: 'Plain Imp', backdrop: { kind: 'plain' } };
const world: MediaWorld = { worldOverview: overview, entities: [entity], locations: [location], dictionaries: [book], bodies: [body, outlineBody] };

/** An editor over the fixture records that returns what each edit produced. */
function recorder() {
  const out: { overview?: Partial<WorldOverview>; entity?: Entity; location?: GameLocation; dictionary?: Dictionary; body?: Body } = {};
  const editor: MediaEditor = {
    overview: (patch) => { out.overview = patch(overview); },
    entity: (_id, edit) => { out.entity = edit(entity); },
    location: (_id, edit) => { out.location = edit(location); },
    dictionary: (_id, edit) => { out.dictionary = edit(book); },
    body: (_id, edit) => { out.body = edit(body); },
  };
  return { out, editor };
}

const itemOf = (id: string) => {
  const found = buildMediaIndex(world).find((i) => i.id === id);
  if (!found) throw new Error(`No item ${id}`);
  return found;
};

describe('media parent table', () => {
  it('labels a Media tab map step the way the canvas labels the same edit', () => {
    const first = itemOf('map:map:image:0');
    const second = itemOf('map:map:image:1');
    const spec = mediaParentSpec('map');
    const before = mapImages(overview);
    expect(spec.stepLabel?.(first, overview, { data: 'c' })).toBe(mapGalleryStepLabel(before, [{ data: 'c' }, before[1]]));
    expect(spec.stepLabel?.(second, overview, null)).toBe(mapGalleryStepLabel(before, [before[0]]));
    expect(spec.stepLabel?.(second, overview, null)).toBe('Remove Image 2: Map Background');
  });

  it('writes each parent kind to its own field and keeps a replaced image\'s rule', () => {
    const map = recorder();
    writeMediaSlot(map.editor, itemOf('map:map:image:0'), { data: 'm' });
    expect(map.out.overview?.mapBackground?.images).toEqual([{ data: 'm', requires: rule }, { data: 'b' }]);
    expect(map.out.overview?.mapBackground?.frame).toEqual(frame);

    const ent = recorder();
    writeMediaSlot(ent.editor, itemOf('entity:e1:image:1'), { data: 'x' });
    expect(ent.out.entity?.images).toEqual([{ data: 'e0' }, { data: 'x', requires: rule }]);

    const loc = recorder();
    writeMediaSlot(loc.editor, itemOf('location:l1:image:0'), null);
    expect(loc.out.location?.images).toEqual([]);

    const dict = recorder();
    writeMediaSlot(dict.editor, itemOf('dictionary:d1:thumbnail'), { data: 'c2' });
    expect(dict.out.dictionary?.thumbnail).toBe('c2');

    const top = recorder();
    writeMediaSlot(top.editor, itemOf('world:world:thumbnail'), { data: 't2' });
    expect(top.out.overview).toEqual({ thumbnail: 't2' });
  });

  it('indexes only a Body whose Backdrop is a Custom Image, at the entity cap', () => {
    const items = buildMediaIndex(world).filter((i) => i.parent.kind === 'body');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'body:b1:backdrop', slot: 'Backdrop', value: 'bd', linked: false, budget: { maxDim: 1280 } });
    expect(items[0].parent.name).toBe('Imp');
  });

  it('flags a linked Custom Image as linked', () => {
    const linked: MediaWorld = { ...world, bodies: [{ ...body, backdrop: { kind: 'image', image: { data: 'https://example.com/a.png' } } }] };
    expect(buildMediaIndex(linked).find((i) => i.parent.kind === 'body')?.linked).toBe(true);
  });

  it('writes a Custom Image to the Backdrop, keeping boxes and aspect, and a removal leaves the Humanoid outline', () => {
    const replaced = recorder();
    writeMediaSlot(replaced.editor, itemOf('body:b1:backdrop'), { data: 'new' });
    expect(replaced.out.body).toEqual({ ...body, backdrop: { kind: 'image', image: { data: 'new' } } });

    const removed = recorder();
    writeMediaSlot(removed.editor, itemOf('body:b1:backdrop'), null);
    expect(removed.out.body).toEqual({ ...body, backdrop: { kind: 'humanoid' }, aspect: 0.5 });
  });

  it('names where each parent kind lands and which rule host its rows use', () => {
    expect(mediaParentSpec('body').goTo).toEqual({ to: 'equipment' });
    expect(mediaParentSpec('body').ruleHost).toBeUndefined();
    expect(mediaParentSpec('body').stacks).toBe(false);
    expect(mediaParentSpec('world').goTo).toEqual({ to: 'overview' });
    expect(mediaParentSpec('map').goTo).toEqual({ to: 'canvas' });
    expect(mediaParentSpec('entity').goTo).toEqual({ to: 'bench', tab: 'entities' });
    expect(mediaParentSpec('entity').ruleHost).toBe('entity');
    expect(mediaParentSpec('map').ruleHost).toBe('location');
    expect(mediaParentSpec('location').ruleHost).toBe('location');
    expect(mediaParentSpec('dictionary').ruleHost).toBeUndefined();
  });
});
