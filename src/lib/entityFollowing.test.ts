import { describe, it, expect } from 'vitest';
import type { Connection, Entity, EntityStart, GameLocation, IndividualStates } from '@/types';
import {
  applyEntityCodeWrites, chainEntityWrites, ENTITY_MOVE_LABELS, entityMoveIntents, entityMoveOffers, entityMoveSubjects, followersOf,
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
const moths: Entity = { id: 'moths', name: 'moths', kind: 'group', locations: ['inn', 'gate'] };
const albus = individual('albus', [start('keep')], 'anywhere');
const CAST = [corvin, wenna, tess, clerk, moths, albus];

const world = (playerAt = 'inn', cast: Entity[] = CAST) => positionWorld(castRoutines(cast), NOON, playerAt, LOCATIONS, [QUAY], () => 0);
const state = (positions: Record<string, string>, follow: string[] = []): FollowerState => ({
  positions,
  individuals: Object.fromEntries(CAST.filter((e) => e.kind === 'individual').map((e) => [e.id, {
    startId: e.starts![0].id, lastRun: NOON, ...(e.id === 'tess' && { rowId: 'w', idleEnd: NOON + 600 }),
    ...(follow.includes(e.id) && { follow: { mode: 'following' as const } }),
  }])) as IndividualStates,
});
const AT_INN = { corvin: 'inn', wenna: 'inn', tess: 'inn', clerk: 'inn', albus: 'keep' };

describe('who gets an entity location request', () => {
  const subjects = (s: FollowerState, at = 'inn') =>
    entityMoveSubjects(entitiesInPlay(CAST, s.positions), s, at, world(at)).map((e) => e.id);

  it('asks each follower and each Individual here that may go somewhere else', () => {
    expect(subjects(state(AT_INN))).toEqual(['corvin', 'tess']);
    expect(subjects(state({ ...AT_INN, albus: 'inn' }, ['albus']))).toEqual(['corvin', 'tess', 'albus']);
  });

  it('never asks a Group, a Strict row, or an Individual whose routine allows only where it stands', () => {
    const asked = subjects(state(AT_INN));
    expect(['moths', 'clerk', 'wenna'].filter((id) => asked.includes(id))).toEqual([]);
  });

  it('asks nobody standing elsewhere, and nobody when the player is nowhere', () => {
    expect(subjects(state(AT_INN), 'square')).toEqual([]);
    expect(entityMoveSubjects(CAST, state(AT_INN), undefined, world())).toEqual([]);
  });

  it('never asks a character left waiting', () => {
    const s = state(AT_INN);
    const waiting = { ...s, individuals: { ...s.individuals, corvin: { ...s.individuals.corvin, follow: { mode: 'waiting' as const, until: NOON + 60 } } } };
    expect(subjects(waiting)).toEqual(['tess']);
  });
});

describe('what a request offers', () => {
  const offers = (e: Entity, following = false, s = state(AT_INN)) =>
    entityMoveOffers(e, following, 'inn', s, world(), LOCATIONS, [QUAY]);

  it('offers a follower different replies from a newcomer, and a follower no walk', () => {
    expect(offers(corvin).moves).toEqual(['stay', 'comeAlong']);
    expect(offers(corvin, true)).toEqual({ moves: ['keepFollowing', 'stayHere'], destinations: [] });
  });

  it("offers walks only to its current row's places one hop away", () => {
    // The quay is a row place, but only from the square.
    expect(offers(tess).destinations.map((l) => l.id)).toEqual(['square']);
    // Anywhere allows a follow, not a walk: an empty schedule walks nowhere but its Start.
    expect(offers(corvin).destinations).toEqual([]);
  });

  it('names every reply the shipped prompt can offer', () => {
    for (const label of Object.values(ENTITY_MOVE_LABELS)) expect(defaultEntityLocationPrompt).toContain(label);
  });
});

describe('the join of replies to the player move', () => {
  const intents = (over: Partial<typeof NO_ENTITY_MOVES>) => ({ ...NO_ENTITY_MOVES, ...over });

  it('brings followers and "come along" to the new place and leaves the one told to stay waiting', () => {
    const s = state({ ...AT_INN, albus: 'inn' }, ['albus', 'tess']);
    const joined = joinEntityMoves(s, { from: 'inn', to: 'square' }, intents({ stayHere: ['tess'], comeAlong: ['corvin'] }), world());
    expect(movedPositions(joined.positions, s.positions)).toEqual({ albus: 'square', corvin: 'square' });
    expect(followersOf(joined)).toEqual(['corvin', 'albus']);
    expect(joined.individuals.tess.follow).toMatchObject({ mode: 'waiting' });
    expect(joined.positions.tess).toBe('inn');
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
      { entity: corvin, move: 'comeAlong' }, { entity: tess, move: 'stayHere' }, { entity: wenna, move: 'stay' },
      { entity: albus, move: { goTo: 'keep' } }, { entity: clerk, move: null },
    ]);
    expect(intents).toEqual({ stayHere: ['tess'], comeAlong: ['corvin'], goTo: [{ id: 'albus', to: 'keep' }] });
    expect(entityMoveIntents([{ entity: wenna, move: 'keepFollowing' }])).toBe(NO_ENTITY_MOVES);
  });
});
