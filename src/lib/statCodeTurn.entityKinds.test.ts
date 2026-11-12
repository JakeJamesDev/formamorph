/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { placeAll } from './positionPlay';
import { startFollowing } from './positionEngine';
import { followersOf } from './entityFollowing';
import {
  CLERK, commit, KIND_CAST, MOTHS, NOON, placedBook, reads, TESS, WENNA, worldAt, writesOf,
} from '@/test/entityKindFixture';

// The cast stands at the inn and the gate, so a player at the keep is away from every Unique entity.
const AWAY = 'keep';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('a script move on a Unique entity with a schedule', () => {
  it('holds the entity at the place, then the schedule takes over again when the hold ends (Q53, Q90, Q98)', async () => {
    // The player stands at the gate: nobody leaves a scene the player is in, so the keep would pause her.
    const book = placedBook('gate');
    expect(book.positions.tess).toBe('inn');
    const writes = await writesOf(book, 'gate', KIND_CAST, 'entities.Tess.move("Keep");');
    expect(writes?.entities).toEqual([{ entity: 'tess', kind: 'move', location: 'keep' }]);

    const held = commit(book, writes, 'gate');
    expect(held.positions.tess).toBe('keep');
    const release = (held.uniques.tess.hold as { until: number }).until;
    expect(release).toBeGreaterThan(NOON);

    // Until the hold ends the schedule does not move her; the keep is no place her row uses.
    expect(placeAll(held, worldAt('gate', release - 1)).positions.tess).toBe('keep');
    const after = placeAll(held, worldAt('gate', release + 1));
    expect(['inn', 'square']).toContain(after.positions.tess);
    expect(after.uniques.tess.hold).toBeUndefined();
  });

  it('ends a follow on a script move and holds the entity at the place', async () => {
    const book = placedBook(AWAY);
    const following = commit(book, await writesOf(book, AWAY, KIND_CAST, 'entities.Wenna.follow();'), AWAY);
    const writes = await writesOf(following, AWAY, KIND_CAST, 'entities.Wenna.move("Square");');
    const moved = commit(following, writes, AWAY);
    expect(followersOf(moved)).toEqual([]);
    expect(moved.positions.wenna).toBe('square');
    expect(moved.uniques.wenna.hold).toBeDefined();
  });
});

describe('a script follow on a Unique entity inside a locked row', () => {
  it('makes the entity follow past the Strict row, and it stands where the player does', async () => {
    const book = placedBook('inn');
    // Clerk is on a Strict all-day shift at the inn, where the player stands. Its Can Also Go is empty, so the square is outside it.
    expect(book.positions.clerk).toBe('inn');
    const writes = await writesOf(book, 'inn', KIND_CAST, 'entities.Clerk.follow();');
    expect(writes?.entities).toEqual([{ entity: 'clerk', kind: 'follow' }]);

    const followed = commit(book, writes, 'square', worldAt('square'));
    expect(followersOf(followed)).toEqual(['clerk']);
    expect(followed.uniques.clerk.follow).toEqual({ mode: 'following', script: true });
    expect(followed.positions.clerk).toBe('square');
    expect(await reads(followed, 'square', 'entities.Clerk.following && entities.Clerk.location === "Square"')).toBe(true);
  });

  it('is refused for an ordinary follow on the same row, so the script follow passed it on purpose', () => {
    const book = placedBook('inn');
    const world = worldAt('inn');
    const routine = world.uniques.get(CLERK.id)!;
    expect(followersOf(startFollowing(book, routine, world.scene))).toEqual([]);
    expect(followersOf(startFollowing(book, routine, world.scene, { script: true }))).toEqual(['clerk']);
  });
});

describe('script move and follow on a Generic entity', () => {
  it.each([
    ['move', 'entities.Moths.move("Keep");'],
    ['follow', 'entities.Moths.follow();'],
    ['unfollow', 'entities.Moths.unfollow();'],
  ])('%s changes nothing: no position, no follower, the Generic Entity Instances keep their places', async (kind, code) => {
    const book = placedBook(AWAY);
    const writes = await writesOf(book, AWAY, KIND_CAST, code);
    expect(writes?.entities?.map((w) => w.kind)).toEqual([kind]);

    const after = commit(book, writes, AWAY);
    expect(after.generics).toEqual(book.generics);
    expect(after.positions).toEqual(book.positions);
    expect(after.uniques).toEqual(book.uniques);
    expect(await reads(after, AWAY, '!entities.Moths.following && entities.Moths.location === ""')).toBe(true);
  });

});

describe('location and present for each kind of entity', () => {
  it('reads a Unique entity at its own position, and lists it there only', async () => {
    const book = placedBook(AWAY);
    expect(await reads(book, AWAY, 'entities.Wenna.location === "Inn"')).toBe(true);
    expect(await reads(book, AWAY, 'locations.Inn.present.some((e) => e.name === "Wenna")')).toBe(true);
    expect(await reads(book, AWAY, 'locations.Square.present.some((e) => e.name === "Wenna")')).toBe(false);
  });

  it('reads a follower at the player’s location, and lists it there instead of where it began', async () => {
    const book = placedBook(AWAY);
    const followed = commit(book, await writesOf(book, AWAY, KIND_CAST, 'entities.Wenna.follow();'), AWAY);
    expect(await reads(followed, AWAY, 'entities.Wenna.location === "Keep"')).toBe(true);
    expect(await reads(followed, AWAY, 'locations.Keep.present.some((e) => e.name === "Wenna")')).toBe(true);
    expect(await reads(followed, AWAY, 'locations.Inn.present.some((e) => e.name === "Wenna")')).toBe(false);
  });

  it('reads a Generic entity with an empty location, and lists it at each place it stands', async () => {
    const book = placedBook(AWAY);
    expect(await reads(book, AWAY, 'entities.Moths.location === ""')).toBe(true);
    expect(await reads(book, AWAY, 'locations.Inn.present.some((e) => e.name === "Moths")')).toBe(true);
    expect(await reads(book, AWAY, 'locations.Gate.present.some((e) => e.name === "Moths")')).toBe(true);
    expect(await reads(book, AWAY, 'locations.Square.present.some((e) => e.name === "Moths")')).toBe(false);
  });

  it('reads a Generic entity at the places its Generic Entity Instances have moved to, not at the places it lists', async () => {
    const book = placedBook(AWAY);
    const moved = { ...book, generics: { moths: { m1: { ...book.generics.moths.m1, position: 'square' }, m2: book.generics.moths.m2 } } };
    expect(await reads(moved, AWAY, 'locations.Square.present.some((e) => e.name === "Moths")')).toBe(true);
    expect(await reads(moved, AWAY, 'locations.Inn.present.some((e) => e.name === "Moths")')).toBe(false);
  });

  it('with no Position, stands an entity with a kind nowhere, though its routine names places (Q10)', async () => {
    const cast = [WENNA, MOTHS, TESS];
    expect(await reads(undefined, 'gate', 'entities.Wenna.location === "" && !locations.Inn.present.some((e) => e.name === "Wenna")', cast)).toBe(true);
    expect(await reads(undefined, 'gate', 'locations.Inn.present.some((e) => e.name === "Moths") || locations.Gate.present.some((e) => e.name === "Moths")', cast)).toBe(false);
  });
});
