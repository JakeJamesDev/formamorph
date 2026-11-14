import { describe, expect, it } from 'vitest';
import { lockLinePlain, resolveInPlayWorld, startLocationIdsOpen, type InPlayWorld } from './inPlayWorld';
import { walkableDestinationEntries } from './locationContext';
import { startingLocationIn } from './startingLocation';
import { evaluateGates, sameVerdicts } from './inPlayGates';
import { scoped } from './scope';
import type { GateInput } from './traitGates';
import type { Connection, GameLocation, OptionRequirement, TraitRequirementRow, WorldOption } from '@/types';

/**
 * Lock gates in the In-Play World: a failing gate locks its location and every location below it (Q53), the
 * travel gate refuses a move in unless the player already stands inside every lock over the place (Q3, Q53),
 * and the lock line leaves hidden Options out (Q11).
 */

const GATE: WorldOption = { id: 'gate', name: 'Gate Open', type: 'boolean', shownToPlayer: true, midGame: false, default: false };
const SEAL: WorldOption = { id: 'seal', name: 'Seal Broken', type: 'boolean', shownToPlayer: false, midGame: false, default: false };
const open = (id: string): OptionRequirement => ({ kind: 'option', id });
const rows = (...reqs: OptionRequirement[][]): TraitRequirementRow[] => reqs.map((all) => ({ all }));

// Old Town holds the Square, which holds the Well. The Docks stand apart; a quay joins the Docks and the Square,
// and a ferry joins the Docks and the Isle, which a lane joins to the Square.
const L = (id: string, parentId?: string, over: Partial<GameLocation> = {}): GameLocation => ({ id, name: id, ...(parentId && { parentId }), ...over });
const oldTown = L('oldTown', undefined, { unlockedWhen: rows([open('gate')]) });
const square = L('square', 'oldTown');
const well = L('well', 'square');
const docks = L('docks', undefined, { isStarting: true });
const quay: Connection = { id: 'quay', a: 'docks', b: 'square', aToB: {}, bToA: {} };

const input = (values: Record<string, boolean> = {}, over: Partial<GateInput> = {}): GateInput => ({
  global: { traits: [], groups: [] },
  owners: [{ id: 'ash', name: 'Ash', traits: [], groups: [] }],
  active: scoped([], { ash: [] }),
  stats: scoped({}, {}),
  entities: [{ id: 'ash', name: 'Ash', persona: true }],
  persona: { source: 'world', entityId: 'ash' },
  worldOptions: [GATE, SEAL],
  optionValues: values,
  ...over,
});

function play({ locations = [oldTown, square, well, docks], values = {} as Record<string, boolean>, playerAt = 'docks' } = {}): InPlayWorld {
  return resolveInPlayWorld({ entities: [], locations, connections: [quay] }, { playedEntityId: 'ash', playerAt, gate: input(values) });
}
const line = (world: InPlayWorld, id: string) => {
  const found = world.lockLine(id);
  return found && lockLinePlain(found, (text) => `[${text}]`);
};

describe('a location whose Lock gate fails', () => {
  it('stays on and locks with its whole subtree', () => {
    const world = play();
    for (const id of ['oldTown', 'square', 'well']) {
      expect(world.isLocationOn(id)).toBe(true);
      expect(world.isLocked(id)).toBe(true);
    }
    expect(world.isLocked('docks')).toBe(false);
  });

  it('unlocks while a row holds', () => {
    const world = play({ values: { gate: true } });
    for (const id of ['oldTown', 'square', 'well']) expect(world.isLocked(id)).toBe(false);
    expect(world.canEnter('docks', 'well')).toBe(true);
  });

  it('never locks with no rows', () => {
    expect(play({ locations: [L('oldTown', undefined, { unlockedWhen: [] }), docks] }).isLocked('oldTown')).toBe(false);
  });
});

describe('the travel gate', () => {
  it('refuses a move into a locked place or below it from outside', () => {
    const world = play();
    for (const id of ['oldTown', 'square', 'well']) expect(world.canEnter('docks', id)).toBe(false);
    expect(world.canEnter('docks', 'docks')).toBe(true);
  });

  it('lets a player already inside a lock move within it (Q53)', () => {
    const world = play({ playerAt: 'square' });
    expect(world.canEnter('square', 'well')).toBe(true);
    expect(world.canEnter('well', 'oldTown')).toBe(true);
    expect(world.canEnter('square', 'docks')).toBe(true);
  });

  it('still refuses a lock of its own inside the one the player stands in', () => {
    const locked = [oldTown, square, L('well', 'square', { unlockedWhen: rows([open('seal')]) }), docks];
    const world = play({ locations: locked, playerAt: 'square' });
    expect(world.canEnter('square', 'well')).toBe(false);
    expect(world.canEnter(null, 'well')).toBe(false);
  });

  it('refuses a place that is off', () => {
    const world = play({ locations: [L('oldTown', undefined, { enabledWhen: rows([open('gate')]) }), square, docks] });
    expect(world.canEnter('docks', 'oldTown')).toBe(false);
  });
});

