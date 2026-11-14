import { describe, expect, it } from 'vitest';
import type { Entity, EntityRoutine, EntityStart, Trait, TraitRequirementRow } from '@/types';
import { diffContent } from './componentUpdates';
import { contentMatchesSource } from './linkedContent';
import { bindOwnedTraits, type TraitWorld } from './portableTraits';

// Library sync of an entity with several Routines: the update review's rows and each Routine's Requires.

const LOCATIONS = [{ id: 'pier', name: 'Pier' }, { id: 'tavern', name: 'Tavern' }];
const start = (id: string, place: string): EntityStart => ({ id, place, weight: 1, schedule: [] });
const futa = (id: string): TraitRequirementRow[] => [{ all: [{ kind: 'trait', id, name: 'Futanari' }] }];

const day: EntityRoutine = { id: 'day', name: 'Day Job', traversable: 'anywhere', starts: [start('d1', 'pier')] };
const night: EntityRoutine = { id: 'night', name: 'Night Life', requires: futa('w-futa'), traversable: ['tavern'], starts: [start('n1', 'tavern')] };

// The library item names its places in refs; the copy's world connected each to its own place of the same id.
const wren = (routines: EntityRoutine[]): Entity => ({ id: 'wren', name: 'Wren', kind: 'unique', routines, locationRefs: LOCATIONS });
const copy = (routines: EntityRoutine[]): Entity =>
  ({ ...wren(routines), link: { libraryId: 'lib-1', sourceRevision: 'r1', connections: { pier: 'pier', tavern: 'tavern' } } });

const WORLD: TraitWorld = {
  traits: [{ id: 'w-futa', name: 'Futanari', statChanges: [] } as Partial<Trait> as Trait],
  traitGroups: [],
  entities: [],
};

describe('the update review of an entity with several Routines', () => {
  it('names each Routine on its rows and shows one the copy lacks against nothing', () => {
    const diff = diffContent(copy([day]), wren([day, night]), undefined, LOCATIONS);
    expect(diff.changed).toEqual([
      { field: 'routines/night/name', label: 'Night Life: Name', current: 'Not set', incoming: 'Night Life' },
      { field: 'routines/night/starts', label: 'Night Life: Starts', current: 'Not set', incoming: 'Start 1 at Tavern' },
      { field: 'routines/night/requires', label: 'Night Life: Requires', current: 'Always', incoming: 'Futanari' },
      { field: 'routines/night/traversable', label: 'Night Life: Can Also Go', current: 'Not set', incoming: 'Tavern' },
    ]);
    expect(diff.unchanged.map((row) => row.label)).toEqual(expect.arrayContaining(['Day Job: Starts', 'Day Job: Requires', 'Day Job: Can Also Go']));
  });

  it('shows a difference only in a later Routine’s Requires as a changed row', () => {
    const changed = { ...night, requires: [{ all: [{ kind: 'trait' as const, id: 'w-futa', name: 'Futanari', not: true as const }] }] };
    const diff = diffContent(copy([day, night]), wren([day, changed]), undefined, LOCATIONS);
    expect(diff.changed).toEqual([
      { field: 'routines/night/requires', label: 'Night Life: Requires', current: 'Futanari', incoming: 'Not Futanari' },
    ]);
  });

  it('shows a renamed Routine as a Name row', () => {
    const diff = diffContent(copy([day, night]), wren([day, { ...night, name: 'Evenings' }]), undefined, LOCATIONS);
    expect(diff.changed).toEqual([
      { field: 'routines/night/name', label: 'Evenings: Name', current: 'Night Life', incoming: 'Evenings' },
    ]);
  });

  it('shows a reorder of the Routines as a Routine Order row', () => {
    const diff = diffContent(copy([day, night]), wren([night, day]), undefined, LOCATIONS);
    expect(diff.changed).toEqual([
      { field: 'routines/order', label: 'Routine Order', current: 'Day Job, Night Life', incoming: 'Night Life, Day Job' },
    ]);
  });

  it('labels a Routine with a blank name by its default name', () => {
    const diff = diffContent(copy([day]), wren([day, { ...night, name: '' }]), undefined, LOCATIONS);
    expect(diff.changed.map((row) => row.label)).toContain('Routine 2: Starts');
  });

  it('keeps the plain rows for one ungated Routine on both sides', () => {
    const diff = diffContent(copy([day]), wren([{ ...day, traversable: ['pier'] }]), undefined, LOCATIONS);
    expect(diff.changed).toEqual([{ field: 'traversable', label: 'Can Also Go', current: 'Anywhere', incoming: 'Pier' }]);
    expect(diff.unchanged.map((row) => row.label)).toContain('Starts');
  });
});

describe('a Routine’s Requires across the library', () => {
  // The library copy names the trait; the world copy holds the world's id for it.
  const library = wren([day, { ...night, requires: futa('') }]);

  it('compares a copy and its library item as equal when their Requires name the same trait', () => {
    expect(contentMatchesSource(wren([day, night]), library, WORLD)).toBe(true);
  });

  it('compares them as different when a Requires names another trait', () => {
    const other = wren([day, { ...night, requires: [{ all: [{ kind: 'trait', id: '', name: 'Female' }] }] }]);
    expect(contentMatchesSource(wren([day, night]), other, WORLD)).toBe(false);
  });

  it('binds a carried Routine’s Requires to the world’s trait by name', () => {
    expect(bindOwnedTraits(library, WORLD).routines?.[1].requires).toEqual(futa('w-futa'));
  });
});
