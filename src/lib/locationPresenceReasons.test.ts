import { describe, it, expect } from 'vitest';
import { PLAYER_START, type Connection, type Entity, type GameLocation } from '@/types';
import { daypartEnd, daypartStart } from '@/lib/routineTime';
import type { PlacesWorld } from '@/lib/entityPlaces';
import { presenceLines as linesIn } from './locationPresenceReasons';
import { startsOf, withFirstTraversable, withFirstStarts } from '@/lib/entityKind';
import { oneRoutine } from '@/test/routines';

const DAY = { start: daypartStart('morning'), end: daypartEnd('afternoon') };
const NIGHT = { start: daypartStart('evening'), end: daypartEnd('night') };

const crowd: Entity = {
  id: 'crowd', name: 'Crowd', kind: 'generic', locations: ['tavern', 'market'], routines: oneRoutine([{ id: 's1', place: 'tavern', weight: 1, schedule: [] }, { id: 's2', place: 'market', weight: 1, schedule: [] }]),
};
const moths: Entity = { id: 'moths', name: 'Moths', kind: 'generic', locations: ['market'], routines: oneRoutine([{ id: 's1', place: 'market', weight: 1, schedule: [] }]) };

/** Begins at the smithy or the tavern (3:1); works the smithy by day, wanders the tavern and the yard at night;
 *  may be led to the cellar. */
const farrier: Entity = {
  id: 'farrier', name: 'Farrier', kind: 'unique',
  locations: ['smithy', 'tavern', 'yard', 'cellar'],
  routines: oneRoutine([
    { id: 's1', place: 'smithy', weight: 3, schedule: [
      { id: 'day', time: DAY, action: { kind: 'stay', place: 'smithy' } },
      { id: 'night', time: NIGHT, action: { kind: 'wander', places: [{ place: 'tavern', weight: 1 }, { place: 'yard', weight: 1 }], idle: 60 } },
    ] },
    { id: 's2', place: 'tavern', weight: 1, schedule: [] },
  ], ['cellar']),
};

/** One Start, a patrol of the tavern at all hours, free to go anywhere. */
const guard: Entity = {
  id: 'guard', name: 'Guard', kind: 'unique', locations: ['gate', 'tavern'],
  routines: oneRoutine([{ id: 'g1', place: 'gate', weight: 1, schedule: [
    { id: 'round', time: 'allDay', action: { kind: 'patrol', stops: [{ place: 'gate', idle: 30 }, { place: 'tavern', idle: 30 }] } },
  ] }], 'anywhere'),
};

// Every place hangs off the tavern by road, so every row reaches; the island is linked to nothing.
const PLACES = ['tavern', 'market', 'smithy', 'yard', 'cellar', 'gate', 'island'];
const road = (b: string): Connection => ({ id: `tavern-${b}`, a: 'tavern', b, aToB: {}, bToA: {} });
const WORLD: PlacesWorld = {
  locations: PLACES.map((id): GameLocation => ({ id, name: id })),
  connections: PLACES.filter((id) => id !== 'tavern' && id !== 'island').map(road),
};
const presenceLines = (place: string, entities: Entity[], world = WORLD) => linesIn(place, entities, world);

const persona: Entity = { id: 'me', name: 'Me', customPersona: true, locations: ['tavern'] };
const cast = [crowd, moths, farrier, guard, persona];
const reasonsAt = (place: string) => Object.fromEntries(presenceLines(place, cast).map((l) => [l.entity.id, l.reasons]));