describe('the lock line', () => {
  it('names a shown Option the gate reads', () => {
    expect(line(play(), 'oldTown')).toBe('Requires Gate Open is on');
  });

  it('never names a hidden Option, reading "Locked" when nothing else is left (Q11)', () => {
    const sealed = [L('oldTown', undefined, { unlockedWhen: rows([open('seal')]) }), docks];
    expect(line(play({ locations: sealed }), 'oldTown')).toBe('Locked');
    const either = [L('oldTown', undefined, { unlockedWhen: rows([open('seal')], [open('gate')]) }), docks];
    expect(line(play({ locations: either }), 'oldTown')).toBe('Requires Gate Open is on');
  });

  it('gives a child the nearest lock\'s line, and the child\'s own Locked text over it (Q53)', () => {
    expect(line(play(), 'well')).toBe('Requires Gate Open is on');
    const told = [{ ...oldTown, lockedText: 'The gate is barred' }, square, { ...well, lockedText: 'The well is boarded up' }, docks];
    expect(line(play({ locations: told }), 'square')).toBe('[The gate is barred]');
    expect(line(play({ locations: told }), 'well')).toBe('[The well is boarded up]');
  });

  it('is absent on an open place', () => {
    expect(play().lockLine('docks')).toBeNull();
    expect(play({ values: { gate: true } }).lockLine('oldTown')).toBeNull();
  });
});

describe('the router\'s walk under the travel gate (Q54)', () => {
  // The ferry runs Docks → Isle, and a lane runs Isle → Square, so the Square sits on the Isle's route too.
  const isle = L('isle');
  const ferry: Connection = { id: 'ferry', a: 'docks', b: 'isle', aToB: {}, bToA: {} };
  const lane: Connection = { id: 'lane', a: 'square', b: 'isle', aToB: {}, bToA: {} };
  const locations = [oldTown, square, well, docks, isle];
  const reach = (world: InPlayWorld) =>
    walkableDestinationEntries(docks, locations, [quay, ferry, lane], (id) => world.canEnter('docks', id)).map((e) => e.location.id);

  it('offers no locked place, nor any place reached only through one', () => {
    const world = resolveInPlayWorld({ entities: [], locations, connections: [quay, ferry, lane] }, { playedEntityId: 'ash', playerAt: 'docks', gate: input() });
    expect(reach(world)).toEqual(['isle']);
  });

  it('walks through them once unlocked', () => {
    const world = resolveInPlayWorld({ entities: [], locations, connections: [quay, ferry, lane] }, { playedEntityId: 'ash', playerAt: 'docks', gate: input({ gate: true }) });
    expect(reach(world)).toEqual(expect.arrayContaining(['isle', 'square', 'oldTown', 'well']));
  });
});

describe('the new-game start pick (Q12, Q55)', () => {
  const world = (gate: boolean) => ({
    entities: [{ id: 'ash', name: 'Ash' }], locations: [{ ...oldTown, isStarting: true }, square, { ...docks, isStarting: false }],
    options: [{ ...GATE, default: gate }],
  });
  const startOf = (gate: boolean) => {
    const open = startLocationIdsOpen(world(gate), 'ash');
    return startingLocationIn(world(gate).locations, (id) => open.has(id))?.id;
  };

  it('skips a locked starting location for the first open one in tree order', () => {
    expect(startOf(false)).toBe('docks');
  });

  it('starts there once it is unlocked', () => {
    expect(startOf(true)).toBe('oldTown');
  });
});

describe('verdict identity across commits', () => {
  const verdicts = (locations: GameLocation[], values: Record<string, boolean> = {}) =>
    evaluateGates({ entities: [], locations, connections: [quay] }, { playedEntityId: 'ash', playerAt: 'docks', gate: input(values) });

  it('holds while the same places lock for the same reason', () => {
    expect(sameVerdicts(verdicts([oldTown, square, docks]), verdicts([oldTown, square, docks]))).toBe(true);
  });

  it('changes when a lock’s line changes though the same places stay locked', () => {
    const either = [L('oldTown', undefined, { unlockedWhen: rows([open('gate')], [open('seal')]) }), square, docks];
    const shownOnly = [oldTown, square, docks];
    expect(sameVerdicts(verdicts(either), verdicts(shownOnly))).toBe(false);
  });

  it('changes when a lock opens', () => {
    expect(sameVerdicts(verdicts([oldTown, docks]), verdicts([oldTown, docks], { gate: true }))).toBe(false);
  });
});
