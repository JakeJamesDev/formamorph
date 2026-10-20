import { describe, it, expect } from 'vitest';
import type { Entity, Stat, StatRequirement, Trait } from '@/types';
import { buildEntityCardData, parseEntityCardData } from './entityFile';
import { bindOwnedTraits, comparableOwnedTraits, portableOwnedTraits, type TraitWorld } from './portableTraits';
import { conditionsOf } from './requirementRows';
import { entryDefaults, entryGateInput, emptyEntryDraft } from './entryDraft';
import { gateOf, gateStates } from './traitGates';
import { gateLine } from './traitGateLine';

const S = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], ...extra });
const T = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });

const outward: StatRequirement = { kind: 'stat', id: 'w-rage', owner: { kind: 'you' }, operator: '>=', value: 80, unit: 'raw', not: true };
const inward: StatRequirement = { kind: 'stat', id: 'hp', operator: '<', value: 20, unit: 'percent' };

const wren = (far: StatRequirement = outward): Entity => ({
  id: 'wren', name: 'Wren',
  stats: [S('hp', 'Health')],
  traits: [T('t-wounded', { name: 'Wounded', requires: [{ all: [inward, far] }] })],
});
const { owner: _you, ...globalRage } = outward;
const home: TraitWorld = { traits: [], traitGroups: [], entities: [], stats: [S('w-rage', 'Rage')], statGroups: [] };
const wounded = (e: Pick<Entity, 'traits'>) => conditionsOf(e.traits?.find((t) => t.name === 'Wounded')?.requires);

/** The entity through a card: built against `home`, serialized, parsed back. */
const throughCard = (entity: Entity): Entity =>
  parseEntityCardData(JSON.parse(JSON.stringify(buildEntityCardData(entity, [], {}, undefined, home))));

