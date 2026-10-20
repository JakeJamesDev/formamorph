// Entity positions across a save/load round trip. Storage is real (in-memory) — the provider writes to
// IndexedDB. Must be imported before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import type { Entity, GameLocation } from '@/types';

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

const place = (id: string): GameLocation => ({ id, name: id });
const keep = place('keep');
const tower = place('tower');
const merchant: Entity = { id: 'merchant', name: 'Merchant', presence: 'random', locations: ['keep', 'tower'] };
const guard: Entity = { id: 'guard', name: 'Guard', locations: ['keep'] };

describe('entity positions in the save', () => {
  it('keeps a position across a save and a load', async () => {
    const live = mount();
    await act(async () => { live().setEntityPositions({ merchant: 'tower' }); });
    expect(live().saveCurrentGameState().entityPositions).toEqual({ merchant: 'tower' });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-pos-1'); });
    await act(async () => { live().setEntityPositions({}); });
    await act(async () => { await live().loadGame('save-pos-1', [keep, tower], [], [merchant, guard]); });
    expect(live().entityPositions).toEqual({ merchant: 'tower' });
  });

  it('writes no field when nobody has a position', () => {
    const live = mount();
    expect('entityPositions' in live().saveCurrentGameState()).toBe(false);
  });

  it("re-places a position on a deleted location and drops a deleted entity's", async () => {
    const live = mount();
    await act(async () => { live().setEntityPositions({ merchant: 'tower', gone: 'keep' }); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-pos-2'); });
    // The tower is gone, so the keep is the merchant's only live location.
    await act(async () => { await live().loadGame('save-pos-2', [keep], [], [merchant, guard]); });
    expect(live().entityPositions).toEqual({ merchant: 'keep' });
  });

  it('keeps the followers across a save and a load, and drops a deleted one', async () => {
    const live = mount();
    await act(async () => {
      live().setEntityPositions({ merchant: 'tower' });
      live().setEntityFollowers(['merchant', 'gone']);
    });
    expect(live().saveCurrentGameState().entityFollowers).toEqual(['merchant', 'gone']);
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-pos-4'); });
    await act(async () => { live().setEntityFollowers([]); });
    await act(async () => { await live().loadGame('save-pos-4', [keep, tower], [], [merchant, guard]); });
    expect(live().entityFollowers).toEqual(['merchant']);
    expect('entityFollowers' in mount()().saveCurrentGameState()).toBe(false);
  });

  it('keeps the met set across a save and a load', async () => {
    const live = mount();
    await act(async () => { live().setMetEntities(['guard', 'merchant']); });
    expect(live().saveCurrentGameState().metEntities).toEqual(['guard', 'merchant']);
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-pos-5'); });
    await act(async () => { live().setMetEntities([]); });
    await act(async () => { await live().loadGame('save-pos-5', [keep, tower], [], [merchant, guard]); });
    expect(live().metEntities).toEqual(['guard', 'merchant']);
    expect('metEntities' in mount()().saveCurrentGameState()).toBe(false);
  });

  it('brings the followers along on a move with no turn, as Map travel makes', async () => {
    const live = mount();
    await act(async () => {
      live().setEntityPositions({ merchant: 'keep', guard: 'keep' });
      live().setEntityFollowers(['merchant']);
    });
    await act(async () => { live().changeLocation(tower); });
    expect(live().entityPositions).toEqual({ merchant: 'tower', guard: 'keep' });
  });

  describe('a runtime character following', () => {
    const mira = { entity: { id: 'mira', name: 'Mira', aiDescription: 'A ferry hand.' }, locationId: 'keep', sourceTurnId: 't1' };

    it('moves its own anchor on Map travel, never a world position', async () => {
      const live = mount();
      await act(async () => {
        live().setDiscoveredEntities([mira]);
        live().setEntityFollowers(['mira']);
      });
      await act(async () => { live().changeLocation(tower); });
      expect(live().discoveredEntities[0].locationId).toBe('tower');
      expect(live().entityPositions).toEqual({});
    });

    it('joins the cast when a join peels it off, and survives a save and a load', async () => {
      const live = mount();
      const peeled = { ...mira, locationId: 'tower', peeledFrom: 'guard' };
      await act(async () => { live().applyFollowerState({ positions: { mira: 'tower' }, followers: ['mira'] }, [peeled]); });
      expect(live().discoveredEntities).toEqual([peeled]);
      expect(live().entityPositions).toEqual({});
      await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-pos-5'); });
      await act(async () => { await live().loadGame('save-pos-5', [keep, tower], [], [merchant, guard]); });
      expect(live().entityFollowers).toEqual(['mira']);
      expect(live().discoveredEntities).toEqual([peeled]);
    });

    it('keeps a follower peeled and carried in one batch on its own anchor', async () => {
      const live = mount();
      const peeled = { ...mira, locationId: 'keep', peeledFrom: 'guard' };
      await act(async () => {
        live().applyFollowerState({ positions: { mira: 'keep' }, followers: ['mira'] }, [peeled]);
        live().changeLocation(tower);
      });
      expect(live().entityPositions).toEqual({});
      expect(live().discoveredEntities[0].locationId).toBe('tower');
    });
  });

  it('gives the played persona no position on load', async () => {
    const live = mount();
    await act(async () => {
      live().setEntityPositions({ merchant: 'tower' });
      live().setPersonaRef({ source: 'world', entityId: 'merchant' });
    });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'save-pos-3'); });
    await act(async () => { await live().loadGame('save-pos-3', [keep, tower], [], [merchant, guard]); });
    expect(live().entityPositions).toEqual({});
  });
});
