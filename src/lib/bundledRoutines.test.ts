import { describe, it, expect } from 'vitest';
import { placesOf, startReach } from './positionEngine';
import type { Entity, World } from '@/types';

const worlds = import.meta.glob<World>('@/defaultworlds/*.json', { import: 'default', eager: true });
const cases = Object.entries(worlds).map(([path, world]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), world] as const);

/** Every place an entity's Start, rows and Traversable name that travel cannot reach from that Start. */
function unreached(entity: Entity, world: World): string[] {
  const graph = { locations: world.locations ?? [], connections: world.connections ?? [] };
  const names = new Map(graph.locations.map((l) => [l.id, l.name]));
  return (entity.starts ?? []).flatMap((start) => {
    const reach = startReach(start.place, graph);
    const traversable = entity.kind === 'individual' && Array.isArray(entity.traversable) ? entity.traversable : [];
    const named = new Set([start.place, ...start.schedule.flatMap((row) => placesOf(row.action)), ...traversable]);
    return [...named].filter((place) => !reach.has(place)).map((place) => `${entity.name}: ${names.get(place) ?? place}`);
  });
}

describe('bundled world routines', () => {
  it('finds a row place with no path from its Start', () => {
    const place = (id: string) => ({ id, name: id }) as NonNullable<World['locations']>[number];
    const entity = {
      id: 'e', name: 'Walker', kind: 'individual', traversable: ['island'],
      starts: [{ id: 'start-1', place: 'home', weight: 1, schedule: [{ id: 'row-1', time: 'allDay', action: { kind: 'stay', place: 'island' } }] }],
    } as Entity;
    // A two-place map; the rest of World does not bear on reach.
    const world = { locations: [place('home'), place('island')], connections: [], entities: [entity] } as unknown as World;
    expect(unreached(entity, world)).toEqual(['Walker: island']);
  });

  it.each(cases)('%s keeps every Start, row and Traversable place connected to its Start', (_id, world) => {
    expect((world.entities ?? []).flatMap((entity) => unreached(entity, world))).toEqual([]);
  });

  it.each([
    ['drone', ['Rustjaw', 'Ser Halden', 'Old Corwin'], ['Blightspawn']],
    ['emberwatch', ['Albus', 'Sylvie Thornwhistle', 'Corvin Vale', 'Captain Orrin Blackwell'], []],
    ['slime', [], ['Quarantine Watch']],
    ['valentines', ['Coach Daizen', 'Rin Hayama', 'Ren Takeda'], ['The Swarm']],
  ])('%s stores the reviewed kinds', (id, unique, generic) => {
    const world = Object.fromEntries(cases)[id];
    expect(world, id).toBeDefined();
    const kindOf = (name: string) => world.entities?.find((e) => e.name === name)?.kind;
    expect(unique.map(kindOf)).toEqual(unique.map(() => 'individual'));
    expect(generic.map(kindOf)).toEqual(generic.map(() => 'group'));
  });
});
