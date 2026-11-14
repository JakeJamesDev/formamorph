/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { castCourses } from './entityKind';
import { EMPTY_BOOK, runtimeCourse, startWaiting } from './positionEngine';
import { placeAll, positionWorld, scriptPlaces } from './positionPlay';
import { followersOf } from './entityFollowing';
import { snapshotOf } from './sandboxSnapshot';
import {
  commit, KIND_CAST, KIND_LOCATIONS, NOON, placedBook, reads, start, unique, worldAt, writesOf,
} from '@/test/entityKindFixture';
import type { DiscoveredEntity, Entity } from '@/types';

// The player stands at the keep, away from every Unique entity's place.
const AWAY = 'keep';
const minute = NOON % (24 * 60);

/** Bram keeps the square all day. */
const BRAM = unique('bram', 'Bram', [start('square', [{ id: 'stay', time: 'allDay', action: { kind: 'stay', place: 'square' } }])]);
/** Pell walks the inn and the square. */
const PELL = unique('pell', 'Pell', [start('inn', [{
  id: 'round', time: 'allDay', action: { kind: 'patrol', stops: [{ place: 'inn', idle: 30 }, { place: 'square', idle: 30 }] },
}])]);
/** Nym has a row an hour from now and none at noon: a gap. */
const NYM = unique('nym', 'Nym', [start('inn', [{
  id: 'later', time: { start: (minute + 60) % 1440, end: (minute + 120) % 1440 }, action: { kind: 'stay', place: 'square' },
}])]);
/** Orla's only row stays at the gate, which her Start at the inn cannot reach (Q84). */
const ORLA = unique('orla', 'Orla', [start('inn', [{ id: 'cut', time: 'allDay', action: { kind: 'stay', place: 'gate' } }])]);
/** Known In: nowhere, picked, and the Nearby default. */
const HIDDEN: Entity = { ...unique('hid', 'Hid', [start('inn')]), knownIn: 'nowhere' };
const PICKED: Entity = { ...unique('pik', 'Pik', [start('inn')]), knownIn: ['square', 'gate', 'gone'] };
const PLAIN: Entity = { id: 'plain', name: 'Plain' };
const EMPTY_PICK: Entity = { ...unique('emp', 'Emp', [start('inn')]), knownIn: [] };
const CAST = [...KIND_CAST, BRAM, PELL, NYM, ORLA, HIDDEN, PICKED, PLAIN, EMPTY_PICK];
const WORLD = worldAt(AWAY, NOON, CAST);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const readsIn = (condition: string, book = placedBook(AWAY, CAST)) => reads(book, AWAY, condition, CAST);

describe('kind', () => {
  it('reads unique, generic, and empty for an entity with no kind', async () => {
    expect(await readsIn('entities.Tess.kind === "unique" && entities.Moths.kind === "generic" && entities.Plain.kind === ""')).toBe(true);
  });
});

