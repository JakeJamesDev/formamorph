import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import type { ChatMessage } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

let live: ReturnType<typeof useGameplay> | null = null;
const Expose = () => { live = useGameplay(); return null; };

const mount = () => {
  live = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Expose />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => {
    if (!live) throw new Error('gameplay not available');
    return live;
  };
};

describe('the save-state getter', () => {
  it('keeps one identity across state changes and reads the latest committed state', () => {
    const gameplay = mount();
    const getter = gameplay().saveCurrentGameState;

    act(() => { gameplay().setChoices(['Wave', 'Leave']); });
    const message: ChatMessage = { role: 'user', content: 'Look around' };
    act(() => { gameplay().setFullMessageHistory([message]); });
    act(() => { gameplay().setMetEntities(['mira']); });

    expect(gameplay().saveCurrentGameState).toBe(getter);
    const state = getter();
    expect(state.choices).toEqual(['Wave', 'Leave']);
    expect(state.fullMessageHistory).toEqual([message]);
    expect(state.metEntities).toEqual(['mira']);
  });
});
