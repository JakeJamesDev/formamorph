// Real in-memory storage for worlds and saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider, useGameData } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { getSaveRecord } from '@/components/modals/dbUtils';
import WorldStorageService, { type StoredWorldRecord } from '@/services/WorldStorageService';
import type { SaveRecord, World } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

/** A save stores its world's books; a Supporter Copy's must keep the marker wherever they go next. */

const MARKER = { listingId: 'listing-1', accountId: 'me', revision: 1 };

const world = (id: string): World => ({
  id,
  worldOverview: { name: id, description: '', author: '', systemPrompt: '', tags: [] },
  stats: [], statUpdates: [], traits: [], entities: [], locations: [],
  dictionaries: [{ id: `${id}-book`, name: 'Lore', entries: [], thumbnail: 'data:image/webp;base64,AAAA' }],
} as unknown as World);

const store = (id: string, marker?: typeof MARKER) => WorldStorageService.storeWorld({
  id, name: id, data: world(id), ...(marker ? { supporterCopy: marker } : {}),
} as unknown as StoredWorldRecord);

const mount = () => {
  let play: ReturnType<typeof useGameplay> | null = null;
  let data: ReturnType<typeof useGameData> | null = null;
  const Expose = () => { play = useGameplay(); data = useGameData(); return null; };
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider><Expose /></GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return { play: () => play!, data: () => data! };
};

/** Open a stored world, start its playthrough with its books, and let the marker read answer. */
const open = async (live: ReturnType<typeof mount>, id: string) => {
  act(() => { live.data().loadWorldData(world(id), false, { stored: true }); });
  act(() => { live.play().setRuntimeDictionaries(world(id).dictionaries); });
  await waitFor(() => expect(live.data().supporterCopy).not.toBeUndefined());
};

const saved = async (id: string) => (await getSaveRecord(id)) as SaveRecord;

describe('saves of a Supporter Copy', () => {
  it('stamps a save of a Supporter Copy, and leaves a plain world’s save unstamped', async () => {
    await store('sc-world', MARKER);
    await store('plain-world');
    const live = mount();

    await open(live, 'sc-world');
    await act(async () => { await live.play().saveGame('slot', 'sc-world', 'sc-world', 'sc-save'); });
    expect((await saved('sc-save')).supporterCopy).toEqual(MARKER);

    await open(live, 'plain-world');
    await act(async () => { await live.play().saveGame('slot', 'plain-world', 'plain-world', 'plain-save'); });
    expect('supporterCopy' in await saved('plain-save')).toBe(false);
  });

  it('never shows the last world’s answer for a world just opened', async () => {
    await store('sc-switch', MARKER);
    await store('plain-switch');
    const live = mount();
    await open(live, 'plain-switch');
    expect(live.data().supporterCopy).toBeNull();

    act(() => { live.data().loadWorldData(world('sc-switch'), false, { stored: true }); });
    expect(live.data().supporterCopy).toBeUndefined();
    await waitFor(() => expect(live.data().supporterCopy).toEqual(MARKER));
  });

  it('stamps a save written before the world’s marker read answers', async () => {
    await store('sc-early', MARKER);
    const live = mount();
    await act(async () => {
      live.data().loadWorldData(world('sc-early'), false, { stored: true });
      live.play().setRuntimeDictionaries(world('sc-early').dictionaries);
      await live.play().saveGame('slot', 'sc-early', 'sc-early', 'early-save');
    });
    expect((await saved('early-save')).supporterCopy).toEqual(MARKER);
  });

  it('keeps the stamp when a stamped save is loaded into another world and saved again', async () => {
    await store('sc-world', MARKER);
    await store('plain-world');
    const live = mount();
    await open(live, 'sc-world');
    await act(async () => { await live.play().saveGame('slot', 'sc-world', 'sc-world', 'carry-source'); });

    await open(live, 'plain-world');
    await act(async () => { await live.play().loadGame('carry-source', []); });
    await act(async () => { await live.play().saveGame('slot', 'plain-world', 'plain-world', 'carry-again'); });
    expect((await saved('carry-again')).supporterCopy).toEqual(MARKER);

    // A new playthrough seeds its own books, and the carried stamp goes with the old ones.
    act(() => { live.play().setRuntimeDictionaries(world('plain-world').dictionaries); });
    await act(async () => { await live.play().saveGame('slot', 'plain-world', 'plain-world', 'fresh-run'); });
    expect('supporterCopy' in await saved('fresh-run')).toBe(false);
  });
});
