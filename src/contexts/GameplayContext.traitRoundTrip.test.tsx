// The join between the trait runtime and the save envelope: a movement record and a code bound each have to
// survive a save/load round trip, because that is where a lost one would silently rebalance a stat. Storage is
// real (in-memory) — the provider writes to IndexedDB. Must be imported before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, onTestFinished, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import EntityStorageService from '@/services/EntityStorageService';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import {
  acquireTrait, applyCodeTraitSwitches, heldGlobalTraits, seedStatBases, setTraitEnabled, switchPlayerTrait, type TraitRuntimeState,
} from '@/lib/traitRuntime';
import { inPlayOwners } from '@/lib/ownedTraitsInPlay';
import { getSaveRecord, putSaveRecord } from '@/components/modals/dbUtils';
import { APP_VERSION } from '@/lib/version';
import type { LegacyCodeBoundsStat, PlayerStat, SaveObject, SaveRecord, Stat, Trait } from '@/types';

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
  stats: g.globalStats,
  traits: g.globalTraits,
  disabledTraitIds: g.disabledTraitIds,
  appliedValues: g.appliedTraitValues,
  cascadeOffTraitIds: g.cascadeOffTraitIds,
});

const commit = (g: Gameplay, next: TraitRuntimeState) => {
  g.setGlobalStats(next.stats);
  g.setGlobalTraits(next.traits);
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
    expect(valueOf(live().globalStats)).toBe(100);
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
    expect(valueOf(live().globalStats)).toBe(100);
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
  const hale: Trait = { ...trait, requires: [{ all: [{ kind: 'trait', id: 's' }] }] };
  const world = { traits: [sworn, hale], groups: [] };
  const fresh: TraitRuntimeState = { stats: seedStatBases([{ ...startStat, value: 50 }]), traits: [], disabledTraitIds: [], appliedValues: {} };

  it('keeps a cascaded trait returnable after a load, and never a hand switch-off', async () => {
    const live = mount();
    await act(async () => {
      let s = switchPlayerTrait(fresh, 's', true, world)!.state;
      s = switchPlayerTrait(s, 't', true, world)!.state;
      commit(live(), switchPlayerTrait(s, 's', false, world)!.state);
    });
    expect(live().cascadeOffTraitIds).toEqual({ global: ['t'] });
    expect(live().saveCurrentGameState().cascadeOffTraitIds).toEqual({ global: ['t'] });

    await act(async () => {
      await live().saveGame('slot', 'World', 'w1', 'save-5');
    });
    await act(async () => {
      commit(live(), { stats: [], traits: [], disabledTraitIds: [], appliedValues: {} });
    });
    await act(async () => {
      await live().loadGame('save-5', [], [authored]);
    });
    expect(live().cascadeOffTraitIds).toEqual({ global: ['t'] });

    // Sworn back on: Hale returns on its own, and its +25 comes back with it.
    await act(async () => {
      commit(live(), switchPlayerTrait(slice(live()), 's', true, world)!.state);
    });
    expect(live().disabledTraitIds).toEqual([]);
    expect(valueOf(live().globalStats)).toBe(75);
    expect(live().saveCurrentGameState().cascadeOffTraitIds).toBeUndefined();
  });

  it('reads a save without the list as empty', async () => {
    const live = mount();
    await act(async () => {
      commit(live(), { ...fresh, cascadeOffTraitIds: { global: ['t'] } });
    });
    await act(async () => {
      live().loadGameState({ ...live().saveCurrentGameState(), cascadeOffTraitIds: undefined }, []);
    });
    expect(live().cascadeOffTraitIds).toEqual({});
  });
});

describe('global fields across a save/load round trip', () => {
  const sworn: Trait = { id: 's', name: 'Sworn', statChanges: [], playerToggle: true };
  const rampage: PlayerStat = { ...startStat, id: 'rampage', name: 'Rampage', value: 40 };

  it('writes the global fields only, never the player-named ones', async () => {
    const live = mount();
    await act(async () => { commit(live(), { stats: [rampage], traits: [sworn], disabledTraitIds: [], appliedValues: { s: {} } }); });
    const saved = live().saveCurrentGameState();
    expect(saved.globalStats).toEqual([rampage]);
    expect(saved.globalTraits).toEqual([sworn]);
    expect('playerStats' in saved).toBe(false);
    expect('playerTraits' in saved).toBe(false);
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-global-1'); });
    const stored = (await getSaveRecord('save-global-1')) as SaveObject;
    expect(stored.currentState.globalStats).toEqual([rampage]);
    expect('playerStats' in stored.currentState).toBe(false);
  });

  it('loads a save stored under the old field names with the same values, in every snapshot', async () => {
    const live = mount();
    const old = (value: number) => ({
      playerStats: [{ ...rampage, value }], playerTraits: [sworn], disabledTraitIds: ['s'],
      appliedTraitValues: { s: { rampage: 5 }, 'ash/paladin': { rampage: 2 } }, cascadeOffTraitIds: { world: ['hale'], ash: ['loyal'] },
      visibleEntities: [], logEntries: [], gameplayText: '', gameTime: 0, characterData: null, choices: [], isGameStarted: true,
      timestamp: '', worldName: null, playerNotes: '', previousStateIndex: null, stateVersion: 2,
    });
    await putSaveRecord({
      id: 'save-global-2', name: 'Old', version: APP_VERSION, currentState: old(40), stateHistory: [old(10), old(40)],
    } as unknown as SaveRecord);
    await act(async () => { await live().loadGame('save-global-2', []); });
    // The load derives each stat's bounds bookkeeping on top of what the save held.
    expect(live().globalStats).toMatchObject([rampage]);
    expect(live().globalTraits).toEqual([sworn]);
    expect(live().disabledTraitIds).toEqual(['s']);
    expect(live().appliedTraitValues).toEqual({ s: { rampage: 5 }, 'ash/paladin': { rampage: 2 } });
    expect(live().cascadeOffTraitIds).toEqual({ global: ['hale'], owners: { ash: ['loyal'] } });
    expect(live().gameStates.map((state) => state.globalStats[0].value)).toEqual([10, 40]);
  });
});

