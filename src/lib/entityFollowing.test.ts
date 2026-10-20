import { describe, it, expect } from 'vitest';
import type { Connection, Entity, GameLocation } from '@/types';
import {
  ENTITY_MOVE_LABELS, entityMoveDestinations, entityMoveOffers, entityMoveOptions, entityMoveSubjects, joinEntityMoves, liveFollowers, movedPositions,
  NO_ENTITY_MOVES,
} from './entityFollowing';
import { defaultEntityLocationPrompt } from '@/components/game/GamePrompts';
import { entitiesInPlay } from './entityPresence';

const entity = (id: string, over: Partial<Entity> = {}): Entity => ({ id, name: id, ...over }) as Entity;

describe('who gets an entity location request', () => {
  const cast = [
    entity('sylvie', { movement: 'follow', locations: ['keep', 'inn'], presence: 'random' }),
    entity('corvin', { movement: 'follow', locations: ['inn'] }),
    entity('wenna', { movement: 'stays', locations: ['inn'] }),
    entity('moths', { locations: ['inn'] }),
    entity('guards', { movement: 'follow', locations: ['inn', 'gate'] }),
    entity('albus', { movement: 'follow', locations: ['keep'] }),
  ];
  const positions = { sylvie: 'inn', corvin: 'inn', wenna: 'inn', albus: 'inn' };
  const subjects = (followers: string[]) =>
    entityMoveSubjects(entitiesInPlay(cast, positions), { positions, followers }, 'inn').map((e) => e.id);

  it('asks each Can Follow entity standing or listed here, and each follower', () => {
    expect(subjects(['albus'])).toEqual(['sylvie', 'corvin', 'guards', 'albus']);
  });

  it('never asks a Stays Put or Free entity', () => {
    expect(subjects([])).not.toContain('wenna');
    expect(subjects([])).not.toContain('moths');
  });

  it('asks nobody standing elsewhere, and nobody when the player is nowhere', () => {
    expect(entityMoveSubjects(cast, { positions: { corvin: 'gate', sylvie: 'inn', albus: 'inn' }, followers: [] }, 'keep')).toEqual([]);
    expect(entityMoveSubjects(cast, { positions, followers: ['albus'] }, undefined)).toEqual([]);
  });

  it('offers a follower different replies from a newcomer', () => {
    expect(entityMoveOptions(true)).toEqual(['keepFollowing', 'stayHere']);
    expect(entityMoveOptions(false)).toEqual(['stay', 'comeAlong']);
  });
});

describe('a Moves Between entity', () => {
  const location = (id: string, over: Partial<GameLocation> = {}): GameLocation => ({ id, name: id.toUpperCase(), ...over }) as GameLocation;
  // keep ← wall → tower; the barrow hangs off the tower, the yard sits inside the keep.
  const locations = [location('keep'), location('yard', { parentId: 'keep' }), location('wall'), location('tower'), location('barrow')];
  const connections = [
    { id: 'c1', a: 'keep', b: 'wall', aToB: {}, bToA: {} },
    { id: 'c2', a: 'wall', b: 'tower', aToB: {}, bToA: {} },
    { id: 'c3', a: 'tower', b: 'barrow', aToB: {}, bToA: {} },
  ] as Connection[];
  const blackwell = entity('blackwell', { movement: 'between', locations: ['keep', 'wall', 'tower'] });
  const names = (standingAt: string, who = blackwell) =>
    entityMoveDestinations(who, standingAt, locations, connections).map((l) => l.id);

  it('is asked when it stands where the player is', () => {
    expect(entityMoveSubjects([blackwell], { positions: { blackwell: 'wall' }, followers: [] }, 'wall')).toEqual([blackwell]);
    expect(entityMoveSubjects([blackwell], { positions: { blackwell: 'keep' }, followers: [] }, 'wall')).toEqual([]);
  });

  it('is offered each of its own locations one hop away, and nothing else', () => {
    expect(names('wall')).toEqual(['keep', 'tower']);
    // The yard is a tree neighbor and the barrow a Connection away, but neither is its own.
    expect(names('keep')).toEqual(['wall']);
    expect(names('tower')).toEqual(['wall']);
  });

  it('respects one-way legs', () => {
    const oneWay = [{ id: 'c1', a: 'keep', b: 'wall', aToB: {} }] as Connection[];
    expect(entityMoveDestinations(blackwell, 'wall', locations, oneWay).map((l) => l.id)).toEqual([]);
    expect(entityMoveDestinations(blackwell, 'keep', locations, oneWay).map((l) => l.id)).toEqual(['wall']);
  });

  it('is offered stay, come along and its places, but walks nowhere while it follows', () => {
    const offers = (following: boolean) => entityMoveOffers(blackwell, following, 'wall', locations, connections);
    expect(offers(false).moves).toEqual(['stay', 'comeAlong']);
    expect(offers(false).destinations.map((l) => l.id)).toEqual(['keep', 'tower']);
    expect(offers(true)).toEqual({ moves: ['keepFollowing', 'stayHere'], destinations: [] });
  });

  it('is the only Movement offered places', () => {
    expect(names('wall', entity('sylvie', { movement: 'follow', locations: ['keep', 'wall'] }))).toEqual([]);
  });
});

describe('the shipped entity location prompt', () => {
  it('names every reply the request can offer', () => {
    for (const label of Object.values(ENTITY_MOVE_LABELS)) expect(defaultEntityLocationPrompt).toContain(label);
  });
});

describe('what a join writes back', () => {
  const start = { positions: { sylvie: 'inn', albus: 'inn', wenna: 'inn' }, followers: ['albus'] };
  it('writes only the positions it moved', () => {
    const joined = joinEntityMoves(start, { from: 'inn', to: 'square' }, { ...NO_ENTITY_MOVES, comeAlong: ['sylvie'] });
    expect(movedPositions(joined.positions, start.positions)).toEqual({ sylvie: 'square', albus: 'square' });
  });

  it('puts back a join the turn applied early when the commit ends where the turn began', () => {
    const early = joinEntityMoves(start, { from: 'inn', to: 'square' }, { ...NO_ENTITY_MOVES, comeAlong: ['sylvie'] });
    // Code moved the player back, so the commit's join is the start itself.
    const final = joinEntityMoves(start, { from: 'inn', to: 'inn' }, { ...NO_ENTITY_MOVES, comeAlong: ['sylvie'] });
    expect(final).toBe(start);
    expect(movedPositions(final.positions, early.positions)).toEqual({ sylvie: 'inn', albus: 'inn' });
  });
});

describe('followers on load', () => {
  it('drops a follower the world no longer has', () => {
    expect(liveFollowers(['albus', 'gone'], new Set(['albus']))).toEqual(['albus']);
    const kept = ['albus'];
    expect(liveFollowers(kept, new Set(['albus']))).toBe(kept);
  });
});
