// The join between the trait runtime and the save envelope: a movement record and a code bound each have to
// survive a save/load round trip, because that is where a lost one would silently rebalance a stat. Storage is
// real (in-memory) — the provider writes to IndexedDB. Must be imported before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import {
  acquireTrait, applyCodeTraitSwitches, heldPlayerTraits, seedStatBases, setTraitEnabled, switchPlayerTrait, type TraitRuntimeState,
} from '@/lib/traitRuntime';
import { inPlayBearers } from '@/lib/ownedTraitsInPlay';
import type { PlayerStat, Stat, Trait } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

type Gameplay = ReturnType<typeof useGameplay>;

const authored: Stat = {
  id: 'vigor',
  name: 'Vigor',
  type: 'number',
  description: '',
  min: 0,
  max: 100,
  value: 100,
  regen: 0,
  descriptors: [],
};

/** The same stat as the playthrough carries it: resting on its cap. */
const startStat: PlayerStat = { ...authored, value: 100 };

// Its +25 has nowhere to go: the stat is already resting on its cap, so the switch moves nothing.
const trait: Trait = {
  id: 't',
  name: 'Hale',
  statChanges: [{ statId: 'vigor', value: 25, type: 'starting' }],
  playerToggle: true,
};

const Expose = ({ expose }: { expose: (g: Gameplay) => void }) => {
  expose(useGameplay());
  return null;
};