describe('a stat Condition on a character card', () => {
  it('round-trips with its operator, value, unit, owner and Not', () => {
    expect(wounded(throughCard(wren()))).toEqual([inward, { ...outward, name: 'Rage' }]);
  });

  it('writes the owner under `owner` and reads a card from before the rename', () => {
    const card = JSON.parse(JSON.stringify(buildEntityCardData(wren(), [], {}, undefined, home)));
    expect(JSON.stringify(card)).toContain('"owner"');
    expect(JSON.stringify(card)).not.toContain('"bearer"');
    const old = JSON.parse(JSON.stringify(card).replaceAll('"owner"', '"bearer"'));
    expect(wounded(parseEntityCardData(old))).toEqual([inward, { ...outward, name: 'Rage' }]);
  });

  it('drops a stat Condition whose comparison is malformed, and the row it empties', () => {
    const bad = { ...wren(), traits: [T('t-wounded', { name: 'Wounded', requires: [{ all: [{ ...inward, operator: '=>' } as unknown as StatRequirement] }] })] };
    expect(throughCard(bad).traits?.[0].requires).toBeUndefined();
  });

  it('binds an outward stat by id, else by its one stat of that name, else stays unresolved (Q24)', () => {
    const carried = throughCard(wren(globalRage));
    const world = (stats: Stat[]): TraitWorld => ({ ...home, stats });
    expect(wounded(bindOwnedTraits(carried, world([S('w-rage', 'Fury')])))[1].id).toBe('w-rage');
    expect(wounded(bindOwnedTraits(carried, world([S('x-rage', 'Rage')])))[1].id).toBe('x-rage');
    expect(wounded(bindOwnedTraits(carried, world([S('a', 'Rage'), S('b', 'Rage')])))[1]).toMatchObject({ id: '', name: 'Rage' });
    // The entity's own stat keeps its id, and a record with no stats binds none.
    expect(wounded(bindOwnedTraits(carried, world([])))[0]).toEqual(inward);
    expect(wounded(bindOwnedTraits(carried, { traits: [], traitGroups: [], entities: [] }))[1].id).toBe('w-rage');
  });

  it('matches a stored name only among the owner’s own stats, so a name every entity shares still binds (Q25)', () => {
    const health = (owner?: StatRequirement['owner']): StatRequirement =>
      ({ kind: 'stat', id: 'old-hp', name: 'Health', operator: '<', value: 20, unit: 'percent', ...(owner ? { owner } : {}) });
    const rows = [{ all: [health({ kind: 'entity', id: 'old-ash', name: 'Ash' }), health({ kind: 'you' }), health()] }];
    const carried: Entity = { id: 'wren', name: 'Wren', persona: true, stats: [S('wren-hp', 'Health')], traits: [T('t-wounded', { name: 'Wounded', requires: rows })] };
    const world: TraitWorld = {
      traits: [], traitGroups: [], statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
      stats: [S('p-hp', 'Health'), S('bp-hp', 'Health', { groupId: 'bp' })],
      entities: [{ id: 'ash', name: 'Ash', stats: [S('ash-hp', 'Health')] }, { id: 'bo', name: 'Bo', stats: [S('bo-hp', 'Health')] }],
    };
    // Q33: You binds among the played entity's stats, never the global Health; no owner is ambiguous.
    expect(wounded(bindOwnedTraits(carried, world)).map((r) => r.id)).toEqual(['ash-hp', 'wren-hp', '']);
    // An entity nobody can play has no You stats to bind, and the global Health stays out of reach.
    const npc = { ...carried, persona: undefined };
    expect(wounded(bindOwnedTraits(npc, world)).map((r) => r.id)).toEqual(['ash-hp', '', '']);
  });

  it('binds You among every playable entity’s stats, and leaves a name two of them share unresolved (Q33)', () => {
    const grit = (owner?: StatRequirement['owner']): StatRequirement =>
      ({ kind: 'stat', id: 'old', name: 'Grit', operator: '<', value: 20, unit: 'percent', ...(owner ? { owner } : {}) });
    const carried: Entity = { id: 'wren', name: 'Wren', traits: [T('t-wounded', { name: 'Wounded', requires: [{ all: [grit({ kind: 'you' })] }] })] };
    const world = (entities: Entity[]): TraitWorld => ({ traits: [], traitGroups: [], statGroups: [], stats: [S('g-grit', 'Grit')], entities });
    const ash: Entity = { id: 'ash', name: 'Ash', persona: true, stats: [S('ash-grit', 'Grit')] };
    expect(wounded(bindOwnedTraits(carried, world([ash]))).map((r) => r.id)).toEqual(['ash-grit']);
    const bo = { id: 'bo', name: 'Bo', customPersona: true, stats: [S('bo-grit', 'Grit')] };
    expect(wounded(bindOwnedTraits(carried, world([ash, bo]))).map((r) => r.id)).toEqual(['']);
  });

  it('compares two copies by their comparisons, so "Rage > 20 and Rage < 80" differs from a changed bound', () => {
    const copy = (...all: Partial<StatRequirement>[]) => comparableOwnedTraits({
      ...wren(), ...portableOwnedTraits({ ...wren(), traits: [T('t-wounded', { requires: [{ all: all.map((c) => ({ ...outward, ...c })) }] })] }, home),
    });
    const between = copy({ operator: '>', value: 20 }, { operator: '<', value: 80 });
    expect(between).toEqual(copy({ operator: '>', value: 20 }, { operator: '<', value: 80 }));
    expect(between).not.toEqual(copy({ operator: '>', value: 20 }, { operator: '>', value: 80 }));
    expect(between).not.toEqual(copy({ operator: '>', value: 20 }, { operator: '<', value: 70 }));
    expect(between).not.toEqual(copy({ operator: '>', value: 20 }, { operator: '<', value: 80, unit: 'percent' }));
  });
});

describe('a stat Condition at setup (Q23)', () => {
  const berserk = T('Berserk', { isDefault: true, requires: [{ all: [{ kind: 'stat', id: 'rage', operator: '>=', value: 80, unit: 'raw' }] }] });
  const world = (rage: Partial<Stat>) => ({ traits: [berserk], traitGroups: [], entities: [], library: [], stats: [S('rage', 'Rage', rage)], statGroups: [] });

  it('starts a stat-gated default against the stat’s authored value, never `starting` (Q8)', () => {
    expect(entryDefaults(world({ value: 85 }), { source: 'none' }).traitIds).toEqual(['Berserk']);
    expect(entryDefaults(world({ value: 40 }), { source: 'none' }).traitIds).toEqual([]);
    expect(entryDefaults(world({ starting: 85, value: 40 }), { source: 'none' }).traitIds).toEqual([]);
  });

  it('reads the requirement line off the stat, and leaves out a hidden stat', () => {
    const line = (rage: Partial<Stat>) => gateLine(gateOf(gateStates(entryGateInput(world(rage), emptyEntryDraft())), null, 'Berserk'));
    expect(line({ starting: 40 })).toBe('Requires Rage >= 80');
    expect(line({ starting: 40, hidden: true })).toBe('Locked');
    expect(line({ starting: 40, enabled: false })).toBe('Locked');
  });
});
