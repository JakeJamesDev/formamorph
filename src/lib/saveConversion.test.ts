import { describe, it, expect } from 'vitest';
import { flattenNestedGameStates, type NestedState } from './saveConversion';
import { migrateLegacySaveState } from './version';
import type { GameState } from '@/types';

// The oldest (deep-nested) save path: the conversion worker flattens the tree, then the load path runs
// migrateLegacySaveState on each snapshot. These assert the two compose so the oldest saves land with their
// trait/body/discovered fields migrated — the gap the flat-envelope path never had.

describe('flattenNestedGameStates', () => {
  it('walks a nested save into a flat array, stamping stateVersion on each', () => {
    const nested: NestedState = {
      turn: 3,
      gameStates: [
        { turn: 2, gameStates: [{ turn: 1, gameStates: [] }] },
      ],
    };
    const flat = flattenNestedGameStates(nested);
    expect(flat.map((s) => s.turn)).toEqual([3, 2, 1]);
    expect(flat.every((s) => s.stateVersion === 2)).toBe(true);
    // The nesting is stripped from each extracted snapshot.
    expect(flat.every((s) => !('gameStates' in s))).toBe(true);
  });

  it('returns an empty array for a non-nested node', () => {
    expect(flattenNestedGameStates({ turn: 1 })).toEqual([]);
    expect(flattenNestedGameStates(null)).toEqual([]);
  });
});

describe('nested-legacy load pipeline (flatten → migrateLegacySaveState)', () => {
  it('migrates each flattened snapshot to the current trait/body/discovered shape', () => {
    const nested: NestedState = {
      playerTraits: [{ id: 't', name: 'Bat Pony', description: 'You are a Bat Pony', statChanges: [] }],
      playerStats: [{ id: 's', name: 'Stomach', value: 5 }],
      gameStates: [
        { playerTraits: [{ id: 't', name: 'Bat Pony', description: 'You are a Bat Pony', statChanges: [] }], playerStats: [{ id: 's', name: 'Stomach', value: 3 }], gameStates: [] },
      ],
    };

    const migrated = flattenNestedGameStates(nested).map((s) => migrateLegacySaveState(s as unknown as GameState));

    expect(migrated).toHaveLength(2);
    for (const state of migrated) {
      // Trait description renamed so it reaches the AI, legacy key dropped.
      expect(state.playerTraits[0]).toMatchObject({ aiDescription: 'You are a Bat Pony' });
      expect('description' in state.playerTraits[0]).toBe(false);
      // Legacy body stat bound so it drives the VRM.
      expect(state.playerStats[0].morphBindings).toEqual(['Belly']);
      // v2-only field stamped.
      expect(state.discoveredEntities).toEqual([]);
    }
  });
});
