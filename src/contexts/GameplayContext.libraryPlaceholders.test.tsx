// Real in-memory storage for saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider, useGameData } from './GameDataContext';
import { PlaceholderSessionProvider, usePlaceholderSession } from './PlaceholderSessionContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { encodePlaceholderToken, newPlaceholder } from '@/lib/placeholders';
import { INITIAL_SOURCE_TURN_ID } from '@/lib/runtimeCharacters';
import { worldFixture } from '@/test/gamePanels';
import type { Dictionary, Entity } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

interface Live {
  gameplay: ReturnType<typeof useGameplay>;
  gameData: ReturnType<typeof useGameData>;
  session: ReturnType<typeof usePlaceholderSession>;
  world: ReturnType<typeof useResolvedWorld>;
}

const Expose = ({ expose }: { expose: (l: Live) => void }) => {
  expose({ gameplay: useGameplay(), gameData: useGameData(), session: usePlaceholderSession(), world: useResolvedWorld() });
  return null;
};

const mount = () => {
  let live: Live | null = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Expose expose={(l) => { live = l; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => {
    if (!live) throw new Error('contexts not available (did the render throw?)');
    return live as Live;
  };
};

const chip = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'world', placementId });

const TOWN = newPlaceholder('Town', ['Sedge', 'Marrow']);
// Many values, so a redraw would almost surely land on a different one.
const MOODS = Array.from({ length: 40 }, (_, i) => `mood-${i}`);
const MOOD = newPlaceholder('Mood', MOODS);
const TIDES = Array.from({ length: 40 }, (_, i) => `tide-${i}`);
const TIDE = newPlaceholder('Tide', TIDES);

const pip: Entity = { id: 'l-pip', name: 'Pip', aiDescription: `Pip seems ${chip(MOOD.id, 'p-mood')}.`, placeholders: [MOOD] };
const almanac: Dictionary = {
  id: 'run-almanac', name: 'Almanac', placeholders: [TIDE],
  entries: [{ id: 'e-sea', name: 'Sea', key: ['sea'], value: `The sea runs at ${chip(TIDE.id, 'a-tide')}.` }],
};
const lore: Dictionary = { id: 'lore', name: 'Lore', entries: [] };

/** Opens a session on a world with one Wildcard and one book, then seeds the cast and books Enter World picked. */
const start = async () => {
  const live = mount();
  await act(async () => {
    live().gameData.loadWorldData(worldFixture({ placeholders: [TOWN], entities: [], dictionaries: [lore] }));
    live().session.beginSession();
  });
  await act(async () => {
    live().gameplay.setDiscoveredEntities([{ entity: pip, locationId: 'dock', sourceTurnId: INITIAL_SOURCE_TURN_ID }]);
    live().gameplay.setRuntimeDictionaries([lore, almanac]);
  });
  return live;
};

/** Pip's description and the Almanac entry as a turn's prompt reads them. */
const pipText = (live: () => Live) => live().world.resolveEntityText(pip, pip.aiDescription!);
const seaText = (live: () => Live) => live().world.resolvePH(almanac.entries[0].value);
const moodIn = (text: string) => text.match(/^Pip seems (mood-\d+)\.$/)?.[1] ?? null;
const tideIn = (text: string) => text.match(/^The sea runs at (tide-\d+)\.$/)?.[1] ?? null;