const mount = () => {
  let gameplay: Gameplay | null = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Expose expose={(g) => { gameplay = g; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => {
    if (!gameplay) throw new Error('gameplay context not available (did the render throw?)');
    return gameplay as Gameplay;
  };
};

const slice = (g: Gameplay): TraitRuntimeState => ({
  stats: g.playerStats,
  traits: g.playerTraits,
  disabledTraitIds: g.disabledTraitIds,
  appliedValues: g.appliedTraitValues,
  cascadeOffTraitIds: g.cascadeOffTraitIds,
});

const commit = (g: Gameplay, next: TraitRuntimeState) => {
  g.setPlayerStats(next.stats);
  g.setPlayerTraits(next.traits);
  g.setDisabledTraitIds(next.disabledTraitIds);
  g.setAppliedTraitValues(next.appliedValues);
  g.setCascadeOffTraitIds(next.cascadeOffTraitIds ?? {});
};

const valueOf = (stats: PlayerStat[]) => stats.find((s) => s.id === 'vigor')!.value;

describe('trait movement records across a save/load round trip', () => {
  it('gives back only what the trait actually moved, on a trait acquired before the save', async () => {
    const live = mount();

    // Acquire at the cap: the +25 is swallowed whole.
    await act(async () => {
      const seeded: TraitRuntimeState = {
        stats: seedStatBases([startStat]),
        traits: [],
        disabledTraitIds: [],
        appliedValues: {},
      };
      commit(live(), acquireTrait(seeded, trait, { traits: [trait], groups: [] }).state);
    });
    expect(valueOf(live().playerStats)).toBe(100);
    expect(live().appliedTraitValues).toEqual({ t: {} });

    await act(async () => {
      await live().saveGame('slot', 'World', 'w1', 'save-1');
    });

    // A different session: nothing of the playthrough is in memory any more.
    await act(async () => {
      commit(live(), { stats: [], traits: [], disabledTraitIds: [], appliedValues: {} });
    });
    await act(async () => {
      await live().loadGame('save-1', [], [authored]);
    });
    expect(live().appliedTraitValues).toEqual({ t: {} });

    // Switching it off must hand back the nothing it moved, not the 25 it asked for.
    await act(async () => {
      commit(live(), setTraitEnabled(slice(live()), 't', false, { traits: [trait], groups: [] }).state);
    });
    expect(valueOf(live().playerStats)).toBe(100);
  });

  it('omits the record from a save with nothing to record, and reads its absence back as empty', async () => {
    const live = mount();
    await act(async () => {
      commit(live(), {
        stats: seedStatBases([startStat]),
        traits: [],
        disabledTraitIds: [],
        appliedValues: {},
      });
    });
    expect(live().saveCurrentGameState().appliedTraitValues).toBeUndefined();

    await act(async () => {
      await live().saveGame('slot', 'World', 'w1', 'save-2');
    });
    await act(async () => {
      await live().loadGame('save-2', [], [authored]);
    });
    expect(live().appliedTraitValues).toEqual({});
  });
});

describe('the cascade-off list across a save/load round trip', () => {
  // Hale requires Sworn; switching Sworn off cascades Hale off.
  const sworn: Trait = { id: 's', name: 'Sworn', statChanges: [], playerToggle: true };
  const hale: Trait = { ...trait, requires: [{ kind: 'trait', id: 's' }] };
  const world = { traits: [sworn, hale], groups: [] };
  const fresh: TraitRuntimeState = { stats: seedStatBases([{ ...startStat, value: 50 }]), traits: [], disabledTraitIds: [], appliedValues: {} };

  it('keeps a cascaded trait returnable after a load, and never a hand switch-off', async () => {
    const live = mount();
    await act(async () => {
      let s = switchPlayerTrait(fresh, 's', true, world)!.state;
      s = switchPlayerTrait(s, 't', true, world)!.state;
      commit(live(), switchPlayerTrait(s, 's', false, world)!.state);
    });
    expect(live().cascadeOffTraitIds).toEqual({ world: ['t'] });
    expect(live().saveCurrentGameState().cascadeOffTraitIds).toEqual({ world: ['t'] });

    await act(async () => {
      await live().saveGame('slot', 'World', 'w1', 'save-5');
    });
    await act(async () => {
      commit(live(), { stats: [], traits: [], disabledTraitIds: [], appliedValues: {} });
    });
    await act(async () => {
      await live().loadGame('save-5', [], [authored]);
    });
    expect(live().cascadeOffTraitIds).toEqual({ world: ['t'] });

    // Sworn back on: Hale returns on its own, and its +25 comes back with it.
    await act(async () => {
      commit(live(), switchPlayerTrait(slice(live()), 's', true, world)!.state);
    });
    expect(live().disabledTraitIds).toEqual([]);
    expect(valueOf(live().playerStats)).toBe(75);
    expect(live().saveCurrentGameState().cascadeOffTraitIds).toBeUndefined();
  });

  it('reads a save without the list as empty', async () => {
    const live = mount();
    await act(async () => {
      commit(live(), { ...fresh, cascadeOffTraitIds: { world: ['t'] } });
    });
    await act(async () => {
      live().loadGameState({ ...live().saveCurrentGameState(), cascadeOffTraitIds: undefined }, []);
    });
    expect(live().cascadeOffTraitIds).toEqual({});
  });
});

describe('owned trait state across a save/load round trip', () => {
  const owned = { ash: { chosen: ['tamed', 'scarred'], disabled: ['scarred'] }, bob: { chosen: ['gruff'] } };
  const held = ['ash', 'bob'];

  it("keeps each entity's chosen and switched-off traits, beside the cascade-off list", async () => {
    const live = mount();
    await act(async () => {
      live().setOwnedTraits(owned);
      live().setCascadeOffTraitIds({ world: ['t'], bob: ['loyal'] });
    });
    expect(live().saveCurrentGameState().ownedTraits).toEqual(owned);
    await act(async () => {
      await live().saveGame('slot', 'World', 'w1', 'save-owned-1');
    });
    await act(async () => {
      live().setOwnedTraits({});
      live().setCascadeOffTraitIds({});
    });
    await act(async () => {
      await live().loadGame('save-owned-1', [], [authored], held);
    });
    expect(live().ownedTraits).toEqual(owned);
    expect(live().cascadeOffTraitIds).toEqual({ world: ['t'], bob: ['loyal'] });
  });

  it("keeps every entity's picks when the persona switches and back", async () => {
    const live = mount();
    await act(async () => {
      live().setOwnedTraits(owned);
      live().setPersonaRef({ source: 'world', entityId: 'ash' });
    });
    await act(async () => { live().setPersonaRef({ source: 'world', entityId: 'bob' }); });
    await act(async () => { live().setPersonaRef({ source: 'world', entityId: 'ash' }); });
    await act(async () => {
      await live().saveGame('slot', 'World', 'w1', 'save-owned-2');
    });
    await act(async () => { live().setOwnedTraits({}); });
    await act(async () => {
      await live().loadGame('save-owned-2', [], [authored], held);
    });
    expect(live().ownedTraits).toEqual(owned);
    expect(live().personaRef).toEqual({ source: 'world', entityId: 'ash' });
  });

  it('drops the state of an entity the world no longer holds, keeping the player and a discovered character', async () => {
    const live = mount();
    const wren = { id: 'wren', name: 'Wren' };
    await act(async () => {
      live().setOwnedTraits({ ...owned, wren: { chosen: ['brave'] } });
      live().setCascadeOffTraitIds({ world: ['t'], bob: ['loyal'], wren: ['calm'] });
      live().setDiscoveredEntities([{ entity: wren, sourceTurnId: 'start' }]);
    });
    await act(async () => {
      await live().saveGame('slot', 'World', 'w1', 'save-owned-3');
    });
    await act(async () => {
      await live().loadGame('save-owned-3', [], [authored], ['ash']);
    });
    expect(live().ownedTraits).toEqual({ ash: owned.ash, wren: { chosen: ['brave'] } });
    expect(live().cascadeOffTraitIds).toEqual({ world: ['t'], wren: ['calm'] });
  });

  it("keeps a played persona's linked stat records under its own key, and drops a gone bearer's", async () => {
    const live = mount();
    await act(async () => {
      live().setOwnedTraits({ ...owned, wren: { chosen: ['paladin'] } });
      live().setAppliedTraitValues({ t: { vigor: 5 }, 'ash/paladin': { vigor: 5 }, 'wren/paladin': { vigor: 5 } });
      live().setPersonaRef({ source: 'world', entityId: 'ash' });
    });
    expect(live().saveCurrentGameState().appliedTraitValues).toEqual({ t: { vigor: 5 }, 'ash/paladin': { vigor: 5 }, 'wren/paladin': { vigor: 5 } });
    await act(async () => {
      await live().saveGame('slot', 'World', 'w1', 'save-owned-5');
    });
    await act(async () => { live().setAppliedTraitValues({}); });
    await act(async () => {
      await live().loadGame('save-owned-5', [], [authored], held);
    });
    expect(live().appliedTraitValues).toEqual({ t: { vigor: 5 }, 'ash/paladin': { vigor: 5 } });
    expect(live().ownedTraits).toEqual(owned);
  });

  it("keeps a library persona's state, which the world never holds", async () => {
    const live = mount();
    await act(async () => {
      live().setOwnedTraits({ lib: { chosen: ['brave'] } });
      live().setPersonaRef({ source: 'library', entityId: 'lib' });
    });
    await act(async () => {
      await live().saveGame('slot', 'World', 'w1', 'save-owned-4');
    });
    await act(async () => {
      await live().loadGame('save-owned-4', [], [authored], []);
    });
    expect(live().ownedTraits).toEqual({ lib: { chosen: ['brave'] } });
  });

  it("keeps the Custom Persona entity's picks under its own key, under None and under a library persona", async () => {
    const live = mount();
    await act(async () => { live().setOwnedTraits({ cp: { chosen: ['wizard'] } }); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-owned-6'); });
    await act(async () => { live().setOwnedTraits({}); });
    await act(async () => { await live().loadGame('save-owned-6', [], [authored], ['cp']); });
    expect(live().ownedTraits).toEqual({ cp: { chosen: ['wizard'] } });
    await act(async () => { live().setPersonaRef({ source: 'library', entityId: 'lib' }); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-owned-7'); });
    await act(async () => { live().setOwnedTraits({}); });
    await act(async () => { await live().loadGame('save-owned-7', [], [authored], ['cp']); });
    expect(live().ownedTraits).toEqual({ cp: { chosen: ['wizard'] } });
    expect(live().personaRef).toEqual({ source: 'library', entityId: 'lib' });
  });

  it("keeps the player's entered name and description on a None persona", async () => {
    const live = mount();
    const entered = { source: 'none' as const, name: 'Ash', description: 'Quiet.' };
    await act(async () => { live().setPersonaRef(entered); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-persona-1'); });
    await act(async () => { live().setPersonaRef({ source: 'none' }); });
    await act(async () => { await live().loadGame('save-persona-1', [], [authored], []); });
    expect(live().personaRef).toEqual(entered);
  });

  it("loads a save from the system-node era with its Custom Persona pick unheld and nothing under the marked entity's key", async () => {
    // A save from before the mark lists the pick among the player's world traits. The marked entity's tree
    // holds it, so the listed trait is not held, nothing migrates it, and the marked entity has no picks.
    const wizard: Trait = { id: 'wizard', name: 'Wizard', statChanges: [], groupId: 'classes' };
    const world = {
      traits: [wizard],
      traitGroups: [
        { id: 'blueprints', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' as const },
        { id: 'classes', name: 'Classes', parentId: 'blueprints', order: 0 },
      ],
      entities: [{
        id: 'cp', name: 'Newcomer', customPersona: true,
        traitLinks: [{ id: 'l', originalId: 'wizard', kind: 'trait' as const, originalName: 'Wizard', groupId: null, order: 0 }],
      }],
    };
    const live = mount();
    await act(async () => { live().setPlayerTraits([wizard]); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-node-era'); });
    await act(async () => { live().setPlayerTraits([]); });
    await act(async () => { await live().loadGame('save-node-era', [], [authored], ['cp']); });
    expect(live().playerTraits).toEqual([wizard]);
    expect(live().ownedTraits).toEqual({});
    const bearers = inPlayBearers(world, live().personaRef);
    expect(heldPlayerTraits(live().playerTraits, { traits: world.traits, groups: world.traitGroups, entities: world.entities, bearers })).toEqual([]);
  });

  it('omits the field from a save with no owned state, and reads its absence as none', async () => {
    const live = mount();
    expect(live().saveCurrentGameState().ownedTraits).toBeUndefined();
    await act(async () => {
      live().setOwnedTraits(owned);
    });
    await act(async () => {
      live().loadGameState({ ...live().saveCurrentGameState(), ownedTraits: undefined }, []);
    });
    expect(live().ownedTraits).toEqual({});
  });
});

describe('a code trait switch under undo', () => {
  it('restores the pre-switch trait state and the value the switch moved', async () => {
    const live = mount();
    const drain: Trait = { id: 'd', name: 'Drained', statChanges: [{ statId: 'vigor', value: -30, type: 'starting' }] };
    const world = { traits: [trait, drain], groups: [] };
    await act(async () => {
      commit(live(), { stats: seedStatBases([startStat]), traits: [], disabledTraitIds: [], appliedValues: {} });
    });
    const preTurn = live().saveCurrentGameState();

    await act(async () => {
      commit(live(), applyCodeTraitSwitches(slice(live()), [{ traitId: 'd', enabled: true, by: 'Vigor' }], world).state);
    });
    expect(live().playerTraits.map((t) => t.id)).toEqual(['d']);
    expect(valueOf(live().playerStats)).toBe(70);

    // Undo loads the snapshot the turn before the switch left.
    await act(async () => {
      live().loadGameState(preTurn, [], { keepLiveHistory: true });
    });
    expect(slice(live())).toMatchObject({ traits: [], disabledTraitIds: [], appliedValues: {} });
    expect(valueOf(live().playerStats)).toBe(100);
  });
});

describe('code bounds across a save/load round trip', () => {
  const raiseCap: Trait = { id: 'r', name: 'Robust', statChanges: [{ statId: 'vigor', value: 30, type: 'max' }] };
  const statOf = (g: Gameplay) => g.playerStats.find((s) => s.id === 'vigor')!;

  it('loads a save with no code bound fields with none, its bounds as saved', async () => {
    const live = mount();
    await act(async () => {
      commit(live(), { stats: seedStatBases([startStat]), traits: [], disabledTraitIds: [], appliedValues: {} });
    });
    await act(async () => {
      await live().saveGame('slot', 'World', 'w1', 'save-3');
    });
    await act(async () => {
      commit(live(), { stats: [], traits: [], disabledTraitIds: [], appliedValues: {} });
    });
    await act(async () => {
      await live().loadGame('save-3', [], [authored]);
    });
    const loaded = statOf(live());
    expect(loaded).toMatchObject({ min: 0, max: 100, value: 100 });
    expect('codeBounds' in loaded).toBe(false);
  });

  it('keeps a code bound through the round trip, still winning the next trait switch', async () => {
    const live = mount();
    const coded: PlayerStat = { ...seedStatBases([startStat])[0], max: 40, value: 40, codeBounds: { max: 40 } };
    await act(async () => {
      commit(live(), { stats: [coded], traits: [raiseCap], disabledTraitIds: ['r'], appliedValues: {} });
    });
    await act(async () => {
      await live().saveGame('slot', 'World', 'w1', 'save-4');
    });
    await act(async () => {
      commit(live(), { stats: [], traits: [], disabledTraitIds: [], appliedValues: {} });
    });
    await act(async () => {
      await live().loadGame('save-4', [], [authored]);
    });
    expect(statOf(live())).toMatchObject({ max: 40, codeBounds: { max: 40 } });

    await act(async () => {
      commit(live(), setTraitEnabled(slice(live()), 'r', true, { traits: [raiseCap], groups: [] }).state);
    });
    expect(statOf(live())).toMatchObject({ max: 40, value: 40 });
  });
});

describe('the save-load count', () => {
  it('counts each successful load, so the view settles once per load, and skips a missing save', async () => {
    const live = mount();
    await act(async () => {
      await live().saveGame('slot', 'World', 'w1', 'save-5');
    });
    expect(live().saveLoads).toBe(0);
    await act(async () => {
      await live().loadGame('save-5', [], [authored]);
    });
    expect(live().saveLoads).toBe(1);
    await act(async () => {
      await live().loadGame('no-such-save', [], [authored]);
    });
    expect(live().saveLoads).toBe(1);
  });
});
