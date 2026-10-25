import { describe, it, expect } from 'vitest';
import type { Dictionary, Entity, GameLocation, WorldOverview } from '@/types';
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
const world: MediaWorld = { worldOverview: overview, entities: [entity], locations: [location], dictionaries: [book] };

/** An editor over the fixture records that returns what each edit produced. */
function recorder() {
  const out: { overview?: Partial<WorldOverview>; entity?: Entity; location?: GameLocation; dictionary?: Dictionary } = {};
  const editor: MediaEditor = {
    overview: (patch) => { out.overview = patch(overview); },
    entity: (_id, edit) => { out.entity = edit(entity); },
    location: (_id, edit) => { out.location = edit(location); },
    dictionary: (_id, edit) => { out.dictionary = edit(book); },
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

  it('names where each parent kind lands and which rule host its rows use', () => {
    expect(mediaParentSpec('world').goTo).toEqual({ to: 'overview' });
    expect(mediaParentSpec('map').goTo).toEqual({ to: 'canvas' });
    expect(mediaParentSpec('entity').goTo).toEqual({ to: 'bench', tab: 'entities' });
    expect(mediaParentSpec('entity').ruleHost).toBe('entity');
    expect(mediaParentSpec('map').ruleHost).toBe('location');
    expect(mediaParentSpec('location').ruleHost).toBe('location');
    expect(mediaParentSpec('dictionary').ruleHost).toBeUndefined();
  });
});