describe('placeholders of added characters and library books', () => {
  it('resolve to rolled values that stay the same across turns', async () => {
    const live = await start();
    await waitFor(() => expect(moodIn(pipText(live))).not.toBeNull());
    await waitFor(() => expect(tideIn(seaText(live))).not.toBeNull());
    const mood = moodIn(pipText(live));
    const tide = tideIn(seaText(live));

    // A turn's state writes, then an undo back to it: both read the same roll throughout.
    const snapshot = live().gameplay.saveCurrentGameState();
    await act(async () => { live().gameplay.setPlayerStats([]); });
    expect(moodIn(pipText(live))).toBe(mood);
    await act(async () => { live().gameplay.loadGameState(snapshot, [], { keepLiveHistory: true }); });
    expect(moodIn(pipText(live))).toBe(mood);
    expect(tideIn(seaText(live))).toBe(tide);
  });

  it('join the session set on the read side only, leaving the authored world untouched', async () => {
    const live = await start();
    await waitFor(() => expect(live().session.placeholders.map((p) => p.name)).toEqual(['Town', 'Mood', 'Tide']));
    expect(live().gameData.placeholders.map((p) => p.name)).toEqual(['Town']);
    expect(live().gameplay.libraryDictionaries).toEqual([almanac]);
  });

  it('keep their rolls through a save and a reload', async () => {
    const live = await start();
    await waitFor(() => expect(moodIn(pipText(live))).not.toBeNull());
    await waitFor(() => expect(tideIn(seaText(live))).not.toBeNull());
    const mood = moodIn(pipText(live));
    const tide = tideIn(seaText(live));
    await act(async () => { await live().gameplay.saveGame('slot', 'World', 'w1', 'library-rolls'); });

    await act(async () => {
      live().session.endSession();
      live().gameplay.setDiscoveredEntities([]);
      live().gameplay.setRuntimeDictionaries([]);
    });
    await act(async () => { live().session.beginSession(); });
    await act(async () => { await live().gameplay.loadGame('library-rolls', []); });
    await waitFor(() => expect(live().session.placeholders.map((p) => p.name)).toEqual(['Town', 'Mood', 'Tide']));
    expect(moodIn(pipText(live))).toBe(mood);
    expect(tideIn(seaText(live))).toBe(tide);
  });

  it('let a Code Pin mask the roll, and bring the roll back when the pin goes', async () => {
    const live = await start();
    await waitFor(() => expect(moodIn(pipText(live))).not.toBeNull());
    await waitFor(() => expect(tideIn(seaText(live))).not.toBeNull());
    const mood = moodIn(pipText(live));
    const pinnedMood = MOODS.find((m) => m !== mood)!;
    const pinnedTide = TIDES.find((t) => t !== tideIn(seaText(live)))!;

    await act(async () => { live().gameplay.setCodePins({ [MOOD.id]: pinnedMood, [TIDE.id]: pinnedTide }); });
    expect(moodIn(pipText(live))).toBe(pinnedMood);
    expect(tideIn(seaText(live))).toBe(pinnedTide);
    await act(async () => { live().gameplay.setCodePins({}); });
    expect(moodIn(pipText(live))).toBe(mood);
  });

  it('leave a character the narrator invents out of the set', async () => {
    const live = await start();
    const invented: Entity = { id: 'r-gull', name: 'Gull', placeholders: [newPlaceholder('Wing', ['torn'])] };
    await act(async () => {
      live().gameplay.setDiscoveredEntities((prev) => [...prev, { entity: invented, sourceTurnId: 'turn-3' }]);
    });
    await waitFor(() => expect(live().session.placeholders.map((p) => p.name)).toEqual(['Town', 'Mood', 'Tide']));
  });
});

describe('drawing library rolls when the cast is set', () => {
  it('returns the rolls at once, so a page-one opening reads what later turns read', async () => {
    const live = mount();
    await act(async () => {
      live().gameData.loadWorldData(worldFixture({ placeholders: [TOWN], entities: [] }));
      live().session.beginSession();
    });
    let pageOne = '';
    await act(async () => {
      const rolls = live().session.setLibraryAdditions([pip], [almanac]);
      expect(rolls.world?.[TIDE.id]).toMatch(/^tide-\d+$/);
      pageOne = live().world.resolveOpening(pip.aiDescription!, { rolls, libraryAdditions: [pip, almanac], owner: pip });
    });
    expect(moodIn(pageOne)).not.toBeNull();
    await waitFor(() => expect(live().session.rolls.world?.[MOOD.id]).toBe(moodIn(pageOne)));
  });

  it('draws the cast again for a new game set in the same pass that ends the last one', async () => {
    const live = mount();
    await act(async () => {
      live().gameData.loadWorldData(worldFixture({ placeholders: [TOWN], entities: [] }));
      live().session.beginSession();
    });
    await act(async () => { live().session.setLibraryAdditions([pip], [almanac]); });
    let rolls: ReturnType<Live['session']['setLibraryAdditions']> = {};
    await act(async () => {
      live().session.endSession();
      live().session.beginSession();
      rolls = live().session.setLibraryAdditions([pip], [almanac]);
    });
    expect(live().session.placeholders.map((p) => p.name)).toEqual(['Town', 'Mood', 'Tide']);
    expect(live().session.rolls.world?.[MOOD.id]).toBe(rolls.world?.[MOOD.id]);
    expect(MOODS).toContain(rolls.world?.[MOOD.id]);
  });
});
