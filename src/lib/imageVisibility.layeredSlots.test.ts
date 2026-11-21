import { describe, it, expect } from 'vitest';
import { itemRuleImageId, locationRuleImageId, visibleItemImage, visibleLocationImages } from './imageVisibility';
import type { GateInput, GateStat, GateStatSet } from './traitGates';
import { scoped } from './scope';
import type { ItemInstance, LayeredMediaEntry, MediaLayer, MediaList, StatRequirement, TraitRequirementRow } from '@/types';
import type { LayeredPicture } from './layeredImages';

const health = (value: number): GateStat => ({ name: 'Health', value, min: 0, max: 100 });
const below = (value: number): TraitRequirementRow[] =>
  [{ all: [{ kind: 'stat', id: 'health', operator: '<', value, unit: 'raw' } satisfies StatRequirement] }];

/** Ash is the played persona; Bram is another entity. Each has their own Health. */
const input = (ash: number, bram = 90): GateInput => ({
  global: { traits: [], groups: [] },
  owners: [],
  active: scoped([]),
  stats: scoped<GateStatSet>({}, { ash: { health: health(ash) }, bram: { health: health(bram) } }),
  entities: [{ id: 'ash', name: 'Ash', persona: true }, { id: 'bram', name: 'Bram' }],
  persona: { source: 'world', entityId: 'ash' },
});

const image = (id: string) => ({ id, name: id, kind: 'image' as const, data: `data:${id}` });
const layer = (id: string, variants: MediaLayer['variants']): MediaLayer => ({ id, name: id, variants });

/** A base and a Wear Layer that shows only while the bearer's Health is below 50. */
const RIG: LayeredMediaEntry = {
  id: 'rig', name: 'Rig', kind: 'layered', layers: [
    layer('base', [{ mediaId: 'base' }]),
    layer('wear', [{ mediaId: 'wear', requires: below(50) }]),
  ],
};
const media: MediaList = { ...Object.fromEntries(['base', 'wear'].map((id) => [id, image(id)])), rig: RIG };
const worn = (picture: unknown) => (picture as LayeredPicture).layers.find((l) => l.id === 'wear')?.data ?? null;

describe('visibleLocationImages with a Layered Image', () => {
  const square = { images: [{ mediaId: 'rig' }] };
  const shown = (i: GateInput) => visibleLocationImages(square, i, media)[0]?.data;

  it('reads the persona for a Variant rule with no owner', () => {
    expect(worn(shown(input(10, 90)))).toBe('data:wear');
    expect(worn(shown(input(90, 10)))).toBeNull();
  });

  it('shows the stack, sized by its canvas', () => {
    expect(shown(input(90))).toMatchObject({ kind: 'layered', entryId: 'rig', canvas: 'data:base' });
  });

  it('lets the link’s own rule decide whether the rig shows, ahead of a plain image', () => {
    const gated = { images: [{ mediaId: 'rig', requires: below(50) }, { mediaId: 'base' }] };
    expect(visibleLocationImages(gated, input(10), media).map((v) => v.slot)).toEqual([0, 1]);
    expect(visibleLocationImages(gated, input(90), media)).toEqual([{ slot: 1, data: 'data:base' }]);
  });
});

describe('script readers with a Layered Image', () => {
  it('read a shown layered link as its own entry, ahead of a later plain image', () => {
    const links = [{ mediaId: 'rig' }, { mediaId: 'base' }];
    expect(locationRuleImageId({ images: links }, input(10), media)).toBe('rig');
    expect(itemRuleImageId({ images: links }, { where: { kind: 'you' } }, input(10), media)).toBe('rig');
  });

  it('pass over a Layered Image with nothing to draw, to the next plain image', () => {
    const withEmpty: MediaList = { ...media, empty: { id: 'empty', name: 'Empty', kind: 'layered', layers: [] } };
    const links = [{ mediaId: 'empty' }, { mediaId: 'base' }];
    expect(locationRuleImageId({ images: links }, input(10), withEmpty)).toBe('base');
    expect(itemRuleImageId({ images: links }, { where: { kind: 'you' } }, input(10), withEmpty)).toBe('base');
  });

  it('lets an image override show ahead of a layered link', () => {
    const shown = visibleLocationImages({ images: [{ mediaId: 'rig' }] }, input(90), media, { id: 'wear' });
    expect(shown.map((v) => v.slot)).toEqual([-1, 0]);
    expect(shown[1].data).toMatchObject({ kind: 'layered' });
  });
});

describe('visibleItemImage with a Layered Image', () => {
  const sword = { images: [{ mediaId: 'rig' }] };
  const heldBy = (where: ItemInstance['where'], i: GateInput) => visibleItemImage(sword, { where }, i, media);

  it('reads the owning entity for a Variant rule with no owner', () => {
    const i = input(90, 10);
    expect(worn(heldBy({ kind: 'entity', id: 'bram' }, i))).toBe('data:wear');
    expect(worn(heldBy({ kind: 'entity', id: 'ash' }, i))).toBeNull();
  });

  it('reads the persona while the player holds the instance', () => {
    expect(worn(heldBy({ kind: 'you' }, input(10, 90)))).toBe('data:wear');
    expect(worn(heldBy({ kind: 'you' }, input(90, 10)))).toBeNull();
  });

  it('never holds an ownerless Condition while the instance lies at a location', () => {
    expect(worn(heldBy({ kind: 'location', id: 'square' }, input(10, 10)))).toBeNull();
  });

  it('keeps the same stack canvas wherever the instance lies', () => {
    expect(heldBy({ kind: 'location', id: 'square' }, input(10))).toMatchObject({ kind: 'layered', canvas: 'data:base' });
  });
});
