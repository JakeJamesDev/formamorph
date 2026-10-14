import { describe, it, expect } from 'vitest';
import { visibleImages } from './imageVisibility';
import { PLAYER_OWNER, type GateInput, type GateStat } from './traitGates';
import type { GalleryImage, StatRequirement, Trait, TraitRequirement } from '@/types';

const T = (id: string): Trait => ({ id, name: id, statChanges: [] });
const health = (value: number): GateStat => ({ name: 'Health', value, min: 0, max: 100 });
const hurt: StatRequirement = { kind: 'stat', id: 'health', operator: '<', value: 20, unit: 'percent' };
const when = (...all: TraitRequirement[]): GalleryImage['requires'] => [{ all }];

const input = (hp: number, active: string[] = []): GateInput => ({
  owners: [{ id: PLAYER_OWNER, name: '', traits: [T('Night Vision')], groups: [] }],
  active: { [PLAYER_OWNER]: active },
  stats: { ash: { health: health(hp) } },
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

  it('reads the player’s traits under the you owner', () => {
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