describe('presenceLines', () => {
  it('lists a Generic entity once where a Start begins, with no chance however many Starts it has', () => {
    expect(reasonsAt('market')).toEqual({ crowd: ['begins here'], moths: ['begins here'] });
    expect(reasonsAt('tavern').crowd).toEqual(['begins here']);
  });

  it('merges the Starts of a Generic entity beginning here into one begins-here line and one line per distinct row', () => {
    const rows = (id: string) => ({ id, time: DAY, action: { kind: 'stay' as const, place: 'tavern' } });
    const flock: Entity = { id: 'flock', name: 'Flock', kind: 'generic', routines: oneRoutine([
      { id: 'a', place: 'tavern', weight: 1, schedule: [rows('r1')] }, { id: 'b', place: 'tavern', weight: 3, schedule: [rows('r2')] },
    ]) };
    expect(presenceLines('tavern', [flock])[0].reasons).toEqual(['begins here', 'stays here (Morning – Afternoon)']);
  });

  it('lists a Generic entity that only patrols through the place, with the row’s time and no begins line', () => {
    const patrol: Entity = { id: 'watch', name: 'Watch', kind: 'generic', routines: oneRoutine([{ id: 'w1', place: 'gate', weight: 1, schedule: [
      { id: 'p', time: NIGHT, action: { kind: 'patrol', stops: [{ place: 'gate', idle: 30 }, { place: 'tavern', idle: 30 }] } },
    ] }]) };
    expect(presenceLines('tavern', [patrol])[0].reasons).toEqual(['patrols here (Evening – Night)']);
  });

  it('gives a Generic entity no can-be-led-here line', () => {
    const led: Entity = withFirstTraversable(crowd, ['cellar']);
    expect(presenceLines('cellar', [led])).toEqual([]);
  });

  it('leaves out a Generic entity no Start or row names at the place', () => {
    expect(reasonsAt('smithy').moths).toBeUndefined();
  });

  it('gives the chance of a Start when the entity has several', () => {
    expect(reasonsAt('smithy').farrier).toEqual(['begins here (75%)', 'stays here (Morning – Afternoon)']);
  });

  it('sums the weights of Starts at the same place and shows each distinct row once', () => {
    const twin: Entity = withFirstStarts(farrier, [
      { ...startsOf(farrier)[0], id: 'a', weight: 1 }, { ...startsOf(farrier)[0], id: 'b', weight: 1 },
    ]);
    expect(presenceLines('smithy', [twin])[0].reasons).toEqual(['begins here (100%)', 'stays here (Morning – Afternoon)']);
  });

  it('shows no chance for an entity with one Start', () => {
    expect(reasonsAt('gate').guard[0]).toBe('begins here');
  });

  it('puts every reason of one entity on one line, in the order begins, rows, led', () => {
    const lines = presenceLines('tavern', [withFirstTraversable(farrier, ['tavern'])]);
    expect(lines).toHaveLength(1);
    expect(lines[0].reasons).toEqual(['begins here (25%)', 'wanders here (Evening – Night)', 'can be led here']);
  });

  it('names Wander and Patrol rows', () => {
    expect(reasonsAt('yard').farrier).toEqual(['wanders here (Evening – Night)']);
    expect(reasonsAt('tavern').guard).toEqual(['patrols here (All day)']);
  });

  it('words an All-day row beside timed rows as the rest of the day', () => {
    const shift: Entity = { ...withFirstStarts(guard, [{ id: 'g1', place: 'gate', weight: 1, schedule: [
      { id: 'day', time: DAY, action: { kind: 'stay', place: 'gate' } },
      { id: 'rest', time: 'allDay', action: { kind: 'patrol', stops: [{ place: 'tavern', idle: 30 }] } },
    ] }]) };
    expect(presenceLines('tavern', [shift])[0].reasons).toEqual(['patrols here (The rest of the day)']);
  });

  it('lists a Traversable place as can be led here', () => {
    expect(reasonsAt('cellar')).toEqual({ farrier: ['can be led here'] });
  });

  it('gives Traversable = Anywhere no reason of its own', () => {
    expect(reasonsAt('cellar').guard).toBeUndefined();
    expect(reasonsAt('yard').guard).toBeUndefined();
  });

  it('leaves out an entity with no kind', () => {
    expect(reasonsAt('tavern').me).toBeUndefined();
  });

  it('keeps the order of the entities given', () => {
    expect(presenceLines('tavern', [guard, crowd]).map((l) => l.entity.id)).toEqual(['guard', 'crowd']);
  });

  describe('an entity that begins at Player’s Starting Location', () => {
    const follower: Entity = { id: 'follower', name: 'Follower', kind: 'unique', routines: oneRoutine([{ id: 'f1', place: PLAYER_START, weight: 1, schedule: [] }], []) };
    const flagged = (...ids: string[]): PlacesWorld => ({
      ...WORLD, locations: WORLD.locations.map((l) => (ids.includes(l.id) ? { ...l, isStarting: true } : l)),
    });

    it('begins at each flagged starting location and nowhere else', () => {
      const world = flagged('market', 'gate');
      const listing = PLACES.filter((place) => presenceLines(place, [follower], world).length);
      expect(listing).toEqual(['market', 'gate']);
      expect(presenceLines('market', [follower], world)[0].reasons).toEqual(['begins here']);
    });

    it('begins at every location when none is flagged', () => {
      for (const place of PLACES) expect(presenceLines(place, [follower])[0]?.reasons, place).toEqual(['begins here']);
    });

    const split: Entity = withFirstStarts(follower, [startsOf(follower)[0], { id: 'f2', place: 'smithy', weight: 3, schedule: [] }]);

    it('gives the chance of that Start among the others with one starting location', () => {
      expect(presenceLines('market', [split], flagged('market'))[0].reasons).toEqual(['begins here (25%)']);
    });

    it('adds no chance where it stands for several places', () => {
      expect(presenceLines('market', [split], flagged('market', 'smithy'))[0].reasons).toEqual(['begins here']);
      expect(presenceLines('smithy', [split], flagged('market', 'smithy'))[0].reasons).toEqual(['begins here (75%)']);
    });

    it('adds no chance with no location flagged', () => {
      expect(presenceLines('market', [split])[0].reasons).toEqual(['begins here']);
      expect(presenceLines('smithy', [split])[0].reasons).toEqual(['begins here (75%)']);
    });

    it('keeps every row place of that Start, linked or not', () => {
      const roamer: Entity = { ...withFirstStarts(follower, [{ ...startsOf(follower)[0], schedule: [
        { id: 'r', time: NIGHT, action: { kind: 'stay', place: 'island' } },
      ] }]) };
      expect(presenceLines('island', [roamer], flagged('market'))[0].reasons).toEqual(['stays here (Evening – Night)']);
    });
  });

  it('gives no line for a row place with no path from its Start', () => {
    const sailor: Entity = { id: 'sailor', name: 'Sailor', kind: 'unique', routines: oneRoutine([{ id: 's', place: 'tavern', weight: 1, schedule: [
      { id: 'r', time: NIGHT, action: { kind: 'stay', place: 'island' } },
    ] }], []) };
    expect(presenceLines('island', [sailor])).toEqual([]);
    expect(presenceLines('tavern', [sailor])[0].reasons).toEqual(['begins here']);
  });
});
