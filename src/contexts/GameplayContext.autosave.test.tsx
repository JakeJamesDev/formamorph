// Real in-memory storage for saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { autosaveName } from '@/lib/autosave';
import type { ChatMessage } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
vi.mock('react-toastify', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() } }));

const Probe = ({ expose }: { expose: (g: ReturnType<typeof useGameplay>) => void }) => {
  expose(useGameplay());
  return null;
};

const mount = () => {
  let live: ReturnType<typeof useGameplay> | null = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Probe expose={(g) => { live = g; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => live!;
};

const turns = (n: number): ChatMessage[] => Array.from({ length: n }, (_, i) => [
  { role: 'user' as const, content: `Action ${i + 1}.` },
  { role: 'assistant' as const, content: `Narration ${i + 1}.` },
]).flat();

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
});

describe('an autosave whose next turn lands before it is written', () => {
  it('holds its own turn, so the next turn keeps it as a separate slot', async () => {
    const live = mount();
    act(() => { live().setFullMessageHistory(turns(1)); });

    let first!: Promise<boolean>;
    act(() => { first = live().autosaveGame('World', 'w1', 1, 2); });
    // The next turn commits while the first autosave is still reading the store.
    act(() => { live().setFullMessageHistory(turns(2)); });
    await act(async () => { await live().autosaveGame('World', 'w1', 2, 2); await first; });

    const saved = (await getAllSaveRecords()).map((r) => [r.name, r.messageHistory?.length]);
    expect(saved).toEqual(expect.arrayContaining([[autosaveName(1), 2], [autosaveName(2), 4]]));
    expect(saved).toHaveLength(2);
  });

  it('is replaced by the next turn when the world keeps one slot', async () => {
    const live = mount();
    act(() => { live().setFullMessageHistory(turns(1)); });

    let first!: Promise<boolean>;
    act(() => { first = live().autosaveGame('World', 'w1', 1, 1); });
    act(() => { live().setFullMessageHistory(turns(2)); });
    await act(async () => { await live().autosaveGame('World', 'w1', 2, 1); await first; });

    expect((await getAllSaveRecords()).map((r) => [r.name, r.messageHistory?.length])).toEqual([[autosaveName(2), 4]]);
  });
});
