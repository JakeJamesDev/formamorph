// Real in-memory storage for saves and the entity library; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider, useGameData } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { getSaveRecord } from '@/components/modals/dbUtils';
import EntityStorageService from '@/services/EntityStorageService';
import { worldFixture } from '@/test/gamePanels';
import type { Entity, GameState, PersonaRef, SaveRecord } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

interface Live {
  gameplay: ReturnType<typeof useGameplay>;
  gameData: ReturnType<typeof useGameData>;
  world: ReturnType<typeof useResolvedWorld>;
}

const Expose = ({ expose }: { expose: (l: Live) => void }) => {
  expose({ gameplay: useGameplay(), gameData: useGameData(), world: useResolvedWorld() });
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

const mira: Entity = { id: 'w-mira', name: 'Mira', aliases: ['Matron'], persona: true, locations: ['dock', 'inn'] };
const vos: Entity = { id: 'w-vos', name: 'Captain Vos', locations: ['dock'] };

const loadWorld = async (live: () => Live) => {
  await act(async () => { live().gameData.loadWorldData(worldFixture({ entities: [mira, vos] })); });
};

const storeLibraryEntity = (entity: Entity) =>
  EntityStorageService.storeEntity({ id: entity.id, name: entity.name, data: entity });

const castNames = (live: () => Live) => live().world.entities.map((e) => e.name);

describe('the persona reference across a save/load round trip', () => {
  const states: Array<{ label: string; ref: PersonaRef }> = [
    { label: 'world entity', ref: { source: 'world', entityId: 'w-mira' } },
    { label: 'library entity', ref: { source: 'library', entityId: 'l-wren' } },
    { label: 'explicit None', ref: { source: 'none' } },
  ];

  it.each(states)('loads a $label reference back unchanged', async ({ label, ref }) => {
    const live = mount();
    const saveId = `persona-${label}`;
    await act(async () => { live().gameplay.setPersonaRef(ref); });
    await act(async () => { await live().gameplay.saveGame('slot', 'World', 'w1', saveId); });

    await act(async () => { live().gameplay.setPersonaRef(undefined); });
    await act(async () => { await live().gameplay.loadGame(saveId, []); });
    expect(live().gameplay.personaRef).toEqual(ref);
  });

  it('writes no field when there is no reference, and loads that save with no persona', async () => {
    const live = mount();
    await loadWorld(live);
    await act(async () => { await live().gameplay.saveGame('slot', 'World', 'w1', 'persona-absent'); });
    const record = await getSaveRecord('persona-absent') as SaveRecord;
    expect('persona' in record).toBe(false);

    // A reference left over from an earlier playthrough must not survive the load.
    await act(async () => { live().gameplay.setPersonaRef({ source: 'world', entityId: 'w-mira' }); });
    await act(async () => { await live().gameplay.loadGame('persona-absent', []); });
    expect(live().gameplay.personaRef).toBeUndefined();
    expect(live().world.persona).toBeNull();
    expect(live().world.personaUnresolved).toBe(false);
    expect(castNames(live)).toEqual(['Mira', 'Captain Vos']);
  });

  it('keeps the reference when an undo restores an earlier turn', async () => {
    const live = mount();
    const ref: PersonaRef = { source: 'world', entityId: 'w-mira' };
    await act(async () => { live().gameplay.setPersonaRef(ref); });
    const snapshot: GameState = live().gameplay.saveCurrentGameState();
    await act(async () => { live().gameplay.loadGameState(snapshot, [], { keepLiveHistory: true }); });
    expect(live().gameplay.personaRef).toEqual(ref);
  });
});

describe('the resolved world under a persona', () => {
  it('drops a played world entity from the cast and names the player by it', async () => {
    const live = mount();
    await loadWorld(live);
    await act(async () => { live().gameplay.setPersonaRef({ source: 'world', entityId: 'w-mira' }); });
    expect(castNames(live)).toEqual(['Captain Vos']);
    expect(live().world.persona?.entity.name).toBe('Mira');
    expect(live().world.playerNames).toEqual(['Mira', 'Matron']);
    // The authored world is untouched: the cast is a view.
    expect(live().gameData.entities.map((e) => e.name)).toEqual(['Mira', 'Captain Vos']);
  });

  it('reads a library persona live, at load and when the library changes', async () => {
    await EntityStorageService.initialize();
    await storeLibraryEntity({ id: 'l-wren', name: 'Wren', persona: true });
    const live = mount();
    await loadWorld(live);
    await act(async () => { live().gameplay.setPersonaRef({ source: 'library', entityId: 'l-wren' }); });

    await waitFor(() => expect(live().world.persona?.entity.name).toBe('Wren'));
    expect(castNames(live)).toEqual(['Mira', 'Captain Vos']);

    await act(async () => { await storeLibraryEntity({ id: 'l-wren', name: 'Wren Ashdown', aliases: ['Little Bird'], persona: true }); });
    await waitFor(() => expect(live().world.playerNames).toEqual(['Wren Ashdown', 'Little Bird']));

    await act(async () => { await EntityStorageService.deleteEntity('l-wren'); });
    await waitFor(() => expect(live().world.persona).toBeNull());
    expect(live().world.personaUnresolved).toBe(true);
  });

  it('does not report a library persona as missing while its read is in flight', async () => {
    const live = mount();
    await loadWorld(live);
    act(() => { live().gameplay.setPersonaRef({ source: 'library', entityId: 'l-never-stored' }); });
    expect(live().world.personaUnresolved).toBe(false);
    await waitFor(() => expect(live().world.personaUnresolved).toBe(true));
  });
});
