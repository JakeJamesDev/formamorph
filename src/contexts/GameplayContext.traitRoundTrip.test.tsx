// The join between the trait runtime and the save envelope: a movement record has to survive a save/load
// round trip, because that is where the ratchet it exists to prevent would come back. Storage is real
// (in-memory) — the provider writes to IndexedDB. Must be imported before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { acquireTrait, seedStatBases, setTraitEnabled, type TraitRuntimeState } from '@/lib/traitRuntime';
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
});

const commit = (g: Gameplay, next: TraitRuntimeState) => {
  g.setPlayerStats(next.stats);
  g.setPlayerTraits(next.traits);
  g.setDisabledTraitIds(next.disabledTraitIds);
  g.setAppliedTraitValues(next.appliedValues);
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
