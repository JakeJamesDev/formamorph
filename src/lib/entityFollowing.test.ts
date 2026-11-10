import { describe, it, expect } from 'vitest';
import type { Connection, Entity, EntityStart, GameLocation, IndividualStates } from '@/types';
import {
  applyEntityCodeWrites, chainEntityWrites, entityMoveIntents, entityMoveLabel, entityMoveOffers, entityMoveOptions, entityMoveSubjects, followersOf,
  joinEntityMoves, movedPositions, NO_ENTITY_MOVES, type FollowerState,
} from './entityFollowing';
import { defaultEntityLocationPrompt } from '@/components/game/GamePrompts';
import { castRoutines } from './entityKind';
import { entitiesInPlay } from './entityPresence';
import { storyMinute } from './gameClock';
import { positionWorld } from './positionPlay';
import type { EntityCodeWrite } from './statCodeExecutor';

// harbor > { inn, square, keep } ; a quay off the square through a one-way Connection ; the gate is top-level.
const place = (id: string, parentId?: string): GameLocation => ({ id, name: id, ...(parentId && { parentId }) });
const LOCATIONS = [place('harbor'), place('inn', 'harbor'), place('square', 'harbor'), place('keep', 'harbor'), place('quay'), place('gate')];
const QUAY: Connection = { id: 'quay', a: 'square', b: 'quay', aToB: {} };
const NOON = storyMinute(4); // 12:00

const start = (place: string, schedule: EntityStart['schedule'] = []): EntityStart => ({ id: `at-${place}`, place, weight: 1, schedule });
const individual = (id: string, starts: EntityStart[], traversable: Entity['traversable'] = []): Entity =>
  ({ id, name: id, kind: 'individual', starts, traversable, locations: [...new Set(starts.map((s) => s.place))] });
const wander = (...places: string[]) => [{
  id: 'w', time: 'allDay' as const, action: { kind: 'wander' as const, places: places.map((p) => ({ place: p, weight: 1 })), idle: 600 },
}];

const corvin = individual('corvin', [start('inn')], 'anywhere'); // a migrated Can Follow
const wenna = individual('wenna', [start('inn')]); // a migrated Stays Put
const tess = individual('tess', [start('inn', wander('inn', 'square', 'quay'))]); // a migrated Moves Between
const clerk = individual('clerk', [start('inn', [{ id: 'shift', time: 'allDay', strict: true, action: { kind: 'stay', place: 'inn' } }])], 'anywhere');
const moths: Entity = {
  id: 'moths', name: 'moths', kind: 'group', locations: ['inn', 'gate'],
  starts: [{ id: 'm1', place: 'inn', weight: 1, schedule: [] }, { id: 'm2', place: 'gate', weight: 1, schedule: [] }],
};
const albus = individual('albus', [start('keep')], 'anywhere');
const CAST = [corvin, wenna, tess, clerk, moths, albus];

const world = (playerAt = 'inn', cast: Entity[] = CAST) => positionWorld(castRoutines(cast), NOON, playerAt, LOCATIONS, [QUAY], () => 0);
const state = (positions: Record<string, string>, follow: string[] = []): FollowerState => ({
  positions,
  individuals: Object.fromEntries(CAST.filter((e) => e.kind === 'individual').map((e) => [e.id, {
    startId: e.starts![0].id, lastRun: NOON, ...(e.id === 'tess' && { rowId: 'w', idleEnd: NOON + 600 }),
    ...(follow.includes(e.id) && { follow: { mode: 'following' as const } }),
  }])) as IndividualStates,
  groups: {},
});
const AT_INN = { corvin: 'inn', wenna: 'inn', tess: 'inn', clerk: 'inn', albus: 'keep' };

describe('who gets an entity location request', () => {
  const subjects = (s: FollowerState, at = 'inn') =>
    entityMoveSubjects(entitiesInPlay(CAST, s), s, at, world(at)).map((e) => e.id);

  it('asks each follower and each Individual here whose row is not Strict', () => {
    // Wenna may go nowhere else, and is still asked: she can come along.
    expect(subjects(state(AT_INN))).toEqual(['corvin', 'wenna', 'tess']);
    expect(subjects(state({ ...AT_INN, albus: 'inn' }, ['albus']))).toEqual(['corvin', 'wenna', 'tess', 'albus']);
  });

  it('never asks a Group or a character on a Strict row', () => {
    const asked = subjects(state(AT_INN));
    expect(['moths', 'clerk'].filter((id) => asked.includes(id))).toEqual([]);
  });

  it('still asks a follower whose row is Strict, since a running follow ignores it', () => {
    expect(subjects(state(AT_INN, ['clerk']))).toContain('clerk');
  });

  it('asks nobody standing elsewhere, and nobody when the player is nowhere', () => {
    expect(subjects(state(AT_INN), 'square')).toEqual([]);
    expect(entityMoveSubjects(CAST, state(AT_INN), undefined, world())).toEqual([]);
  });

  it('never asks a character left waiting', () => {
    const s = state(AT_INN);
    const waiting = { ...s, individuals: { ...s.individuals, corvin: { ...s.individuals.corvin, follow: { mode: 'waiting' as const, until: NOON + 60 } } } };
    expect(subjects(waiting)).toEqual(['wenna', 'tess']);
  });
});

