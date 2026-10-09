import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import WorldEditor from './WorldEditor';
import type { World } from '@/types';

/**
 * The browser leave prompt: a `beforeunload` listener that lives while the editor is open and the world
 * is dirty. Both hosts (menu and in-game) render this same editor, so one bench covers both.
 */

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

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

const Harness = ({ children, onReady }: { children?: ReactNode; onReady: (ctx: ReturnType<typeof useGameData>) => void }) => {
  const ctx = useGameData();
  useEffect(() => { ctx.loadWorldData(WORLD); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx);
  return <>{children}</>;
};

/** The providers stay mounted when `open` flips, so the world keeps its edits while the editor goes away. */
const setup = () => {
  let ctx!: ReturnType<typeof useGameData>;
  const tree = (open: boolean) => (
    <SettingsProvider>
      <GameDataProvider>
        <Harness onReady={(c) => { ctx = c; }}>
          {open && <WorldEditor onClose={vi.fn()} embedded backButton />}
        </Harness>
      </GameDataProvider>
    </SettingsProvider>
  );
  const view = render(tree(true));
  return { ctx: () => ctx, close: () => view.rerender(tree(false)) };
};

const renameTo = (value: string) => {
  fireEvent.change(screen.getByDisplayValue('Sedge Landing'), { target: { value } });
};

/** Fires a tab close and reports whether the page asked the browser to confirm it. */
const leaveAsksToConfirm = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('WorldEditor — browser leave prompt', () => {
  it('asks to confirm a close while the world has unsaved changes', () => {
    setup();
    renameTo('Sedge Landing EDITED');
    expect(leaveAsksToConfirm()).toBe(true);
  });

  it('stays quiet while the world is clean', () => {
    setup();
    expect(leaveAsksToConfirm()).toBe(false);
  });

  it('stops asking once the edits are saved', async () => {
    const { ctx } = setup();
    renameTo('Sedge Landing EDITED');
    await act(async () => { await ctx().saveWorld(); });
    expect(ctx().isWorldDirty).toBe(false);
    expect(leaveAsksToConfirm()).toBe(false);
  });

  it('removes the listener when the editor closes with edits still pending', () => {
    const { ctx, close } = setup();
    renameTo('Sedge Landing EDITED');
    close();
    // The world is still dirty; only the editor is gone, so a leaked listener would still fire.
    expect(ctx().isWorldDirty).toBe(true);
    expect(leaveAsksToConfirm()).toBe(false);
  });
});
