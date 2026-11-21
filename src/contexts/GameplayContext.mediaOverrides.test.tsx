// Script media overrides in the save envelope: they survive a save and load, and loading the turn snapshot from
// before they were set, as a rewind does, takes them away. Storage is real (in-memory IndexedDB).
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { withMediaWrites } from '@/lib/mediaOverrides';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

type Gameplay = ReturnType<typeof useGameplay>;

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

const scripted = withMediaWrites({}, [
  { owner: { kind: 'entity', id: 'e-mira' }, field: 'image', mediaId: 'm-hurt' },
  { owner: { kind: 'instance', entityId: 'e-guard', startId: 's-north' }, field: 'image', mediaId: 'm-captain' },
  { owner: { kind: 'world' }, field: 'music', mediaId: 'm-theme' },
  { owner: { kind: 'entity', id: 'e-mira' }, entryId: 'm-rig', layerId: 'l-hat', field: 'variant', value: 'm-cap' },
  { owner: { kind: 'instance', entityId: 'e-guard', startId: 's-north' }, entryId: 'm-rig', layerId: 'l-hat', field: 'opacity', value: 0.5 },
  { owner: { kind: 'item', id: 'c-1' }, entryId: 'm-rig', layerId: 'l-hat', field: 'tint', value: '#ff8800' },
]);

describe('script media overrides in the save', () => {
  it('hold the Layer settings beside the entry overrides', () => {
    expect(scripted.layers).toEqual({
      entities: { 'e-mira': { 'm-rig': { 'l-hat': { variant: 'm-cap' } } } },
      instances: { 'e-guard': { 's-north': { 'm-rig': { 'l-hat': { opacity: 0.5 } } } } },
      items: { 'c-1': { 'm-rig': { 'l-hat': { tint: '#ff8800' } } } },
    });
  });

  it('survive a save and load, and a rewind to the turn before them undoes them', async () => {
    const live = mount();
    const before = live().saveCurrentGameState();
    expect(before.mediaOverrides).toBeUndefined();

    await act(async () => { live().setMediaOverrides(scripted); });
    expect(live().saveCurrentGameState().mediaOverrides).toEqual(scripted);
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-media'); });

    // A different session: nothing of the playthrough is in memory any more.
    await act(async () => { live().setMediaOverrides({}); });
    await act(async () => { await live().loadGame('save-media', [], []); });
    expect(live().mediaOverrides).toEqual(scripted);

    // A rewind loads the earlier turn's snapshot over the live history.
    await act(async () => { live().loadGameState(before, [], { keepLiveHistory: true }); });
    expect(live().mediaOverrides).toEqual({});
  });
});