describe('what a request offers', () => {
  const offers = (e: Entity, following = false, s = state(AT_INN)) =>
    entityMoveOffers(e, following, 'inn', s, world(), LOCATIONS, [QUAY]);

  it('offers a follower different replies from a newcomer, and a follower no walk', () => {
    expect(offers(corvin).moves).toEqual(['stay', 'comeAlong']);
    expect(offers(corvin, true)).toEqual({
      moves: ['keepFollowing', 'waitHour', 'waitThisDaypart', 'waitNextDaypart', 'partWays'], destinations: [],
    });
  });

  it('offers walks to its allowed places one travel link away (Q105)', () => {
    // The quay is a row place, but only from the square.
    expect(offers(tess).destinations.map((l) => l.id)).toEqual(['square']);
    // Anywhere allows every neighbor, and no place further off.
    expect(offers(corvin).destinations.map((l) => l.id).sort()).toEqual(['harbor', 'keep', 'square']);
    // An empty Traversable list and an empty schedule allow only where she stands.
    expect(offers(wenna).destinations).toEqual([]);
  });

  it('names every reply the shipped prompt can offer', () => {
    for (const move of [...entityMoveOptions(false), ...entityMoveOptions(true)]) {
      const lead = entityMoveLabel(move, NOON).split(/ about| until/)[0];
      expect(defaultEntityLocationPrompt).toContain(lead);
    }
  });
});

describe('the join of replies to the player move', () => {
  const intents = (over: Partial<typeof NO_ENTITY_MOVES>) => ({ ...NO_ENTITY_MOVES, ...over });

  it('brings followers and "come along" to the new place and leaves the one told to wait waiting', () => {
    const s = state({ ...AT_INN, albus: 'inn' }, ['albus', 'tess']);
    const joined = joinEntityMoves(s, { from: 'inn', to: 'square' }, intents({ wait: [{ id: 'tess', length: 'hour' }], comeAlong: ['corvin'] }), world());
    expect(movedPositions(joined.positions, s.positions)).toEqual({ albus: 'square', corvin: 'square' });
    expect(followersOf(joined)).toEqual(['corvin', 'albus']);
    expect(joined.individuals.tess.follow).toEqual({ mode: 'waiting', until: NOON + 60 });
    expect(joined.positions.tess).toBe('inn');
  });

  it('waits each offered length, never past the end of the next daypart (Q3, Q8)', () => {
    const until = (length: 'hour' | 'thisDaypart' | 'nextDaypart', now = NOON) => {
      const w = positionWorld(castRoutines(CAST), now, 'inn', LOCATIONS, [QUAY], () => 0);
      const joined = joinEntityMoves(state(AT_INN, ['corvin']), { from: 'inn', to: 'square' }, intents({ wait: [{ id: 'corvin', length }] }), w);
      expect(joined.positions.corvin).toBe('inn');
      return (joined.individuals.corvin.follow as { until: number }).until % (24 * 60);
    };
    expect(until('hour')).toBe(13 * 60);
    expect(until('thisDaypart')).toBe(13 * 60);
    expect(until('nextDaypart')).toBe(17 * 60);
    // Across midnight, the longest wait is the end of the daypart after this one.
    expect(until('thisDaypart', 23 * 60 + 30)).toBe(6 * 60);
    expect(until('nextDaypart', 23 * 60 + 30)).toBe(8 * 60);
  });

  it('sends a follower who parts ways back to its routine, in the scene until the player leaves (Q106)', () => {
    const s = state(AT_INN, ['tess']);
    const parted = joinEntityMoves(s, { from: 'inn', to: 'inn' }, intents({ partWays: ['tess'] }), world());
    expect(followersOf(parted)).toEqual([]);
    expect(parted.individuals.tess.follow).toBeUndefined();
    expect(parted.positions.tess).toBe('inn');
    // The player leaves for the gate, which her routine never uses: she stays behind on it.
    const left = joinEntityMoves(parted, { from: 'inn', to: 'gate' }, NO_ENTITY_MOVES, world('gate'));
    expect(left.positions.tess).not.toBe('gate');
    expect(left.individuals.tess.follow).toBeUndefined();
  });

  it('leaves a follower its routine does not allow there waiting where it stood', () => {
    const s = state(AT_INN, ['tess']);
    const joined = joinEntityMoves(s, { from: 'inn', to: 'gate' }, NO_ENTITY_MOVES, world('inn'));
    expect(joined.positions.tess).toBe('inn');
    expect(joined.individuals.tess.follow).toMatchObject({ mode: 'waiting' });
  });

  it('refuses "come along" on a Strict row', () => {
    const joined = joinEntityMoves(state(AT_INN), { from: 'inn', to: 'square' }, intents({ comeAlong: ['clerk'] }), world());
    expect(joined.positions.clerk).toBe('inn');
    expect(followersOf(joined)).toEqual([]);
  });

  it('drops "come along" without a move', () => {
    const joined = joinEntityMoves(state(AT_INN), { from: 'inn', to: 'inn' }, intents({ comeAlong: ['corvin'] }), world());
    expect(followersOf(joined)).toEqual([]);
  });

  it('walks a character only to a place its routine allows', () => {
    const s = state(AT_INN);
    const allowed = joinEntityMoves(s, { from: 'inn', to: undefined }, intents({ goTo: [{ id: 'tess', to: 'square' }, { id: 'wenna', to: 'square' }] }), world());
    expect(allowed.positions).toMatchObject({ tess: 'square', wenna: 'inn' });
  });
});

