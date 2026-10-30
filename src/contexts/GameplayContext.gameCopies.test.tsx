import 'fake-indexeddb/auto';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameDataProvider } from '@/contexts/GameDataContext';
import { GameplayProvider, useGameplay } from '@/contexts/GameplayContext';
import { PlaceholderSessionProvider } from '@/contexts/PlaceholderSessionContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { getSaveRecord } from '@/components/modals/dbUtils';
import type { GameCopies } from '@/lib/gameCopies';

/** A game's copies through the snapshot and the save: what a rollback and a load read back. */

vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>{children}</GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>
  </SettingsProvider>
);

const FIRST: GameCopies = { entities: { ren: { pronouns: 'he/him' } } };
const LATER: GameCopies = { entities: { ren: { pronouns: 'they/them' } }, world: { aiDescription: 'Foxes.' } };

describe('game copies in the game state', () => {
  it('takes a snapshot of them, and a rollback brings that snapshot back', () => {
    const { result } = renderHook(() => useGameplay(), { wrapper });
    act(() => result.current.setGameCopies(FIRST));
    const snapshot = result.current.saveCurrentGameState();
    expect(snapshot.copies).toEqual(FIRST);

    act(() => result.current.setGameCopies(LATER));
    act(() => { result.current.loadGameState(snapshot, [], { keepLiveHistory: true }); });
    expect(result.current.gameCopies).toEqual(FIRST);
  });

  it('leaves the field out of a snapshot with none, so a rollback clears later ones', () => {
    const { result } = renderHook(() => useGameplay(), { wrapper });
    const snapshot = result.current.saveCurrentGameState();
    expect('copies' in snapshot).toBe(false);

    act(() => result.current.setGameCopies(LATER));
    act(() => { result.current.loadGameState(snapshot, [], { keepLiveHistory: true }); });
    expect(result.current.gameCopies).toEqual({});
  });

  it('writes them into the save, and a load brings them back', async () => {
    const { result } = renderHook(() => useGameplay(), { wrapper });
    act(() => result.current.setGameCopies(LATER));
    let saved = false;
    await act(async () => { saved = await result.current.saveGame('Copies', 'Sedge Landing', 'w1', 'save-1'); });
    expect(saved).toBe(true);
    expect((await getSaveRecord('save-1'))?.currentState.copies).toEqual(LATER);

    act(() => result.current.setGameCopies({}));
    await act(async () => { await result.current.loadGame('save-1', [], []); });
    expect(result.current.gameCopies).toEqual(LATER);
  });
});
