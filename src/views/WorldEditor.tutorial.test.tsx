import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { TUTORIAL_APPEAR_DELAY_MS, resetTutorials, seenTutorials } from '@/lib/tutorials';
import WorldEditor from './WorldEditor';
import type { World } from '@/types';

/**
 * The Simple/Advanced tutorial, through the real editor JSX. `tutorials.test.ts` covers the store; what
 * these guard is the wiring — that the editor mounts a tutorial at all, and that using the switch counts
 * as reading it. Both are call sites an isolated store test cannot see.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(),
  parseJsonText: vi.fn(),
  terminateWorker: vi.fn(),
}));

const WORLD = {
  id: 'w1',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [],
  },
  stats: [], locations: [], entities: [], traits: [], statUpdates: [],
} as unknown as World;

const Harness = ({ children }: { children?: ReactNode }) => {
  const ctx = useGameData();
  useEffect(() => { ctx.loadWorldData(WORLD); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <>{children}</>;
};

const setup = () => render(
  <SettingsProvider>
    <GameDataProvider>
      <Harness>
        <WorldEditor onClose={vi.fn()} embedded />
      </Harness>
    </GameDataProvider>
  </SettingsProvider>,
);

/** Past the appear delay, with React flushing the state change it schedules. */
const settle = () => act(() => { vi.advanceTimersByTime(TUTORIAL_APPEAR_DELAY_MS + 50); });

beforeEach(() => {
  localStorage.clear();
  resetTutorials();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('World Editor tutorial', () => {
  it('holds off until the appear delay, then explains the mode switch', () => {
    setup();
    expect(screen.queryByText('Simple vs. Advanced')).not.toBeInTheDocument();
    settle();
    expect(screen.getByText('Simple vs. Advanced')).toBeInTheDocument();
  });

  it('retires for good once acknowledged', () => {
    const view = setup();
    settle();
    fireEvent.click(screen.getByRole('button', { name: 'Got It' }));
    expect(screen.queryByText('Simple vs. Advanced')).not.toBeInTheDocument();
    expect(seenTutorials()).toContain('world-editor-mode-toggle');

    view.unmount();
    setup();
    settle();
    expect(screen.queryByText('Simple vs. Advanced')).not.toBeInTheDocument();
  });

  it('counts using the switch as reading it', () => {
    setup();
    settle();
    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    expect(screen.queryByText('Simple vs. Advanced')).not.toBeInTheDocument();
    expect(seenTutorials()).toContain('world-editor-mode-toggle');
  });

  it('survives a stray click elsewhere and comes back next visit', () => {
    const view = setup();
    settle();
    // Radix arms its outside-dismiss listener in a timer, so that has to flush before the click lands or
    // there is nothing listening and the assertion passes for the wrong reason.
    act(() => { vi.advanceTimersByTime(50); });
    act(() => {
      fireEvent.pointerDown(document.body);
      fireEvent.focusOut(document.body);
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByText('Simple vs. Advanced')).toBeInTheDocument();
    expect(seenTutorials()).not.toContain('world-editor-mode-toggle');

    view.unmount();
    setup();
    settle();
    expect(screen.getByText('Simple vs. Advanced')).toBeInTheDocument();
  });
});
