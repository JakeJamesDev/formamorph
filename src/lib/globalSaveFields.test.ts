import { describe, it, expect } from 'vitest';
import { APP_VERSION, migrateSave } from './version';
import { liveAppliedValues, liveSnapshotOf, savedAppliedValues, savedCascadeOff } from './globalSaveFields';
import type { GameState, SaveObject } from '@/types';

const stat = { id: 'rampage', name: 'Rampage', type: 'number', description: '', min: 0, max: 100, value: 40, regen: 0, descriptors: [] };
const trait = { id: 'sworn', name: 'Sworn', statChanges: [] };

/** A snapshot as saves wrote it before global scope had its own fields. */
const oldSnapshot = (tag: string) => ({
  playerStats: [{ ...stat, value: tag === 'current' ? 40 : 10 }],
  playerTraits: [trait],
  disabledTraitIds: ['off'],
  appliedTraitValues: { sworn: { rampage: 5 }, 'ash/paladin': { vigor: 2 }, 'ash/paladin/stats': { trust: 1 } },
  cascadeOffTraitIds: { world: ['hale'], ash: ['loyal'] },
  ownedTraits: { ash: { chosen: ['paladin'] } },
  characterData: null,
});

const oldSave = () => ({
  name: 'Old', version: APP_VERSION,
  currentState: oldSnapshot('current'),
  stateHistory: [oldSnapshot('history')],
}) as unknown as SaveObject;

describe('a save written before global scope had its own fields', () => {
  it('loads with the same global stats and traits under the new names', () => {
    const { currentState } = migrateSave(oldSave());
    expect(currentState.globalStats).toEqual([{ ...stat, value: 40 }]);
    expect(currentState.globalTraits).toEqual([trait]);
    expect('playerStats' in currentState).toBe(false);
    expect('playerTraits' in currentState).toBe(false);
  });

  it('keeps the switched-off traits and owned traits as they were', () => {
    const { currentState } = migrateSave(oldSave());
    expect(currentState.disabledTraitIds).toEqual(['off']);
    expect(currentState.ownedTraits).toEqual({ ash: { chosen: ['paladin'] } });
  });

  it('splits the cascade-off traits into a global part and an owners part', () => {
    expect(migrateSave(oldSave()).currentState.cascadeOffTraitIds).toEqual({ global: ['hale'], owners: { ash: ['loyal'] } });
  });

  it('splits the applied trait values, keeping an entity trait and its own-stat record apart', () => {
    expect(migrateSave(oldSave()).currentState.appliedTraitValues).toEqual({
      global: { sworn: { rampage: 5 } },
      owners: { ash: { paladin: { vigor: 2 }, 'paladin/stats': { trust: 1 } } },
    });
  });

  it('migrates every snapshot in the history', () => {
    const { stateHistory } = migrateSave(oldSave());
    expect(stateHistory[0].globalStats).toEqual([{ ...stat, value: 10 }]);
    expect(stateHistory[0].cascadeOffTraitIds).toEqual({ global: ['hale'], owners: { ash: ['loyal'] } });
    expect('playerStats' in stateHistory[0]).toBe(false);
  });

  it('changes nothing on a second migration', () => {
    const once = migrateSave(oldSave());
    const twice = migrateSave(once);
    expect(twice).toEqual(once);
    expect(twice.currentState).toBe(once.currentState);
    expect(twice.stateHistory[0]).toBe(once.stateHistory[0]);
  });

  it('leaves out a map the save never held', () => {
    const { currentState } = migrateSave({
      name: 'Old', version: APP_VERSION, currentState: { playerStats: [], playerTraits: [] }, stateHistory: [],
    } as unknown as SaveObject);
    expect(currentState).toMatchObject({ globalStats: [], globalTraits: [] });
    expect('cascadeOffTraitIds' in currentState).toBe(false);
    expect('appliedTraitValues' in currentState).toBe(false);
  });
});

describe('the saved and live map shapes', () => {
  it('round-trip cascade-off traits and applied values', () => {
    const cascade = { global: ['hale'], owners: { ash: ['loyal'] } };
    const applied = { sworn: { rampage: 5 }, 'ash/paladin': { vigor: 2 }, 'ash/paladin/stats': { trust: 1 } };
    expect(savedCascadeOff(cascade)).toEqual(cascade);
    expect(liveAppliedValues(savedAppliedValues(applied))).toEqual(applied);
  });

  it('write nothing for an empty or emptied map', () => {
    expect(savedCascadeOff({})).toBeUndefined();
    expect(savedCascadeOff({ global: [], owners: { ash: [] } })).toBeUndefined();
    expect(savedAppliedValues({})).toBeUndefined();
    expect(liveSnapshotOf({ globalStats: [], globalTraits: [] } as unknown as GameState).cascadeOffTraitIds).toEqual({});
    expect(liveAppliedValues(undefined)).toEqual({});
  });

  it('hold a global trait with no stat record as an empty record, not nothing', () => {
    expect(savedAppliedValues({ sworn: {} })).toEqual({ global: { sworn: {} } });
  });
});