describe('routine action and hold', () => {
  it('reads the row in force: stay, wander and patrol', async () => {
    expect(await readsIn('entities.Bram.action === "stay" && entities.Tess.action === "wander" && entities.Pell.action === "patrol"')).toBe(true);
    expect(await readsIn('!entities.Bram.held && !entities.Tess.held && !entities.Pell.held')).toBe(true);
  });

  it('reads empty in a gap and on a row whose places cannot be reached', async () => {
    expect(await readsIn('entities.Nym.action === "" && entities.Orla.action === ""')).toBe(true);
  });

  it('reads held with no action in a gap or on an unreachable row after a script move (Q228)', async () => {
    const book = placedBook(AWAY, CAST);
    expect(await readsIn('!entities.Nym.held && !entities.Orla.held', book)).toBe(true);
    const moved = commit(book, await writesOf(book, AWAY, CAST, 'entities.Nym.move("Keep"); entities.Orla.move("Keep");'), AWAY, WORLD);
    expect([moved.uniques.nym.hold, moved.uniques.orla.hold]).toEqual([expect.anything(), expect.anything()]);
    expect(await readsIn('entities.Nym.action === "" && entities.Nym.held && entities.Orla.action === "" && entities.Orla.held', moved)).toBe(true);
  });

  it('reads empty for a Generic entity and an entity with no kind', async () => {
    expect(await readsIn('entities.Moths.action === "" && !entities.Moths.held && entities.Plain.action === ""')).toBe(true);
  });

  it('reads held after a script move, and the row still in force', async () => {
    const book = placedBook(AWAY, CAST);
    const moved = commit(book, await writesOf(book, AWAY, CAST, 'entities.Tess.move("Keep");'), AWAY, WORLD);
    expect(await readsIn('entities.Tess.held && entities.Tess.action === "wander" && !entities.Bram.held', moved)).toBe(true);
  });

  it('reads empty and not held while the entity follows or waits', async () => {
    const book = placedBook(AWAY, CAST);
    const moved = commit(book, await writesOf(book, AWAY, CAST, 'entities.Tess.move("Keep");'), AWAY, WORLD);
    const following = commit(moved, await writesOf(moved, AWAY, CAST, 'entities.Tess.follow(); entities.Bram.follow();'), AWAY, WORLD);
    expect(followersOf(following)).toEqual(expect.arrayContaining(['tess', 'bram']));
    const waiting = { ...following, ...startWaiting(following, 'bram', 'hour', NOON) };
    expect(await readsIn([
      'entities.Tess.following && entities.Tess.action === "" && !entities.Tess.held',
      'entities.Bram.waiting && entities.Bram.action === "" && !entities.Bram.held',
    ].join(' && '), waiting)).toBe(true);
  });
});

describe('a held follower and a held waiting entity', () => {
  // The engine clears a hold on follow, so the hold is set on the state itself: the read must ignore it.
  it('reads not held while it follows or waits, even with a hold on its state (Q228)', async () => {
    const book = placedBook(AWAY, CAST);
    const following = commit(book, await writesOf(book, AWAY, CAST, 'entities.Tess.follow();'), AWAY, WORLD);
    const hold = { until: NOON + 600 };
    const heldFollower = { ...following, uniques: { ...following.uniques, tess: { ...following.uniques.tess, hold } } };
    expect(await readsIn('entities.Tess.following && !entities.Tess.held', heldFollower)).toBe(true);
    const waiting = startWaiting(heldFollower, 'tess', 'hour', NOON);
    expect(waiting.uniques.tess.hold).toEqual(hold);
    expect(await readsIn('entities.Tess.waiting && !entities.Tess.held', waiting)).toBe(true);
  });
});

describe('Known In', () => {
  it('reads nowhere, nearby, and picked with the picked places’ code names', async () => {
    expect(await readsIn([
      'entities.Hid.knownIn === "nowhere" && entities.Hid.knownInPlaces.length === 0',
      'entities.Tess.knownIn === "nearby" && entities.Plain.knownIn === "nearby" && entities.Emp.knownIn === "nearby"',
      'entities.Pik.knownIn === "picked" && entities.Pik.knownInPlaces.join() === "Square,Gate"',
    ].join(' && '))).toBe(true);
  });
});

describe('the four reads are read-only', () => {
  it('drops a write to each, reports it, and reads on as before', async () => {
    expect(await readsIn([
      '(() => { entities.Tess.kind = "generic"; entities.Tess.action = "stay"; entities.Tess.held = true; entities.Pik.knownIn = "nowhere";',
      '  entities.Pik.knownInPlaces = []; try { entities.Pik.knownInPlaces.push("Keep"); } catch {} ; return true; })()',
      '&& entities.Tess.kind === "unique" && entities.Tess.action === "wander" && !entities.Tess.held',
      '&& entities.Pik.knownIn === "picked" && entities.Pik.knownInPlaces.length === 2',
    ].join('\n'))).toBe(true);
    const reported = vi.mocked(console.warn).mock.calls.map(([line]) => String(line)).join('\n');
    for (const path of ['entities.Tess.kind', 'entities.Tess.action', 'entities.Tess.held', 'entities.Pik.knownIn', 'entities.Pik.knownInPlaces']) {
      expect(reported).toContain(path);
    }
  });
});

