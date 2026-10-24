import { describe, it, expect } from 'vitest';
import { locationRuleStates, visibleImages, visibleLocationImages } from './imageVisibility';
import type { GateInput, GateStat, GateStatSet } from './traitGates';
import { scoped } from './scope';
import type { GalleryImage, StatRequirement, Trait, TraitRequirement } from '@/types';

const T = (id: string): Trait => ({ id, name: id, statChanges: [] });
const health = (value: number): GateStat => ({ name: 'Health', value, min: 0, max: 100 });
const hurt: StatRequirement = { kind: 'stat', id: 'health', operator: '<', value: 20, unit: 'percent' };
const when = (...all: TraitRequirement[]): GalleryImage['requires'] => [{ all }];

const input = (hp: number, active: string[] = []): GateInput => ({
  global: { traits: [T('Night Vision')], groups: [] },
  owners: [],
  active: scoped(active),
  stats: scoped<GateStatSet>({},{ ash: { health: health(hp) } }),
  entities: [{ id: 'ash', name: 'Ash' }],
  persona: { source: 'none' },
});

const ash = (images: GalleryImage[]) => ({ id: 'ash', images });
const shown = (images: GalleryImage[], i: GateInput) => visibleImages(ash(images), i).map((v) => v.data);

describe('visibleImages', () => {
  it('shows an image with no rule whatever the state', () => {
    expect(shown([{ data: 'plain' }], input(5))).toEqual(['plain']);
  });

  it('keeps author order, so the primary is the first visible image', () => {
    const gallery = [{ data: 'wounded', requires: when(hurt) }, { data: 'calm' }];
    expect(shown(gallery, input(10))).toEqual(['wounded', 'calm']);
    expect(shown(gallery, input(90))).toEqual(['calm']);
  });

  it('reports each visible image with its author-order slot', () => {
    const gallery = [{ data: 'wounded', requires: when(hurt) }, { data: 'calm' }];
    expect(visibleImages(ash(gallery), input(90))).toEqual([{ slot: 1, data: 'calm' }]);
  });

  it('reads the image’s own entity for a rule with no owner', () => {
    expect(shown([{ data: 'wounded', requires: when(hurt) }], input(10))).toEqual(['wounded']);
  });

  it('reads global traits under the you owner', () => {
    const gallery = [{ data: 'true form', requires: when({ kind: 'trait', id: 'Night Vision', owner: { kind: 'you' } }) }];
    expect(shown(gallery, input(50, ['Night Vision']))).toEqual(['true form']);
    expect(shown(gallery, input(50))).toEqual([]);
  });

  it('shows the image while any row holds', () => {
    const gallery = [{ data: 'either', requires: [{ all: [hurt] }, { all: [{ ...hurt, operator: '>', value: 80 } as StatRequirement] }] }];
    expect(shown(gallery, input(90))).toEqual(['either']);
    expect(shown(gallery, input(50))).toEqual([]);
  });

  it('yields nothing when every image hides', () => {
    const gallery = [{ data: 'a', requires: when(hurt) }, { data: 'b', requires: when(hurt) }];
    expect(visibleImages(ash(gallery), input(90))).toEqual([]);
  });

  it('hides an image whose rule names a missing trait, even under Not', () => {
    const gallery = [
      { data: 'gone', requires: when({ kind: 'trait', id: 'Deleted', name: 'Deleted' }) },
      { data: 'not gone', requires: when({ kind: 'trait', id: 'Deleted', name: 'Deleted', not: true }) },
      { data: 'fallback' },
    ];
    expect(shown(gallery, input(50))).toEqual(['fallback']);
  });

  it('hides an image whose rule names a missing stat, even under Not', () => {
    const missing: StatRequirement = { kind: 'stat', id: 'mana', name: 'Mana', operator: '>', value: 0, unit: 'raw' };
    const gallery = [{ data: 'a', requires: when(missing) }, { data: 'b', requires: when({ ...missing, not: true }) }];
    expect(shown(gallery, input(50))).toEqual([]);
  });

  it('is empty for an entity with no images', () => {
    expect(visibleImages({ id: 'ash' }, input(50))).toEqual([]);
  });
});

describe('visibleLocationImages', () => {
  // Wren is the played persona; Ash, another entity, has a Health of its own.
  const played = (wrenHp: number, ashHp = 50, active: string[] = []): GateInput => ({
    global: { traits: [T('Night Vision')], groups: [] },
    owners: [],
    active: scoped(active),
    stats: scoped<GateStatSet>({}, { wren: { health: health(wrenHp) }, ash: { health: health(ashHp) } }),
    entities: [{ id: 'wren', name: 'Wren', persona: true }, { id: 'ash', name: 'Ash' }],
    persona: { source: 'world', entityId: 'wren' },
  });
  const backdrops = (images: GalleryImage[], i: GateInput) => visibleLocationImages({ images }, i).map((v) => v.data);

  it('reads the played persona for a Condition with no owner', () => {
    const gallery = [{ data: 'wounded', requires: when(hurt) }, { data: 'healthy' }];
    expect(backdrops(gallery, played(10, 90))).toEqual(['wounded', 'healthy']);
    expect(backdrops(gallery, played(90, 10))).toEqual(['healthy']);
  });

  it('reads a named owner as an entity image does', () => {
    const gallery = [{ data: 'ash hurt', requires: when({ ...hurt, owner: { kind: 'entity' as const, id: 'ash', name: 'Ash' } }) }];
    expect(backdrops(gallery, played(90, 10))).toEqual(['ash hurt']);
    expect(backdrops(gallery, played(10, 90))).toEqual([]);
  });

  it('reads a global trait with no owner from global scope', () => {
    const gallery = [{ data: 'night', requires: when({ kind: 'trait', id: 'Night Vision' }) }];
    expect(backdrops(gallery, played(50, 50, ['Night Vision']))).toEqual(['night']);
    expect(backdrops(gallery, played(50))).toEqual([]);
  });

  it('reads a global stat with no owner from global scope, and names no owner', () => {
    const input: GateInput = { ...played(50), stats: scoped<GateStatSet>({ danger: { name: 'Danger', value: 90, min: 0, max: 100 } }, { wren: { health: health(50) } }) };
    const high: StatRequirement = { kind: 'stat', id: 'danger', operator: '>', value: 80, unit: 'raw' };
    const [row] = locationRuleStates(input, when(high)!);
    expect(row.holds).toBe(true);
    expect(row.conditions[0].text).toBe('Danger > 80');
    expect(locationRuleStates(input, when(hurt)!)[0].conditions[0].text).toMatch(/^Persona: Health/);
  });

  it('never holds a persona Condition with no persona to read', () => {
    const none: GateInput = { ...played(10), persona: { source: 'none' } };
    expect(backdrops([{ data: 'wounded', requires: when(hurt) }], none)).toEqual([]);
  });

  it('yields nothing when every image hides', () => {
    expect(backdrops([{ data: 'wounded', requires: when(hurt) }], played(90))).toEqual([]);
  });

  it('reads a location written before the gallery', () => {
    expect(visibleLocationImages({ backgroundImage: 'old' }, played(50))).toEqual([{ slot: 0, data: 'old' }]);
  });
});
