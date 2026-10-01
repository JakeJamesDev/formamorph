// Real in-memory storage; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { turnActivity } from '@/lib/turnActivity';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const Expose = ({ expose }: { expose: (g: ReturnType<typeof useGameplay>) => void }) => {
  expose(useGameplay());
  return null;
};

describe('the turn activity outside the game view', () => {
  it('follows the turn, and ends when the game view goes', async () => {
    let live: ReturnType<typeof useGameplay> | null = null;
    const view = render(
      <GameDataProvider>
        <PlaceholderSessionProvider>
          <GameplayProvider>
            <Expose expose={(g) => { live = g; }} />
          </GameplayProvider>
        </PlaceholderSessionProvider>
      </GameDataProvider>,
    );
    expect(turnActivity.get()).toBe(false);

    await act(async () => { live!.setIsWaitingForAI(true); });
    expect(turnActivity.get()).toBe(true);
    await act(async () => { live!.setIsWaitingForAI(false); });
    expect(turnActivity.get()).toBe(false);

    await act(async () => { live!.setIsWaitingForAI(true); });
    view.unmount();
    expect(turnActivity.get()).toBe(false);
  });
});
