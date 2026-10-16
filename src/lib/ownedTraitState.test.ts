import { describe, expect, it } from 'vitest';
import { heldEntityIds, ownedTraitStatesFrom, withHeldOwners } from './ownedTraitState';
import type { GameState, PlayerStat } from '@/types';

const state = (extra: Partial<GameState> = {}) => ({ discoveredEntities: [], ...extra }) as unknown as GameState;

describe('ownedTraitStatesFrom', () => {
  it('starts each entity with its picks chosen and none switched off, leaving out an entity with no picks', () => {
    expect(ownedTraitStatesFrom({ ash: ['tamed'], bob: [] })).toEqual({ ash: { chosen: ['tamed'] } });
  });
});

describe('heldEntityIds', () => {
  it('holds the world entities, the discovered cast, and a library persona, never a world persona twice', () => {
    const discovered = state({ discoveredEntities: [{ entity: { id: 'added', name: 'Added' }, sourceTurnId: 't' }] });
    expect(heldEntityIds(['ash'], discovered, { source: 'library', entityId: 'lib' })).toEqual(new Set(['ash', 'added', 'lib']));
    expect(heldEntityIds(['ash'], state(), { source: 'world', entityId: 'gone' })).toEqual(new Set(['ash']));
  });
});

describe('withHeldOwners', () => {
  it("drops an entity's owned state and cascade-off list once it is gone, and always keeps the global part", () => {
    const pruned = withHeldOwners(state({
      ownedTraits: { ash: { chosen: ['tamed'] }, gone: { chosen: ['x'] } },
      cascadeOffTraitIds: { global: ['t'], owners: { ash: ['z'], gone: ['y'] } },
      appliedTraitValues: { global: { t: { h: 1 } }, owners: { ash: { paladin: { h: 5 } }, gone: { paladin: { h: 5 } } } },
    }), new Set(['ash']));
    expect(pruned.ownedTraits).toEqual({ ash: { chosen: ['tamed'] } });
    expect(pruned.cascadeOffTraitIds).toEqual({ global: ['t'], owners: { ash: ['z'] } });
    expect(pruned.appliedTraitValues).toEqual({ global: { t: { h: 1 } }, owners: { ash: { paladin: { h: 5 } } } });
  });

  it('writes no owners part once every owner is gone', () => {
    const pruned = withHeldOwners(state({
      cascadeOffTraitIds: { global: ['t'], owners: { gone: ['y'] } },
      appliedTraitValues: { owners: { gone: { paladin: { h: 5 } } } },
    }), new Set());
    expect(pruned.cascadeOffTraitIds).toEqual({ global: ['t'] });
    expect(pruned.appliedTraitValues).toBeUndefined();
  });

  it('keeps an owner’s state keyed by its own id, so None and a library persona share the global picks', () => {
    // The global cascade-off list and records sit in the global part, whichever of the two the save names.
    const shared = state({
      ownedTraits: { lib: { chosen: ['calm'] } }, cascadeOffTraitIds: { global: ['paladin'] }, appliedTraitValues: { global: { paladin: { h: 5 } } },
    });
    for (const persona of [undefined, { source: 'library' as const, entityId: 'lib' }]) {
      const kept = withHeldOwners(shared, heldEntityIds([], shared, persona));
      expect(kept.cascadeOffTraitIds).toEqual({ global: ['paladin'] });
      expect(kept.appliedTraitValues).toEqual({ global: { paladin: { h: 5 } } });
      expect(kept.ownedTraits).toEqual(persona ? { lib: { chosen: ['calm'] } } : {});
    }
  });

  it('drops the stat values of an entity once it is gone', () => {
    const vigor: PlayerStat = { id: 'v', name: 'Vigor', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] };
    const pruned = withHeldOwners(state({ entityStats: { ash: [vigor], gone: [vigor] } }), new Set(['ash']));
    expect(pruned.entityStats).toEqual({ ash: [vigor] });
  });

  it('leaves a state with neither map as it is', () => {
    const plain = state();
    expect(withHeldOwners(plain, new Set())).toBe(plain);
  });
});
