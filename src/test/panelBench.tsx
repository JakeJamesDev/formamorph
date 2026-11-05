/** Mounts one World Editor panel or list tab over the data providers. It never imports the view, which a moved suite exists to avoid. */
import { useState, type ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { EditorModeProvider } from '@/components/EditorModeProvider';
import { CodeRenameProvider } from '@/components/editor/CodeRenameOffer';
import { ChipInsertTargetProvider } from '@/components/prompt/ChipInsertTarget';
import { ListDetail } from '@/components/ui/list-detail';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useListEditor, type ListEditorAdapter, type ListEditorParts } from '@/components/listEditorHooks';
import { useListSearch, type ListSearch } from '@/components/listToolbarHooks';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { useWorldHistory, useWorldHistoryMoves } from '@/contexts/worldRecorder';
import { writeEditorMode, type EditorMode } from '@/lib/editorMode';
import { Harness } from '@/test/worldHarness';
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

/** The three providers the view puts above a panel that renames a field, previews a roll or inserts a chip. */
export const withEditorProviders = (tree: ReactNode) => (
  <EditorPreviewRollsProvider>
    <CodeRenameProvider>
      <ChipInsertTargetProvider>{tree}</ChipInsertTargetProvider>
    </CodeRenameProvider>
  </EditorPreviewRollsProvider>
);

/** The selection a list tab's host holds, and the search box the view shares with the tab's adapter. */
export type ListTabSelection = { selectedId: string | null; onSelect: (id: string | null) => void; search: ListSearch };

/** A hook that builds one tab's adapter, holding whatever panel state the view holds for that tab. */
export type UseListTab = (selection: ListTabSelection) => { adapter: ListEditorAdapter; dialog?: ReactNode };

/** A hook that builds one tab's List Editor parts itself, as a tab does that has no adapter. */
export type UseListParts = (selection: ListTabSelection) => { parts: ListEditorParts; dialog?: ReactNode };

// eslint-disable-next-line react-refresh/only-export-components -- test-only module; nothing is hot-reloaded
const PartsLayout = ({ parts, dialog }: { parts: ListEditorParts; dialog?: ReactNode }) => (
  <>
    <ListDetail
      stacked={false}
      showDetail={parts.showDetail}
      onBack={parts.onBack}
      backLabel="List"
      scrollList={false}
      scrollDetail={!parts.fills}
      detailFooter={parts.footer}
      list={
        <div className="flex h-full min-h-0 flex-col">
          {parts.toolbar('p-2 pb-0', {})}
          {parts.ownsSlot ? <div className="min-h-0 flex-1">{parts.list}</div> : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-2">{parts.list}</div>
            </ScrollArea>
          )}
        </div>
      }
      detail={parts.detail}
    />
    {dialog}
  </>
);

// eslint-disable-next-line react-refresh/only-export-components -- test-only module; nothing is hot-reloaded
const PartsTab = ({ useParts }: { useParts: UseListParts }) => {
  const [selectedId, onSelect] = useState<string | null>(null);
  const search = useListSearch();
  const { parts, dialog } = useParts({ selectedId, onSelect, search });
  return <PartsLayout parts={parts} dialog={dialog} />;
};

/** Mount one tab that builds its List Editor parts itself: its toolbar, its list, and the selected item's panel. */
export const renderListParts = (
  world: World, mode: EditorMode, useParts: UseListParts, wrap: (tree: ReactNode) => ReactNode = withEditorProviders,
) => renderPanelBench(world, mode, wrap(<PartsTab useParts={useParts} />));

// eslint-disable-next-line react-refresh/only-export-components -- test-only module; nothing is hot-reloaded
const ListTab = ({ useTab }: { useTab: UseListTab }) => {
  const [selectedId, onSelect] = useState<string | null>(null);
  const search = useListSearch();
  const { adapter, dialog } = useTab({ selectedId, onSelect, search });
  const parts = useListEditor(adapter, { selectedId, onSelect, search });
  return <PartsLayout parts={parts} dialog={dialog} />;
};

/** Mount one list tab through the shared List Editor: its toolbar, its rows, and the selected row's panel. */
export const renderListTab = (
  world: World, mode: EditorMode, useTab: UseListTab, wrap: (tree: ReactNode) => ReactNode = withEditorProviders,
) => renderPanelBench(world, mode, wrap(<ListTab useTab={useTab} />));

/** Open one tab of the trait panel's own strip. These tabs switch on mouseDown, not click. */
export const openTraitFieldsTab = (name: string) => fireEvent.mouseDown(
  within(screen.getByRole('tablist', { name: 'Trait Fields' })).getByRole('tab', { name }),
);

/** Report mobile to `useIsMobile`, which reads the width once and then the media query. Returns the undo. */
export const asMobile = () => {
  const realMatchMedia = window.matchMedia;
  const realWidth = window.innerWidth;
  window.innerWidth = 400;
  // A stub with only the members the two readers call.
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width: 767px'),
    media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = realMatchMedia;
    window.innerWidth = realWidth;
  };
};

/** Where a detail panel's parts sit: its strip fixed above any scroll, and the open tab's body scrolling on
 *  its own or filling the pane for a body that scrolls inside itself. */
export const panelTabLayout = (stripLabel: string) => {
  const strip = screen.getByRole('tablist', { name: stripLabel });
  const open = within(strip).getByRole('tab', { selected: true });
  const body = document.getElementById(open.getAttribute('aria-controls') ?? '');
  const fixed = !strip.closest('[data-radix-scroll-area-viewport]') && !!strip.closest('[data-detail-fill]');
  return { strip: fixed ? 'fixed' : 'scrolls', body: body?.querySelector('[data-panel-tab-body]') ? 'scroll' : 'fill' };
};

/** The entity panel's own tab, apart from the editor's tab of the same name. */
export const entityFieldsTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Entity Fields' })).getByRole('tab', { name });