describe("a script's entity writes", () => {
  const writes = (s: FollowerState, ...list: EntityCodeWrite[]) =>
    applyEntityCodeWrites(s, list, 'inn', world());

  it('makes any Individual follow, past Strict and Traversable, and never a Group', () => {
    const s = writes(state(AT_INN), { entity: 'clerk', kind: 'follow' }, { entity: 'wenna', kind: 'follow' }, { entity: 'moths', kind: 'follow' });
    expect(followersOf(s)).toEqual(['wenna', 'clerk']);
    expect(s.individuals.clerk.follow).toEqual({ mode: 'following', script: true });
    expect('moths' in s.individuals).toBe(false);
  });

  it('leaves a Group where its presences stand on a script follow or move', () => {
    const swarm = { m1: { position: 'inn', lastRun: NOON }, m2: { position: 'gate', lastRun: NOON } };
    const before = { ...state(AT_INN), groups: { moths: swarm } };
    const s = writes(before, { entity: 'moths', kind: 'follow' }, { entity: 'moths', kind: 'move', location: 'keep' });
    expect(s.groups.moths).toEqual(swarm);
    expect('moths' in s.positions || 'moths' in s.individuals).toBe(false);
  });

  it('parts ways on unfollow, leaving the character where it stands', () => {
    const s = writes(state(AT_INN, ['corvin']), { entity: 'corvin', kind: 'unfollow' });
    expect(followersOf(s)).toEqual([]);
    expect(s.positions.corvin).toBe('inn');
  });

  it('ends a follow on move and holds the character there', () => {
    const s = writes(state(AT_INN, ['wenna']), { entity: 'wenna', kind: 'move', location: 'keep' });
    expect(s.positions.wenna).toBe('keep');
    expect(s.individuals.wenna.follow).toBeUndefined();
    expect(s.individuals.wenna.hold).toEqual({ untilScriptMove: true });
  });

  it('lays the writes over the chain for the next script, Groups untouched', () => {
    const next = chainEntityWrites(
      { positions: { corvin: 'keep' }, followers: [], waiting: ['corvin'] },
      [{ entity: 'corvin', kind: 'follow' }, { entity: 'moths', kind: 'follow' }], 'inn', (id) => id !== 'moths',
    );
    expect(next).toEqual({ positions: { corvin: 'inn' }, followers: ['corvin'], waiting: [] });
  });
});

describe('the replies as intents', () => {
  it('keeps only the replies that change anything', () => {
    const intents = entityMoveIntents([
      { entity: corvin, move: 'comeAlong' }, { entity: tess, move: 'waitNextDaypart' }, { entity: wenna, move: 'stay' },
      { entity: albus, move: { goTo: 'keep' } }, { entity: clerk, move: null }, { entity: moths, move: 'partWays' },
    ]);
    expect(intents).toEqual({
      wait: [{ id: 'tess', length: 'nextDaypart' }], partWays: ['moths'], comeAlong: ['corvin'], goTo: [{ id: 'albus', to: 'keep' }],
    });
    expect(entityMoveIntents([{ entity: wenna, move: 'keepFollowing' }])).toBe(NO_ENTITY_MOVES);
  });
});
