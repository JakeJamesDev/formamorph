/**
 * Shared harness for the World Editor Bench suites: the real editor mounted over real providers around one
 * authored world, so each suite tests its own wiring rather than re-declaring the mount. Service mocks stay
 * in the test files — `vi.mock` is hoisted per file — but the fixture, the mount, and its lint exception
 * live here once.
 */
import { useEffect, type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import WorldEditor from '@/views/WorldEditor';
import type { World } from '@/types';

// jsdom has no matchMedia; SettingsProvider (theme) and useIsMobile (layout) both read it on mount.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** A loadable world with the base a suite doesn't care about filled in: a named overview and a flagged
 *  starting location. The cast is deliberate — a suite supplies only the slices its tests are about, the
 *  way hand-authored world JSON arrives with fields the types call required simply absent. */
export const benchEditorWorld = (over: Partial<World>): World => ({
  id: 'w1',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [],
  },
  stats: [],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: [], placeholders: [], traits: [], statUpdates: [],
  ...over,
} as unknown as World);

type GameDataHandle = ReturnType<typeof useGameData>;

// eslint-disable-next-line react-refresh/only-export-components -- test-only module; nothing is hot-reloaded
const Harness = ({ world, children, onReady }: {
  world: World;
  children?: ReactNode;
  onReady: (ctx: GameDataHandle) => void;
}) => {
  const ctx = useGameData();
  useEffect(() => { ctx.loadWorldData(world); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx);
  return <>{children}</>;
};

/** Mount the editor over `world`; `ctx()` reads the live GameData handle for state assertions. */
export const renderWorldEditorBench = (world: World) => {
  let ctx!: GameDataHandle;
  render(
    <SettingsProvider>
      <GameDataProvider>
        <Harness world={world} onReady={(c) => { ctx = c; }}>
          <WorldEditor onClose={vi.fn()} embedded backButton />
        </Harness>
      </GameDataProvider>
    </SettingsProvider>,
  );
  return { ctx: () => ctx };
};

/** Open the Bench from the editor header. */
export const clickOpenBench = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /^Test Bench/ }));
};
