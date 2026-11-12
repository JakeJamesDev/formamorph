import { describe, expect, it } from 'vitest';
import type { Entity } from '@/types';
import { castRoutines } from './entityKind';
import { idsAt, samplePlacement } from './entityPlaces';
import { EMPTY_BOOK } from './positionEngine';
import { placeAll, positionWorld, reconcileBook, reseatForOpening } from './positionPlay';

import { herd, yardLocations as locations } from '@/test/entityKindFixture';

const world = (now: number, playerAt?: string, cast: Entity[] = [herd]) => positionWorld(castRoutines(cast), now, playerAt, locations, []);
const where = (book: typeof EMPTY_BOOK) => Object.fromEntries(Object.entries(book.generics.herd ?? {}).map(([id, p]) => [id, p.position]));

describe('a Generic entity in play', () => {
  it('stands once at each place a Generic Entity Instance holds', () => {
    const placesOf = samplePlacement([herd], { locations, connections: [] }, 'yard');
    // The opening hour is 08:00, so the grazer is out in the field and the sleeper in the barn.
    expect(idsAt('field', [herd], placesOf)).toEqual(['herd']);
    expect(idsAt('barn', [herd], placesOf)).toEqual(['herd']);
    expect(idsAt('yard', [herd], placesOf)).toEqual([]);
  });

  it('keeps a Generic Entity Instance at the player place where the opening put it when the hour is set, and places the others again', () => {
    const opening = placeAll(EMPTY_BOOK, world(300, 'barn'));
    expect(where(opening)).toEqual({ grazer: 'barn', sleeper: 'barn' });
    expect(where(reseatForOpening(opening, world(600, 'barn')))).toEqual({ grazer: 'barn', sleeper: 'barn' });
    expect(where(reseatForOpening(opening, world(600, 'yard')))).toEqual({ grazer: 'field', sleeper: 'barn' });
  });

  it('starts a Generic Entity Instance away from the player on its Patrol afresh at the real hour, not from the opening hour\'s idle', () => {
    const flock: Entity = {
      id: 'herd', name: 'Flock', kind: 'generic', locations: ['barn', 'field'],
      starts: [{ id: 'grazer', place: 'barn', weight: 1, schedule: [{
        id: 'round', time: 'allDay', action: { kind: 'patrol', stops: [{ place: 'barn', idle: 60 }, { place: 'field', idle: 60 }] },
      }] }],
    };
    const opening = placeAll(EMPTY_BOOK, world(300, 'yard', [flock]));
    expect(where(reseatForOpening(opening, world(600, 'yard', [flock])))).toEqual({ grazer: 'barn' });
  });

  it('sends a Generic Entity Instance at a deleted place where its row puts it, and drops a Generic entity the world lost', () => {
    const saved = { ...EMPTY_BOOK, generics: { herd: { grazer: { position: 'meadow', lastRun: 300 } }, lost: { a: { position: 'barn', lastRun: 300 } } } };
    const book = reconcileBook(saved, world(300));
    expect(where(book)).toEqual({ grazer: 'barn', sleeper: 'barn' });
    expect('lost' in book.generics).toBe(false);
  });

  it('drops the single position and state of a Unique entity the world has since made a Generic entity', () => {
    const saved = { ...EMPTY_BOOK, positions: { herd: 'field' }, uniques: { herd: { startId: 'grazer', lastRun: 300 } } };
    const book = reconcileBook(saved, world(300), ['herd']);
    expect(book.positions).toEqual({});
    expect(book.uniques).toEqual({});
    expect(where(book)).toEqual({ grazer: 'barn', sleeper: 'barn' });
  });
});
