/**
 * Shared harness for the World Editor Bench suites: the real editor mounted over real providers around one
 * authored world, so each suite tests its own wiring rather than re-declaring the mount. Service mocks stay
 * in the test files — `vi.mock` is hoisted per file — but the fixture, the mount, and its lint exception
 * live here once.
 */
import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { writeEditorMode, type EditorMode } from '@/lib/editorMode';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { TooltipProvider } from '@/components/ui/tooltip';
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

/** Report mobile to `useIsMobile`, which reads the width once and then the media query. Returns the undo. */
export const asMobile = () => {
  const realMatchMedia = window.matchMedia;
  const realWidth = window.innerWidth;
  window.innerWidth = 400;
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

/** Ends a closed sheet's exit animation, which jsdom never runs, so vaul unmounts the sheet. */
export const finishSheetExit = (sheet: HTMLElement) => {
  const end = new Event('animationend', { bubbles: true });
  Object.defineProperty(end, 'animationName', { value: getComputedStyle(sheet).animationName });
  act(() => { sheet.dispatchEvent(end); });
};

/** A loadable world with the base a suite doesn't care about filled in — a named overview with a prompt and
 *  readme, a flagged starting location, and one described resident keeping it occupied — clean under the full
 *  rule registry, so a suite's Issues list shows only the defects it authors in. The cast is deliberate — a
 *  suite supplies only the slices its tests are about, the way hand-authored world JSON arrives with fields
 *  the types call required simply absent. */
export const benchEditorWorld = (over: Partial<World>): World => ({
  id: 'w1',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: 'Narrate the fen.', readme: 'A fen primer.', use3DModel: true, tags: [],
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

/**
 * Mount the editor over `world` in `mode`; `ctx()` reads the live GameData handle for state assertions.
 *
 * The mode is stated rather than defaulted: the Bench folds away every finding about an Advanced-only field,
 * so a suite about alias repairs or stat code is a suite about the Advanced editor, and one about the fold
 * itself is about the Simple one.
 */
export const renderWorldEditorBench = (
  world: World,
  mode: EditorMode,
  props: Partial<Omit<ComponentProps<typeof WorldEditor>, 'onClose'>> = {},
) => {
  let ctx!: GameDataHandle;
  writeEditorMode(mode);
  const onClose = vi.fn();
  const tree = (editorProps: typeof props) => (
    <SettingsProvider>
      <TooltipProvider>
        <GameDataProvider>
          <Harness world={world} onReady={(c) => { ctx = c; }}>
            <WorldEditor onClose={onClose} embedded backButton {...editorProps} />
          </Harness>
        </GameDataProvider>
      </TooltipProvider>
    </SettingsProvider>
  );
  const view = render(tree(props));
  return {
    ctx: () => ctx,
    unmount: view.unmount,
    /** Renders the editor again with new props, as a host does for a later request. */
    rerender: (next: typeof props) => view.rerender(tree(next)),
  };
};

/** Open one of the editor's own tabs. The entity panel's Traits tab shares a name with the editor's, so the
 *  strip is told apart by its label. These tabs switch on mouseDown, not click. */
export const openEditorTab = (name: RegExp) => fireEvent.mouseDown(
  screen.getAllByRole('tab', { name }).find((t) => t.closest('[role="tablist"]')?.getAttribute('aria-label') !== 'Entity Fields')!,
);

/** The entity panel's own tab, apart from the editor's tab of the same name. */
export const entityFieldsTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Entity Fields' })).getByRole('tab', { name });

/** Open one tab of the trait panel's own strip. These tabs switch on mouseDown, not click. */
export const openTraitFieldsTab = (name: string) => fireEvent.mouseDown(
  within(screen.getByRole('tablist', { name: 'Trait Fields' })).getByRole('tab', { name }),
);

/** Click the editor header's flask — whose first stop is the quick-triage popover, not the full panel. */
export const clickFlask = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /^Test Bench/ }));
};

/** Open the full Bench panel the way an author reaches it: the flask, then the popover's one button. */
export const clickOpenBench = async () => {
  await clickFlask();
  fireEvent.click(await screen.findByRole('button', { name: 'Open Test Bench' }));
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
