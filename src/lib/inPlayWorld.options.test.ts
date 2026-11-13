import { describe, expect, it } from 'vitest';
import { inPlayWorldOf } from './inPlayWorld';
import type { Entity, GameLocation, WorldOption } from '@/types';

const LIT: WorldOption = { id: 'lit', name: 'Lanterns Lit', type: 'boolean', shownToPlayer: false, midGame: false, default: false };
// The lamplighter is on only while the lanterns are lit.
const lamplighter: Entity = { id: 'lamp', name: 'Lamplighter', locations: ['harbor'], enabledWhen: [{ all: [{ kind: 'option', id: 'lit' }] }] };
const harbor: GameLocation = { id: 'harbor', name: 'Harbor' };
const world = { entities: [lamplighter], locations: [harbor], options: [LIT] };

describe('an Enabled gate on a World Option, outside play (Q25)', () => {
  it('reads the default with no picks, and the Test Bench pick when given one', () => {
    expect(inPlayWorldOf(world, null).entities).toEqual([]);
    expect(inPlayWorldOf(world, null, { lit: true }).entities.map((e) => e.id)).toEqual(['lamp']);
    expect(inPlayWorldOf(world, null, { lit: false }).entities).toEqual([]);
  });
});
