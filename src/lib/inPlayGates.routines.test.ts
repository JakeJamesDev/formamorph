import { describe, expect, it } from 'vitest';
import { evaluateGates, sameVerdicts, worldHasGates } from './inPlayGates';
import { resolveInPlayWorld } from './inPlayWorld';
import { scoped } from './scope';
import type { GateInput, GateStatSet } from './traitGates';
import type { Entity, EntityRoutine, ItemCopy, Trait, TraitGroup, TraitRequirement, WorldOption } from '@/types';

const T = (id: string): Trait => ({ id, name: id, statChanges: [] });
const brave = T('brave');
const watchful = T('watchful');
const moods: TraitGroup = { id: 'moods', name: 'Moods', parentId: null };
const noStats: GateStatSet = {};
const LIT: WorldOption = { id: 'lit', name: 'Lanterns Lit', type: 'boolean', shownToPlayer: false, midGame: false, default: false };
const ring = (where: ItemCopy['where']): ItemCopy => ({ id: 'c1', item: { kind: 'item', itemId: 'ring' }, where, quantity: 1, visibility: 'visible' });

/** Mira owns Brave and an `hp` stat; the world holds Watchful globally, one ring and the Lanterns Lit Option. */
const input = (over: Partial<GateInput> = {}): GateInput => ({
  global: { traits: [watchful], groups: [moods] },
  owners: [{ id: 'mira', name: 'Mira', traits: [brave], groups: [] }],
  active: scoped([], { mira: [] }),
  stats: scoped({ hp: { name: 'HP', value: 5, min: 0, max: 10 } }, { mira: { hp: { name: 'HP', value: 2, min: 0, max: 10 } } }),
  entities: [{ id: 'mira', name: 'Mira' }, { id: 'ash', name: 'Ash', persona: true }],
  persona: { source: 'none' },
  worldItems: [{ id: 'ring', name: 'Ring' }],
  itemCopies: [],
  daypart: 'morning',
  worldOptions: [LIT],
  ...over,
});

const start = (id: string) => ({ id: `${id}-s`, place: 'harbor', weight: 1, schedule: [] });
const routine = (id: string, requires?: TraitRequirement[], starts = [start(id)]): EntityRoutine =>
  ({ id, name: id, starts, ...(requires && { requires: [{ all: requires }] }) });
const mira = (...routines: EntityRoutine[]): Entity => ({ id: 'mira', name: 'Mira', kind: 'unique', routines });
const pickOf = (entity: Entity, over: Partial<GateInput> = {}) =>
  evaluateGates({ entities: [entity], locations: [], connections: [] }, { gate: input(over) }).routineIds.get(entity.id);

describe('the Routine gate', () => {
  it.each<[string, TraitRequirement, Partial<GateInput>, Partial<GateInput>]>([
    ['a trait', { kind: 'trait', id: 'watchful' }, { active: scoped(['watchful'], { mira: [] }) }, {}],
    ['a group', { kind: 'group', id: 'moods' }, {
      global: { traits: [{ ...watchful, groupId: 'moods' }], groups: [moods] }, active: scoped(['watchful'], { mira: [] }),
    }, { global: { traits: [{ ...watchful, groupId: 'moods' }], groups: [moods] } }],
    ['a stat', { kind: 'stat', id: 'hp', owner: { kind: 'entity', id: 'mira' }, operator: '>=', value: 2, unit: 'raw' }, {},
      { stats: scoped(noStats, { mira: { hp: { name: 'HP', value: 1, min: 0, max: 10 } } }) }],
    ['an item', { kind: 'item', id: 'ring', status: 'owned', owner: { kind: 'entity', id: 'mira' } }, { itemCopies: [ring({ kind: 'entity', id: 'mira' })] }, {}],
    ['the time', { kind: 'time', dayparts: ['morning'] }, {}, { daypart: 'night' }],
    ['playing as', { kind: 'playingAs', id: 'ash' }, { persona: { source: 'world', entityId: 'ash' } }, {}],
    ['a World Option', { kind: 'option', id: 'lit' }, { optionValues: { lit: true } }, { optionValues: { lit: false } }],
  ])('picks the gated Routine on %s Condition while it holds, and the fallback while it fails', (_kind, req, holds, fails) => {
    const entity = mira(routine('night', [req]), routine('day'));
    expect(pickOf(entity, holds)).toBe('night');
    expect(pickOf(entity, fails)).toBe('day');
  });

  it('applies the first holding Routine in author order (Q9)', () => {
    const morning: TraitRequirement = { kind: 'time', dayparts: ['morning'] };
    expect(pickOf(mira(routine('a', [morning]), routine('b', [morning]), routine('c')))).toBe('a');
    expect(pickOf(mira(routine('b', [morning]), routine('a', [morning])))).toBe('b');
  });

  it('reads a blank owner as the entity itself (Q7)', () => {
    // Mira's own HP is 2 while the global HP is 5.
    const atLeastFour: TraitRequirement = { kind: 'stat', id: 'hp', operator: '>=', value: 4, unit: 'raw' };
    const entity = mira(routine('strong', [atLeastFour]), routine('weak'));
    expect(pickOf(entity)).toBe('weak');
    expect(pickOf(entity, { stats: scoped({ hp: { name: 'HP', value: 0, min: 0, max: 10 } }, { mira: { hp: { name: 'HP', value: 6, min: 0, max: 10 } } }) })).toBe('strong');
  });

  it('picks none while no Routine holds (Q24), and skips a Routine with no Start (Q19)', () => {
    const night: TraitRequirement = { kind: 'time', dayparts: ['night'] };
    expect(pickOf(mira(routine('night', [night])))).toBeNull();
    expect(pickOf(mira(routine('empty', [{ kind: 'time', dayparts: ['morning'] }], []), routine('day')))).toBe('day');
  });

  it('counts a Routine gate as a world gate, and tells two picks apart', () => {
    const gated = mira(routine('night', [{ kind: 'time', dayparts: ['night'] }]), routine('day'));
    expect(worldHasGates([gated], [])).toBe(true);
    expect(worldHasGates([mira(routine('day'))], [])).toBe(false);
    const source = { entities: [gated], locations: [], connections: [] };
    expect(sameVerdicts(evaluateGates(source, { gate: input() }), evaluateGates(source, { gate: input({ daypart: 'night' }) }))).toBe(false);
  });

  it('gives the In-Play World a pick that falls back to the first Routine with a Start for an ungated entity', () => {
    const gated = mira(routine('night', [{ kind: 'time', dayparts: ['night'] }]), routine('day'));
    const plain: Entity = { id: 'ash', name: 'Ash', kind: 'unique', routines: [routine('empty', undefined, []), routine('only')] };
    const inPlay = resolveInPlayWorld({ entities: [gated, plain], locations: [], connections: [] }, { gate: input({ daypart: 'night' }) });
    expect(inPlay.routinePick(gated)).toBe('night');
    expect(inPlay.routinePick(plain)).toBe('only');
  });
});
