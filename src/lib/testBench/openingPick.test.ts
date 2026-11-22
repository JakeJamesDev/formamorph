import { describe, expect, it } from 'vitest';
import { openingPickGroups, pickedOption } from './openingPick';
import type { LensWorld } from './lens';
import type { Entity, GameLocation, WorldOverview } from '@/types';

/** The shared Opening picker lists every Opening: the world's, then each entity's, then each location's. */

const aki = {
  id: 'aki', name: 'Aki', persona: true, traits: [],
  openings: [{ id: 'o1', text: 'Aki waves.', kind: 'action' }, { id: 'o2', name: 'ambush', text: 'Arrows fly.', kind: 'action', self: true }],
} as unknown as Entity;
const quiet = { id: 'quiet', name: 'Quiet', traits: [], openings: [] } as unknown as Entity;
const harbor: GameLocation = { id: 'harbor', name: 'Harbor', isStarting: true, openings: [{ id: 'o1', text: 'Gulls cry.', kind: 'action' }] };
const world: LensWorld = {
  stats: [], traits: [], traitGroups: [], placeholders: [], locations: [harbor], entities: [aki, quiet],
  worldOverview: { name: 'Sedge Landing', openings: [{ id: 'o1', text: 'The tide turns.', kind: 'action' }] } as unknown as WorldOverview,
};

describe('openingPickGroups', () => {
  const groups = openingPickGroups(world);

  it('groups the world, then each entity, then each location, leaving out owners with none', () => {
    expect(groups.map((g) => [g.label, g.options.map((o) => o.label)])).toEqual([
      ['World', ['World · Opening 1']],
      ['Aki', ['Aki · Opening 1', 'ambush']],
      ['Harbor', ['Harbor · Opening 1']],
    ]);
  });

  it('keys each row by its owner, so three rows sharing an id stay apart', () => {
    expect(groups.flatMap((g) => g.options.map((o) => o.key))).toEqual([
      { ownerId: null, openingId: 'o1' },
      { ownerId: 'aki', openingId: 'o1' },
      { ownerId: 'aki', openingId: 'o2' },
      { ownerId: null, openingId: 'o1', locationId: 'harbor' },
    ]);
    expect(new Set(groups.flatMap((g) => g.options.map((o) => o.id))).size).toBe(4);
  });

  it('finds a pick, and none for None or a deleted Opening', () => {
    expect(pickedOption(groups, { ownerId: null, openingId: 'o1', locationId: 'harbor' })?.label).toBe('Harbor · Opening 1');
    expect(pickedOption(groups, null)).toBeNull();
    expect(pickedOption(groups, { ownerId: 'aki', openingId: 'gone' })).toBeNull();
  });
});
