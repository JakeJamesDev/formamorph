/** Mounts one World Editor panel or list tab over the data providers. It never imports the view, which a moved suite exists to avoid. */
import { useEffect, useState, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { EditorModeProvider } from '@/components/EditorModeProvider';
import { ListEditor } from '@/components/ListEditor';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { useWorldHistory, useWorldHistoryMoves } from '@/contexts/worldRecorder';
import { writeEditorMode, type EditorMode } from '@/lib/editorMode';
import type { World } from '@/types';

// jsdom has no matchMedia; SettingsProvider (theme) and useIsMobile (layout) both read it on mount.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** A loadable world with a named overview, a starting location and one resident. A suite supplies the slices it tests. */
export const panelWorld = (over: Partial<World>): World => ({
  id: 'w1',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: 'Narrate the fen.', readme: 'A fen primer.', tags: [],
  },
  stats: [],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: [{
    id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.',
    aiDescription: 'Keeps the harbor lamps lit.', locations: ['harbor'],
  }],
  placeholders: [], traits: [], statUpdates: [],
  ...over,
} as unknown as World);

type GameDataHandle = ReturnType<typeof useGameData>;
type HistoryMoves = ReturnType<typeof useWorldHistoryMoves>;
type HistoryState = ReturnType<typeof useWorldHistory>;

// eslint-disable-next-line react-refresh/only-export-components -- test-only module; nothing is hot-reloaded
const Harness = ({ world, children, onReady }: {
  world: World;
  children: ReactNode;
  onReady: (ctx: GameDataHandle, moves: HistoryMoves, state: HistoryState) => void;
}) => {
  const ctx = useGameData();
  const moves = useWorldHistoryMoves();
  const state = useWorldHistory();
  useEffect(() => { ctx.loadWorldData(world); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx, moves, state);
  return <>{children}</>;
};

/** Mount `panel` over `world` in `mode`. `ctx()` reads the live GameData handle, as the view's bench does. */
export const renderPanelBench = (world: World, mode: EditorMode, panel: ReactNode) => {
  let ctx!: GameDataHandle;
  let moves!: HistoryMoves;
  let historyState!: HistoryState;
  writeEditorMode(mode);
  const view = render(
    <SettingsProvider>
      <TooltipProvider>
        <GameDataProvider>
          <Harness world={world} onReady={(c, m, h) => { ctx = c; moves = m; historyState = h; }}>
            <EditorModeProvider>{panel}</EditorModeProvider>
          </Harness>
        </GameDataProvider>
      </TooltipProvider>
    </SettingsProvider>,
  );
  return {
    ctx: () => ctx,
    /** The history's moves, past the chords the view binds. */
    history: () => moves,
    /** The Steps, the cursor and the Saved marker as the last render read them. */
    historyState: () => historyState,
    unmount: view.unmount,
  };
};

/** The selection a list tab's host holds. */
export type ListTabSelection = { selectedId: string | null; onSelect: (id: string | null) => void };

/** A hook that builds one tab's adapter, holding whatever panel state the view holds for that tab. */
export type UseListTab = (selection: ListTabSelection) => { adapter: ListEditorAdapter; dialog?: ReactNode };

// eslint-disable-next-line react-refresh/only-export-components -- test-only module; nothing is hot-reloaded
const ListTab = ({ useTab }: { useTab: UseListTab }) => {
  const [selectedId, onSelect] = useState<string | null>(null);
  const { adapter, dialog } = useTab({ selectedId, onSelect });
  return (
    <>
      <ListEditor adapter={adapter} layout="sideBySide" selectedId={selectedId} onSelect={onSelect} backLabel="List" />
      {dialog}
    </>
  );
};

/** Mount one list tab through the shared List Editor: its toolbar, its rows, and the selected row's panel. */
export const renderListTab = (world: World, mode: EditorMode, useTab: UseListTab) =>
  renderPanelBench(world, mode, <ListTab useTab={useTab} />);
