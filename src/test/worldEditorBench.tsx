/**
 * Shared harness for the World Editor Bench suites: the real editor mounted over real providers around one
 * authored world, so each suite tests its own wiring rather than re-declaring the mount. Service mocks stay
 * in the test files — `vi.mock` is hoisted per file — but the fixture, the mount, and its lint exception
 * live here once.
 */
import type { ComponentProps, ReactNode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { GameDataProvider, type useGameData } from '@/contexts/GameDataContext';
import { useWorldHistory, useWorldHistoryMoves } from '@/contexts/worldRecorder';
import { writeEditorMode, type EditorMode } from '@/lib/editorMode';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import WorldEditor from '@/views/WorldEditor';
import { panelWorld } from '@/test/panelBench';
import { Harness } from '@/test/worldHarness';
import type { World } from '@/types';

export { asMobile, entityFieldsTab, openTraitFieldsTab, panelTabLayout } from '@/test/panelBench';

/** What the Save face's live region says; the region follows the split button. */
export const saveAnnouncement = (face: HTMLElement) => face.parentElement?.nextElementSibling?.textContent ?? null;

/** Desktop's Search World field in the app bar. */
export const searchWorldField = () => screen.getByRole('textbox', { name: 'Search World' });

/** Ends a closed sheet's exit animation, which jsdom never runs, so vaul unmounts the sheet. */
export const finishSheetExit = (sheet: HTMLElement) => {
  const end = new Event('animationend', { bubbles: true });
  Object.defineProperty(end, 'animationName', { value: getComputedStyle(sheet).animationName });
  act(() => { sheet.dispatchEvent(end); });
};

/** A loadable world with the base a suite doesn't care about filled in. It is the panel bench's world, so a view suite and a panel suite start from the same one. */
export const benchEditorWorld = panelWorld;

type GameDataHandle = ReturnType<typeof useGameData>;
type HistoryMoves = ReturnType<typeof useWorldHistoryMoves>;
type HistoryState = ReturnType<typeof useWorldHistory>;

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
  /** Wraps the whole tree, as the app's root boundary does. */
  wrap: (tree: ReactNode) => ReactNode = (tree) => tree,
) => {
  let ctx!: GameDataHandle;
  let moves!: HistoryMoves;
  let historyState!: HistoryState;
  writeEditorMode(mode);
  const onClose = vi.fn();
  // A new key remounts the editor over the same provider, as closing it and opening it again does.
  let visit = 0;
  const tree = (editorProps: typeof props) => wrap(
    <SettingsProvider>
      <TooltipProvider>
        <GameDataProvider>
          <Harness world={world} onReady={(c, m, h) => { ctx = c; moves = m; historyState = h; }}>
            <WorldEditor key={visit} onClose={onClose} embedded backButton {...editorProps} />
          </Harness>
        </GameDataProvider>
      </TooltipProvider>
    </SettingsProvider>,
  );
  const view = render(tree(props));
  return {
    ctx: () => ctx,
    /** The host's close, which the editor calls to leave. */
    onClose,
    /** The history's moves, called as a hook caller would, past the chords and the pill. */
    history: () => moves,
    /** The Steps, the cursor and the Saved marker as the last render read them. */
    historyState: () => historyState,
    unmount: view.unmount,
    /** Renders the editor again with new props, as a host does for a later request. */
    rerender: (next: typeof props) => view.rerender(tree(next)),
    /** Closes the editor and opens it again over the same world, as a host that keeps its provider does. */
    reopen: (next: typeof props = props) => { visit += 1; view.rerender(tree(next)); },
  };
};

/** The label of the editor tab that is showing. */
export const shownEditorTab = () =>
  within(screen.getByRole('tablist', { name: 'Editor Sections' })).getByRole('tab', { selected: true }).textContent;

/** Open one of the editor's own tabs, from the rail or, on mobile, through the Sections bar. Panel strips
 *  share tab names with the editor's, so the list is found by its label. These tabs switch on mouseDown. */
export const openEditorTab = (name: RegExp) => {
  const sections = screen.queryByRole('button', { name: /^Sections/, expanded: false });
  if (sections) fireEvent.click(sections);
  fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Editor Sections' })).getByRole('tab', { name }));
};

/** Open a list's + menu on Entities or Dictionary and pick Add From Library…, which opens the picker. */
export const openAddFromLibrary = (kind: 'dictionary' | 'entity') => {
  fireEvent.click(screen.getByRole('button', { name: kind === 'dictionary' ? 'Add to Dictionary' : 'Add to Entities' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add From Library…' }));
};

/** The editor's mode select, in the desktop app bar or the mobile header. */
export const editorModeSelect = () => screen.getByRole('combobox', { name: 'Editor mode' });

/** Pick a mode from the mode select, by keyboard: a click needs pointer capture, which jsdom has not
 *  got, and the keyboard works under fake timers too. */
export const pickEditorMode = (name: 'Simple' | 'Advanced') => {
  fireEvent.keyDown(editorModeSelect(), { key: 'Enter' });
  fireEvent.keyDown(screen.getByRole('option', { name: new RegExp(`^${name}`) }), { key: 'Enter' });
};

/** Click the editor header's flask — whose first stop is the quick-triage popover, not the full panel. */
export const clickFlask = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /^Test Bench/ }));
};

/** Open the full Bench panel the way an author reaches it: the flask, then the popover's one button. */
export const clickOpenBench = async () => {
  await clickFlask();
  fireEvent.click(await screen.findByRole('button', { name: 'Open Test Bench' }));
};
