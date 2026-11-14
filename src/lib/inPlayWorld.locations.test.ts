import { describe, expect, it } from 'vitest';
import { resolveInPlayWorld } from './inPlayWorld';
import { scoped } from './scope';
import type { GateInput } from './traitGates';
import type { Connection, Entity, GameLocation, Trait, TraitRequirement } from '@/types';
import { withFirstTraversable } from '@/lib/entityKind';
import { oneRoutine } from '@/test/routines';

/**
 * Location Enabled gates in the In-Play World: a failing gate takes its whole subtree (Q2), the player's place
 * stays with its subtree while they stand there (Q10, Q49), and an on entity whose places are all off is
 * stranded: offstage, still running (Q27, Q50).
 */

const T = (id: string): Trait => ({ id, name: id, statChanges: [] });
const night: TraitRequirement = { kind: 'time', dayparts: ['night'] };
const closedAtDay = [{ all: [night] }];

// Old Town holds the Square, which holds the Well. The Docks stand apart; a quay joins the Docks and the Square.
const L = (id: string, parentId?: string, over: Partial<GameLocation> = {}): GameLocation => ({ id, name: id, ...(parentId && { parentId }), ...over });
const oldTown = L('oldTown', undefined, { enabledWhen: closedAtDay });
const square = L('square', 'oldTown');
const well = L('well', 'square');
const docks = L('docks', undefined, { isStarting: true });
const quay: Connection = { id: 'quay', a: 'docks', b: 'square', aToB: {}, bToA: {} };

const member = (id: string, places: string[]): Entity => ({ id, name: id, locations: places });

const input = (over: Partial<GateInput> = {}): GateInput => ({
  global: { traits: [], groups: [] },
  owners: [{ id: 'ash', name: 'Ash', traits: [T('lantern')], groups: [] }],
  active: scoped([], { ash: [] }),
  stats: scoped({}, {}),
  entities: [{ id: 'ash', name: 'Ash', persona: true }],
  persona: { source: 'world', entityId: 'ash' },
  daypart: 'morning',
  ...over,
});

function play({ playerAt = 'docks', entities = [] as Entity[], locations = [oldTown, square, well, docks], over = {} as Partial<GateInput> } = {}) {
  return resolveInPlayWorld({ entities, locations, connections: [quay] }, { playedEntityId: 'ash', playerAt, gate: input(over) });
}
const ids = (list: readonly { id: string }[]) => list.map((x) => x.id);

describe('a location whose Enabled gate fails', () => {
  it('is absent with its whole subtree, and the connections through it break', () => {
    const world = play();
    expect(ids(world.locations)).toEqual(['docks']);
    for (const id of ['oldTown', 'square', 'well']) expect(world.isLocationOn(id)).toBe(false);
    expect(world.connections).toEqual([]);
  });

  it('is back with its subtree while its gate holds', () => {
    const world = play({ over: { daypart: 'night' } });
    expect(ids(world.locations)).toEqual(['oldTown', 'square', 'well', 'docks']);
    expect(ids(world.connections)).toEqual(['quay']);
  });

  it('takes only its own subtree when a child fails', () => {
    const world = play({ locations: [L('oldTown'), L('square', 'oldTown', { enabledWhen: closedAtDay }), well, docks] });
    expect(ids(world.locations)).toEqual(['oldTown', 'docks']);
  });

  it('reads the played persona for a Condition with no owner (Q29)', () => {
    const lit = [L('oldTown', undefined, { enabledWhen: [{ all: [{ kind: 'trait', id: 'lantern' }] }] }), docks];
    expect(play({ locations: lit }).isLocationOn('oldTown')).toBe(false);
    expect(play({ locations: lit, over: { active: scoped([], { ash: ['lantern'] }) } }).isLocationOn('oldTown')).toBe(true);
  });
});

describe('the player standing in an off location', () => {
  it('keeps it and its subtree while they stand there, its ancestors off', () => {
    const world = play({ playerAt: 'square' });
    expect(ids(world.locations)).toEqual(['square', 'well', 'docks']);
    expect(ids(world.connections)).toEqual(['quay']);
  });

  it('moves the exemption with them: deeper in, the place they left is off', () => {
    expect(ids(play({ playerAt: 'well' }).locations)).toEqual(['well', 'docks']);
  });

  it('ends once they leave', () => {
    const before = play({ playerAt: 'oldTown' });
    expect(before.isLocationOn('oldTown')).toBe(true);
    expect(play({ playerAt: 'docks' }).isLocationOn('oldTown')).toBe(false);
  });
});

describe('an on entity whose every place is off', () => {
  const vendor = member('vendor', ['square', 'well']);
  const sailor = member('sailor', ['square', 'docks']);
  const drifter: Entity = { id: 'drifter', name: 'drifter' };

  it('is stranded: offstage, but still in the running cast', () => {
    const world = play({ entities: [vendor, sailor, drifter] });
    expect(ids(world.entities)).toEqual(['sailor', 'drifter']);
    expect(ids(world.runningEntities)).toEqual(['vendor', 'sailor', 'drifter']);
    expect(world.isEntityOn(vendor)).toBe(true);
    expect(world.isEntityOnstage(vendor)).toBe(false);
    expect(world.offEntityIds.has('vendor')).toBe(false);
  });

  it('is onstage while one of its places is on, the player standing there included', () => {
    expect(play({ entities: [vendor], over: { daypart: 'night' } }).isEntityOnstage(vendor)).toBe(true);
    expect(play({ entities: [vendor], playerAt: 'well' }).isEntityOnstage(vendor)).toBe(true);
  });

  it('counts a Unique entity’s routine places, and never one that may go anywhere', () => {
    const watch: Entity = {
      id: 'watch', name: 'watch', kind: 'unique',
      routines: oneRoutine([{ id: 's', place: 'square', weight: 1, schedule: [] }]),
    };
    expect(play({ entities: [watch] }).isEntityOnstage(watch)).toBe(false);
    const roamer: Entity = { ...withFirstTraversable(watch, 'anywhere'), id: 'roamer' };
    expect(play({ entities: [roamer] }).isEntityOnstage(roamer)).toBe(true);
  });
});
