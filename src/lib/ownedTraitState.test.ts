import { describe, expect, it } from 'vitest';
import { heldEntityIds, ownedTraitStatesFrom, withHeldOwners } from './ownedTraitState';
import type { GameState } from '@/types';

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
  it("drops an entity's owned state and cascade-off list once it is gone, and always keeps the player's list", () => {
    const pruned = withHeldOwners(state({
      ownedTraits: { ash: { chosen: ['tamed'] }, gone: { chosen: ['x'] } },
      cascadeOffTraitIds: { world: ['t'], gone: ['y'] },
    }), new Set(['ash']));
    expect(pruned.ownedTraits).toEqual({ ash: { chosen: ['tamed'] } });
    expect(pruned.cascadeOffTraitIds).toEqual({ world: ['t'] });
  });

  it('leaves a state with neither map as it is', () => {
    const plain = state();
    expect(withHeldOwners(plain, new Set())).toBe(plain);
  });
});
