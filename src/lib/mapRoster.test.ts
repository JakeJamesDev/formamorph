import { describe, expect, it } from 'vitest';
import type { Connection, Entity } from '@/types';
import { computePresence, type PresenceInput } from './presence';
import { mapRoster } from './mapRoster';

const entity = (id: string, name: string, extra: Partial<Entity> = {}): Entity => ({ id, name, ...extra });

// The player stands at the market. The keep is a sibling (implicit link), the gate has a Connection with no
// distance, the tower has a Far Connection, and the moor links to nothing.
const LOCATIONS = [
  { id: 'town', parentId: null }, { id: 'market', parentId: 'town' }, { id: 'keep', parentId: 'town' },
  { id: 'gate', parentId: null }, { id: 'tower', parentId: null }, { id: 'moor', parentId: null },
];
const CONNECTIONS: Connection[] = [
  { id: 'c1', a: 'market', b: 'gate', aToB: {} },
  { id: 'c2', a: 'market', b: 'tower', aToB: {}, distance: 'far' },
];

/** The roster of a state where the player stands at `at`, built from the full presence. */
const rosterOf = (input: Partial<PresenceInput>, at: string | null = 'market') => mapRoster(
  computePresence({
    entities: [], runtime: [], positions: {}, generics: {}, followers: [], locationId: at, locations: LOCATIONS,
    connections: CONNECTIONS, persona: null, met: [], strangerAliases: {}, turns: [], ...input,
  }).byId.values(),
  at, LOCATIONS, CONNECTIONS,
);

const spy = (id: string, at: string, extra: Partial<Entity> = {}) =>
  entity(id, `True ${id}`, { strangerName: `a hooded ${id}`, locations: [at], ...extra });

describe('mapRoster', () => {
  it.each([
    ['the player’s place', 'market'],
    ['a place Nearby by implicit link', 'keep'],
    ['a place Nearby by a Connection with no distance', 'gate'],
  ])('shows an unmet stranger under its label in %s', (_, at) => {
    expect(rosterOf({ entities: [spy('a', at)] })).toEqual({ [at]: { named: ['a hooded a'], unknown: 0 } });
  });

  it('prefers the latest alias over the Stranger Name', () => {
    expect(rosterOf({ entities: [spy('a', 'market')], strangerAliases: { a: 'the tall one' } }))
      .toEqual({ market: { named: ['the tall one'], unknown: 0 } });
  });

  it.each([
    ['a place reached only by a Far Connection', 'tower'],
    ['a place with no link', 'moor'],
  ])('counts an unmet stranger as one unknown in %s', (_, at) => {
    expect(rosterOf({ entities: [spy('a', at)] })).toEqual({ [at]: { named: [], unknown: 1 } });
  });

  it('counts a stranger with no label as unknown in every place, Nearby ones included', () => {
    const blank = (id: string, at: string) => entity(id, `True ${id}`, { strangerName: '', locations: [at] });
    const roster = rosterOf({ entities: [blank('a', 'market'), blank('b', 'keep'), blank('c', 'gate'), blank('d', 'moor')] });
    expect(roster).toEqual({
      market: { named: [], unknown: 1 }, keep: { named: [], unknown: 1 },
      gate: { named: [], unknown: 1 }, moor: { named: [], unknown: 1 },
    });
  });

  it('shows a met entity, and an unmet one with no Stranger Name, under the true name everywhere', () => {
    const met = entity('met', 'Bram', { strangerName: 'a hooded man', locations: ['moor'] });
    const plain = entity('plain', 'Old Hesk', { locations: ['tower'] });
    expect(rosterOf({ entities: [met, plain], met: ['met'] })).toEqual({
      moor: { named: ['Bram'], unknown: 0 }, tower: { named: ['Old Hesk'], unknown: 0 },
    });
  });

  it('never shows a stranger’s true name before it is met', () => {
    const roster = rosterOf({ entities: [spy('a', 'market'), spy('b', 'moor')] });
    expect(JSON.stringify(roster)).not.toContain('True');
  });

  it('counts a Generic entity at each place an instance stands', () => {
    const crowd = entity('crowd', 'Townsfolk');
    const roster = rosterOf({
      entities: [crowd],
      generics: { crowd: { s1: { position: 'market', lastRun: 0 }, s2: { position: 'moor', lastRun: 0 } } },
    });
    expect(roster).toEqual({ market: { named: ['Townsfolk'], unknown: 0 }, moor: { named: ['Townsfolk'], unknown: 0 } });
  });

  it('orders true names before stranger labels', () => {
    const roster = rosterOf({ entities: [spy('a', 'market'), entity('bram', 'Bram', { locations: ['market'] })] });
    expect(roster.market.named).toEqual(['Bram', 'a hooded a']);
  });

  it('numbers a repeated entry, each still counting once', () => {
    const guard = (id: string) => entity(id, `True ${id}`, { strangerName: 'a gate guard', locations: ['market'] });
    expect(rosterOf({ entities: [guard('a'), guard('b')] }).market).toEqual({ named: ['a gate guard', 'a gate guard (2)'], unknown: 0 });
  });

  it('counts every unknown entry at a place apart from the named ones', () => {
    const roster = rosterOf({ entities: [spy('a', 'moor'), spy('b', 'moor'), entity('bram', 'Bram', { locations: ['moor'] })] });
    expect(roster.moor).toEqual({ named: ['Bram'], unknown: 2 });
  });

  it('has no reach with no current place: strangers are unknown, met entities keep their names', () => {
    const met = entity('met', 'Bram', { locations: ['market'] });
    expect(rosterOf({ entities: [spy('a', 'market'), met] }, null)).toEqual({ market: { named: ['Bram'], unknown: 1 } });
  });

  it('places a runtime character where it was met', () => {
    const fishwife = entity('fish', 'Fishwife', { locations: ['market'] });
    expect(rosterOf({ runtime: [fishwife] })).toEqual({ market: { named: ['Fishwife'], unknown: 0 } });
  });
});