describe('owned trait state across a save/load round trip', () => {
  const owned = { ash: { chosen: ['tamed', 'scarred'], disabled: ['scarred'] }, bob: { chosen: ['gruff'] } };
  const held = [{ id: 'ash' }, { id: 'bob' }];

  it("keeps each entity's chosen and switched-off traits, beside the cascade-off list", async () => {
    const live = mount();
    await act(async () => {
      live().setOwnedTraits(owned);
      live().setCascadeOffTraitIds({ global: ['t'], owners: { bob: ['loyal'] } });
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
    expect(live().cascadeOffTraitIds).toEqual({ global: ['t'], owners: { bob: ['loyal'] } });
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
      live().setCascadeOffTraitIds({ global: ['t'], owners: { bob: ['loyal'], wren: ['calm'] } });
      live().setDiscoveredEntities([{ entity: wren, sourceTurnId: 'start' }]);
    });
    await act(async () => {
      await live().saveGame('slot', 'World', 'w1', 'save-owned-3');
    });
    await act(async () => {
      await live().loadGame('save-owned-3', [], [authored], [{ id: 'ash' }]);
    });
    expect(live().ownedTraits).toEqual({ ash: owned.ash, wren: { chosen: ['brave'] } });
    expect(live().cascadeOffTraitIds).toEqual({ global: ['t'], owners: { wren: ['calm'] } });
  });

  it("keeps a played persona's linked stat records under its own key, and drops a gone owner's", async () => {
    const live = mount();
    await act(async () => {
      live().setOwnedTraits({ ...owned, wren: { chosen: ['paladin'] } });
      live().setAppliedTraitValues({ t: { vigor: 5 }, 'ash/paladin': { vigor: 5 }, 'wren/paladin': { vigor: 5 } });
      live().setPersonaRef({ source: 'world', entityId: 'ash' });
    });
    expect(live().saveCurrentGameState().appliedTraitValues).toEqual({
      global: { t: { vigor: 5 } }, owners: { ash: { paladin: { vigor: 5 } }, wren: { paladin: { vigor: 5 } } },
    });
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

  it('keeps each entity’s stat values, backfills a stat the world added, and drops an entity it removed', async () => {
    const trust: Stat = { ...authored, id: 'trust', name: 'Trust', value: 20 };
    const stock: Stat = { ...authored, id: 'stock', name: 'Stock', value: 6 }; // The start value (Q8)
    const live = mount();
    await act(async () => {
      live().setEntityStats({ ash: [{ ...trust, value: 33 }], gone: [{ ...trust, value: 9 }] });
    });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-entity-stats'); });
    await act(async () => { live().setEntityStats({}); });
    await act(async () => {
      await live().loadGame('save-entity-stats', [], [authored], [{ id: 'ash', stats: [trust, stock] }, { id: 'bob' }]);
    });
    expect(live().entityStats).toEqual({ ash: [{ ...trust, value: 33 }, { ...stock, value: 6 }] });
  });

  it('drops the stored code bounds key from each entity stat, live and in every snapshot, with no migration', async () => {
    const trust: LegacyCodeBoundsStat = { ...authored, id: 'trust', name: 'Trust', value: 20, max: 40, codeBounds: { max: 40 } };
    const live = mount();
    await act(async () => { live().setEntityStats({ ash: [trust] }); });
    await act(async () => { live().setGameStates([live().saveCurrentGameState()]); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-entity-bounds'); });
    await act(async () => { await live().loadGame('save-entity-bounds', [], [authored], [{ id: 'ash' }]); });
    const { codeBounds: _dropped, ...kept } = trust;
    expect(live().entityStats).toEqual({ ash: [kept] });
    expect(live().gameStates.map((state) => state.entityStats)).toEqual([{ ash: [kept] }]);
  });

  it('records what a turn moved each entity stat, live, in its snapshot, and on its past page', async () => {
    const trust: PlayerStat = { ...authored, id: 'trust', name: 'Trust', value: 20 };
    const live = mount();
    await act(async () => { live().setEntityStatBaseline({ ash: [trust] }); });
    await act(async () => { live().setEntityStats({ ash: [{ ...trust, value: 26 }] }); });
    expect(live().viewEntityStatChanges).toEqual({ ash: { trust: 6 } });
    const snapshot = live().saveCurrentGameState();
    expect(snapshot.entityStatChanges).toEqual({ ash: { trust: 6 } });
    // The next turn starts from what this one left; paging back shows this turn's record.
    await act(async () => {
      live().setEntityStatBaseline({ ash: [{ ...trust, value: 26 }] });
      live().setGameStates([snapshot]);
      live().setFullMessageHistory([
        { role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }, { role: 'assistant', content: 'd' },
      ]);
    });
    expect(live().viewEntityStatChanges).toEqual({});
    await act(async () => { live().setUserPage(1); });
    expect(live().viewEntityStatChanges).toEqual({ ash: { trust: 6 } });
  });

  it("backfills a stat the library persona gained since the save, at its start value (Q74, Q8)", async () => {
    const trust: Stat = { ...authored, id: 'trust', name: 'Trust', value: 20 };
    const stock: Stat = { ...authored, id: 'stock', name: 'Stock', value: 6 }; // The start value (Q8)
    const lib = { id: 'lib-q74', name: 'Shade', persona: true, stats: [trust] };
    await EntityStorageService.storeEntity({ id: lib.id, name: lib.name, data: lib });
    onTestFinished(() => EntityStorageService.deleteEntity(lib.id));
    const live = mount();
    await act(async () => {
      live().setPersonaRef({ source: 'library', entityId: lib.id });
      live().setEntityStats({ [lib.id]: [{ ...trust, value: 33 }] });
    });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-q74'); });
    await act(async () => { await EntityStorageService.storeEntity({ id: lib.id, name: lib.name, data: { ...lib, stats: [trust, stock] } }); });
    await act(async () => { live().setEntityStats({}); });
    await act(async () => { await live().loadGame('save-q74', [], [authored], []); });
    await waitFor(() => expect(live().entityStats[lib.id]).toEqual([{ ...trust, value: 33 }, { ...stock, value: 6 }]));
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
    await act(async () => { await live().loadGame('save-owned-6', [], [authored], [{ id: 'cp' }]); });
    expect(live().ownedTraits).toEqual({ cp: { chosen: ['wizard'] } });
    await act(async () => { live().setPersonaRef({ source: 'library', entityId: 'lib' }); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-owned-7'); });
    await act(async () => { live().setOwnedTraits({}); });
    await act(async () => { await live().loadGame('save-owned-7', [], [authored], [{ id: 'cp' }]); });
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
    await act(async () => { live().setGlobalTraits([wizard]); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-node-era'); });
    await act(async () => { live().setGlobalTraits([]); });
    await act(async () => { await live().loadGame('save-node-era', [], [authored], [{ id: 'cp' }]); });
    expect(live().globalTraits).toEqual([wizard]);
    expect(live().ownedTraits).toEqual({});
    const scope = inPlayOwners(world, live().personaRef);
    expect(heldGlobalTraits(live().globalTraits, { traits: world.traits, groups: world.traitGroups, entities: world.entities, ...scope })).toEqual([]);
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
    expect(live().globalTraits.map((t) => t.id)).toEqual(['d']);
    expect(valueOf(live().globalStats)).toBe(70);

    // Undo loads the snapshot the turn before the switch left.
    await act(async () => {
      live().loadGameState(preTurn, [], { keepLiveHistory: true });
    });
    expect(slice(live())).toMatchObject({ traits: [], disabledTraitIds: [], appliedValues: {} });
    expect(valueOf(live().globalStats)).toBe(100);
  });
});

describe('code deltas across a save/load round trip', () => {
  const raiseCap: Trait = { id: 'r', name: 'Robust', statChanges: [{ statId: 'vigor', value: 30, type: 'max' }] };
  const statOf = (g: Gameplay) => g.globalStats.find((s) => s.id === 'vigor')!;

  it('loads a save with no code delta with none, its bounds as saved', async () => {
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
    expect('codeDelta' in loaded).toBe(false);
  });

  it('keeps a code delta through the round trip, and the next trait switch moves from it', async () => {
    const live = mount();
    const coded: PlayerStat = { ...seedStatBases([startStat])[0], max: 40, value: 40, codeDelta: { max: -60 } };
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
    expect(statOf(live())).toMatchObject({ max: 40, codeDelta: { max: -60 } });

    await act(async () => {
      commit(live(), setTraitEnabled(slice(live()), 'r', true, { traits: [raiseCap], groups: [] }).state);
    });
    expect(statOf(live())).toMatchObject({ max: 70, codeDelta: { max: -60 } });
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
