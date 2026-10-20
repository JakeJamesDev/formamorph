import { describe, it, expect } from 'vitest';
import type { Entity } from '@/types';
import {
  ENTITY_MOVE_LABELS, entityMoveOptions, entityMoveSubjects, joinEntityMoves, liveFollowers, movedPositions,
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

  it('asks each Can Follow entity standing here, and each follower', () => {
    expect(subjects(['albus'])).toEqual(['sylvie', 'corvin', 'albus']);
  });

  it('never asks a Stays Put or Free entity, or one at every listed location at once', () => {
    expect(subjects([])).not.toContain('wenna');
    expect(subjects([])).not.toContain('moths');
    expect(subjects([])).not.toContain('guards');
  });

  it('asks nobody standing elsewhere, and nobody when the player is nowhere', () => {
    expect(entityMoveSubjects(cast, { positions: { corvin: 'gate' }, followers: [] }, 'inn')).toEqual([]);
    expect(entityMoveSubjects(cast, { positions, followers: ['albus'] }, undefined)).toEqual([]);
  });

  it('offers a follower different replies from a newcomer', () => {
    expect(entityMoveOptions(true)).toEqual(['keepFollowing', 'stayHere']);
    expect(entityMoveOptions(false)).toEqual(['stay', 'comeAlong']);
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
    const joined = joinEntityMoves(start, { from: 'inn', to: 'square' }, { stayHere: [], comeAlong: ['sylvie'] });
    expect(movedPositions(joined.positions, start.positions)).toEqual({ sylvie: 'square', albus: 'square' });
  });

  it('puts back a join the turn applied early when the commit ends where the turn began', () => {
    const early = joinEntityMoves(start, { from: 'inn', to: 'square' }, { stayHere: [], comeAlong: ['sylvie'] });
    // Code moved the player back, so the commit's join is the start itself.
    const final = joinEntityMoves(start, { from: 'inn', to: 'inn' }, { stayHere: [], comeAlong: ['sylvie'] });
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
