import { describe, expect, it } from 'vitest';
import { inPlayWorldOf, startRoutinePick } from './inPlayWorld';
import { scoped } from './scope';
import type { Entity, GameLocation, Stat, Trait, TraitGroup, TraitRequirement } from '@/types';

// Sadie owns a Sex pick that defaults to Female; each partner is on under one of her picks.
const sex: TraitGroup = { id: 'sex', name: 'Sex', parentId: null };
const female: Trait = { id: 'female', name: 'Female', statChanges: [], groupId: 'sex', isDefault: true };
const futa: Trait = { id: 'futa', name: 'Futanari', statChanges: [], groupId: 'sex' };
const field: GameLocation = { id: 'field', name: 'Sports Field' };
const sadiePick = (id: string): TraitRequirement => ({ kind: 'trait', id, owner: { kind: 'entity', id: 'sadie' } });
const sadie: Entity = {
  id: 'sadie', name: 'Sadie', kind: 'unique', locations: ['field'],
  traitLinks: [{ id: 'sadie-sex', originalId: 'sex', originalName: 'Sex', kind: 'group', groupId: null, order: 0 }],
};
const partner = (id: string, pick: string): Entity =>
  ({ id, name: id, kind: 'unique', locations: ['field'], enabledWhen: [{ all: [sadiePick(pick)] }] });
const world = {
  entities: [sadie, partner('mudsdale', 'female'), partner('rapidash', 'futa')],
  locations: [field], traits: [female, futa], traitGroups: [sex],
};
const on = (picks?: Parameters<typeof inPlayWorldOf>[3]) => inPlayWorldOf(world, null, undefined, picks).entities.map((e) => e.id);

describe('the start gates read the picks a new game starts with', () => {
  it("holds each owner's default pick when no picks are given", () => {
    expect(on()).toEqual(['sadie', 'mudsdale']);
  });

  it('holds the given picks over the defaults', () => {
    expect(on(scoped([], { sadie: ['futa'] }))).toEqual(['sadie', 'rapidash']);
  });

  it("picks the Routine an owner's default pick opens", () => {
    const walker: Entity = {
      id: 'walker', name: 'Walker', kind: 'unique',
      routines: [
        { id: 'with-female', name: 'With Female', starts: [{ id: 's1', place: 'field', weight: 1, schedule: [] }], requires: [{ all: [sadiePick('female')] }] },
        { id: 'fallback', name: 'Fallback', starts: [{ id: 's2', place: 'field', weight: 1, schedule: [] }] },
      ],
    };
    const routines = { ...world, entities: [sadie, walker] };
    expect(startRoutinePick(routines)(walker)).toBe('with-female');
    expect(startRoutinePick(routines, null, undefined, scoped([], { sadie: ['futa'] }))(walker)).toBe('fallback');
  });

  it("picks the Routine a library persona's pick opens (Q35)", () => {
    const strength: Stat = { id: 'str', name: 'Strength', type: 'number', description: '', min: 0, max: 20, value: 4, regen: 0, descriptors: [] };
    const brawn: Trait = { id: 'brawn', name: 'Brawn', statChanges: [{ statId: 'str', type: 'starting', value: 3 }] };
    const lib: Entity = { id: 'lib', name: 'Lib', kind: 'unique', traits: [brawn] };
    const walker: Entity = {
      id: 'walker', name: 'Walker', kind: 'unique',
      routines: [
        { id: 'strong', name: 'Strong', starts: [{ id: 's1', place: 'field', weight: 1, schedule: [] }], requires: [{ all: [{ kind: 'stat', id: 'str', operator: '>=', value: 7, unit: 'raw' }] }] },
        { id: 'fallback', name: 'Fallback', starts: [{ id: 's2', place: 'field', weight: 1, schedule: [] }] },
      ],
    };
    const gated = { entities: [walker], locations: [field], stats: [strength] };
    const pick = (ids: string[]) => startRoutinePick(gated, 'lib', undefined, scoped([], { lib: ids }), [lib])(walker);
    expect(pick([])).toBe('fallback');
    expect(pick(['brawn'])).toBe('strong');
  });
});
