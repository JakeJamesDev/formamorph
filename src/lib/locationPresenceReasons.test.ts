import { describe, it, expect } from 'vitest';
import type { Entity } from '@/types';
import { daypartEnd, daypartStart } from '@/lib/routineTime';
import { presenceLines } from './locationPresenceReasons';

const DAY = { start: daypartStart('morning'), end: daypartEnd('afternoon') };
const NIGHT = { start: daypartStart('evening'), end: daypartEnd('night') };

const crowd: Entity = {
  id: 'crowd', name: 'Crowd', kind: 'generic', locations: ['tavern', 'market'], starts: [{ id: 's1', place: 'tavern', weight: 1, schedule: [] }, { id: 's2', place: 'market', weight: 1, schedule: [] }],
};
const moths: Entity = { id: 'moths', name: 'Moths', kind: 'generic', locations: ['market'], starts: [{ id: 's1', place: 'market', weight: 1, schedule: [] }] };

/** Begins at the smithy or the tavern (3:1); works the smithy by day, wanders the tavern and the yard at night;
 *  may be led to the cellar. */
const farrier: Entity = {
  id: 'farrier', name: 'Farrier', kind: 'unique', traversable: ['cellar'],
  locations: ['smithy', 'tavern', 'yard', 'cellar'],
  starts: [
    { id: 's1', place: 'smithy', weight: 3, schedule: [
      { id: 'day', time: DAY, action: { kind: 'stay', place: 'smithy' } },
      { id: 'night', time: NIGHT, action: { kind: 'wander', places: [{ place: 'tavern', weight: 1 }, { place: 'yard', weight: 1 }], idle: 60 } },
    ] },
    { id: 's2', place: 'tavern', weight: 1, schedule: [] },
  ],
};

/** One Start, a patrol of the tavern at all hours, free to go anywhere. */
const guard: Entity = {
  id: 'guard', name: 'Guard', kind: 'unique', traversable: 'anywhere', locations: ['gate', 'tavern'],
  starts: [{ id: 'g1', place: 'gate', weight: 1, schedule: [
    { id: 'round', time: 'allDay', action: { kind: 'patrol', stops: [{ place: 'gate', idle: 30 }, { place: 'tavern', idle: 30 }] } },
  ] }],
};

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
    const flock: Entity = { id: 'flock', name: 'Flock', kind: 'generic', starts: [
      { id: 'a', place: 'tavern', weight: 1, schedule: [rows('r1')] }, { id: 'b', place: 'tavern', weight: 3, schedule: [rows('r2')] },
    ] };
    expect(presenceLines('tavern', [flock])[0].reasons).toEqual(['begins here', 'stays here (Morning – Afternoon)']);
  });

  it('lists a Generic entity that only patrols through the place, with the row’s time and no begins line', () => {
    const patrol: Entity = { id: 'watch', name: 'Watch', kind: 'generic', starts: [{ id: 'w1', place: 'gate', weight: 1, schedule: [
      { id: 'p', time: NIGHT, action: { kind: 'patrol', stops: [{ place: 'gate', idle: 30 }, { place: 'tavern', idle: 30 }] } },
    ] }] };
    expect(presenceLines('tavern', [patrol])[0].reasons).toEqual(['patrols here (Evening – Night)']);
  });

  it('gives a Generic entity no can-be-led-here line', () => {
    const led: Entity = { ...crowd, traversable: ['cellar'] };
    expect(presenceLines('cellar', [led])).toEqual([]);
  });

  it('leaves out a Generic entity no Start or row names at the place', () => {
    expect(reasonsAt('smithy').moths).toBeUndefined();
  });

  it('gives the chance of a Start when the entity has several', () => {
    expect(reasonsAt('smithy').farrier).toEqual(['begins here (75%)', 'stays here (Morning – Afternoon)']);
  });

  it('sums the weights of Starts at the same place and shows each distinct row once', () => {
    const twin: Entity = { ...farrier, starts: [
      { ...farrier.starts![0], id: 'a', weight: 1 }, { ...farrier.starts![0], id: 'b', weight: 1 },
    ] };
    expect(presenceLines('smithy', [twin])[0].reasons).toEqual(['begins here (100%)', 'stays here (Morning – Afternoon)']);
  });

  it('shows no chance for an entity with one Start', () => {
    expect(reasonsAt('gate').guard[0]).toBe('begins here');
  });

  it('puts every reason of one entity on one line, in the order begins, rows, led', () => {
    const lines = presenceLines('tavern', [{ ...farrier, traversable: ['tavern'] }]);
    expect(lines).toHaveLength(1);
    expect(lines[0].reasons).toEqual(['begins here (25%)', 'wanders here (Evening – Night)', 'can be led here']);
  });

  it('names Wander and Patrol rows', () => {
    expect(reasonsAt('yard').farrier).toEqual(['wanders here (Evening – Night)']);
    expect(reasonsAt('tavern').guard).toEqual(['patrols here (All day)']);
  });

  it('words an All-day row beside timed rows as the rest of the day', () => {
    const shift: Entity = { ...guard, starts: [{ id: 'g1', place: 'gate', weight: 1, schedule: [
      { id: 'day', time: DAY, action: { kind: 'stay', place: 'gate' } },
      { id: 'rest', time: 'allDay', action: { kind: 'patrol', stops: [{ place: 'tavern', idle: 30 }] } },
    ] }] };
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
});