describe('a runtime character', () => {
  const wren: DiscoveredEntity = { entity: { id: 'wren', name: 'Wren', locations: ['inn'] }, locationId: 'inn', sourceTurnId: 't-1' };
  const cast = [...KIND_CAST, wren.entity];
  const world = positionWorld([...castCourses(KIND_CAST), runtimeCourse(wren)!], NOON, AWAY, KIND_LOCATIONS, [], () => 0);

  it('reads unique, no action from its empty schedule, and held after a script move (Q224, Q228)', async () => {
    const placed = placeAll(EMPTY_BOOK, world);
    const moved = commit(placed, await writesOf(placed, AWAY, cast, 'entities.Wren.move("Square");'), AWAY, world);
    expect(moved.uniques.wren.hold).toBeDefined();
    const owners = { acquired: [], disabledTraitIds: [], appliedValues: {}, entities: KIND_CAST, library: [], discovered: [wren.entity],
      world: { traits: [], groups: [], entities: KIND_CAST, persona: { source: 'none' as const } } };
    const state = { stats: [], enabled: {}, clock: { deltaHours: 0, elapsedHours: 0 }, ownerTraits: owners, ...scriptPlaces(moved, world) };
    const result = await snapshotOf(state)
      .run({ home: { kind: 'tool' }, timing: 'after', code: 'return [entities.Wren.kind, entities.Wren.action, entities.Wren.held];', args: {} });
    expect(result.error).toBeNull();
    expect(JSON.parse(result.reply ?? 'null')).toEqual(['unique', '', true]);
  });

  it('takes a script move and a follow, as a Unique entity does (Q224)', async () => {
    const placed = placeAll(EMPTY_BOOK, world);
    const moved = commit(placed, await writesOf(placed, AWAY, cast, 'entities.Wren.move("Square");'), AWAY, world);
    expect(moved.positions.wren).toBe('square');
    const following = commit(moved, await writesOf(moved, AWAY, cast, 'entities.Wren.follow();'), AWAY, world);
    expect(followersOf(following)).toContain('wren');
  });
});

describe('the played entity', () => {
  it('reads every routine field empty, as persona and as its entities entry (Q224)', async () => {
    const hero: Entity = { ...unique('hero', 'Hero', [start('inn', [{ id: 'st', time: 'allDay', action: { kind: 'stay', place: 'inn' } }])]), knownIn: 'nowhere', persona: true };
    const owners = { acquired: [], disabledTraitIds: [], appliedValues: {}, entities: [hero], library: [],
      world: { traits: [], groups: [], entities: [hero], persona: { source: 'world' as const, entityId: 'hero' } } };
    const state = {
      stats: [], enabled: {}, clock: { deltaHours: 0, elapsedHours: 0 }, ownerTraits: owners,
      routineNow: { hero: { action: 'stay' as const, held: true } },
    };
    const fields = '[x.kind, x.action, x.held, x.knownIn, x.knownInPlaces]';
    const result = await snapshotOf(state).run({
      home: { kind: 'tool' }, timing: 'after', args: {},
      code: `return [persona, entities.Hero].map((x) => ${fields});`,
    });
    expect(result.error).toBeNull();
    expect(JSON.parse(result.reply ?? 'null')).toEqual([['', '', false, '', []], ['', '', false, '', []]]);
  });
});

describe('a stay row and its hold', () => {
  it('reads held after a script move on a stay row, until the stretch ends', async () => {
    const book = placedBook(AWAY, CAST);
    const moved = commit(book, await writesOf(book, AWAY, CAST, 'entities.Bram.move("Inn");'), AWAY, WORLD);
    expect(moved.positions.bram).toBe('inn');
    expect(await readsIn('entities.Bram.held && entities.Bram.action === "stay"', moved)).toBe(true);
  });
});
