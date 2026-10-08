import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { asMobile, benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { SurfaceLayer, SurfaceReporterContext } from '@/components/ui/surface';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DEV_MODAL_TABS } from '@/lib/devRoutes';
import { surfaceRegistry } from '@/lib/surface/surfaceRegistry';
import { reloadTourProgress, writeTourRecord } from '@/lib/authoringTour/progress';
import { TOUR_STEPS } from '@/lib/authoringTour/steps';
import type { GameLocation, World } from '@/types';

/** Ctrl+Z and Ctrl+Y move the world through its history from the editor, and the app bar's pill shows where it stands. */

vi.mock('@/lib/authoringTour/tourImages', () => ({
  loadTourImage: async (name: string) => `data:image/webp;base64,${name}`,
}));

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const stat = (id: string, name: string) =>
  ({ id, name, type: 'number' as const, description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] });

const WORLD: World = benchEditorWorld({
  stats: [stat('s-warmth', 'Warmth'), stat('s-damp', 'Damp'), stat('s-dread', 'Dread')],
} as Partial<World>);

const rows = () => screen.queryAllByRole('button', { name: /^Select / }).map((b) => b.getAttribute('aria-label')!.slice('Select '.length));
const row = (name: string) => screen.getByRole('button', { name: `Select ${name}` }).parentElement as HTMLElement;

/** One author action, then the event loop moves on as it does between two presses. */
const step = (action: () => void) => act(async () => { action(); });
const removeStat = (name: string) => step(() => {
  fireEvent.click(within(row(name)).getByRole('button', { name: 'Delete' }));
});
/** Returns whether the editor claimed the chord, so the browser's own undo stays shut. */
const chord = async (key: 'z' | 'y', init: KeyboardEventInit = {}, target: Element | Window = document.body) => {
  let claimed = false;
  await step(() => { claimed = !fireEvent.keyDown(target, { key, ctrlKey: true, ...init }); });
  return claimed;
};

const undoFace = () => screen.getByRole('button', { name: 'Undo' });
const redoFace = () => screen.getByRole('button', { name: 'Redo' });

/** The app's reporter, the editor as the host's dialog reports it, and a dialog that opens over it later. */
const LateDialog = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open Settings</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent surface="settings" aria-describedby={undefined}>
          <DialogTitle>Settings</DialogTitle>
        </DialogContent>
      </Dialog>
    </>
  );
};
const inHost = (tree: ReactNode) => (
  <SurfaceReporterContext.Provider value={surfaceRegistry}>
    <SurfaceLayer id="worldEditor">{tree}</SurfaceLayer>
    <LateDialog />
  </SurfaceReporterContext.Provider>
);

beforeEach(() => {
  localStorage.clear();
  reloadTourProgress();
});

describe('the World Editor history', () => {
  it('restores a removed stat at its index with Ctrl+Z and removes it again with Ctrl+Y', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await removeStat('Damp');
    expect(rows()).toEqual(['Warmth', 'Dread']);

    expect(await chord('z')).toBe(true);
    expect(rows()).toEqual(['Warmth', 'Damp', 'Dread']);
    expect(ctx().stats.map((s) => s.id)).toEqual(['s-warmth', 's-damp', 's-dread']);

    expect(await chord('y')).toBe(true);
    expect(rows()).toEqual(['Warmth', 'Dread']);
  });

  it('redoes with Ctrl+Shift+Z and with Cmd on a Mac', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await removeStat('Damp');
    await step(() => { fireEvent.keyDown(document.body, { key: 'z', metaKey: true }); });
    expect(rows()).toEqual(['Warmth', 'Damp', 'Dread']);
    await chord('z', { shiftKey: true });
    expect(rows()).toEqual(['Warmth', 'Dread']);
  });

  it('disables Undo and Redo at the ends of the history and names the chords in their tips', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    expect(undoFace()).toBeDisabled();
    expect(redoFace()).toBeDisabled();

    await removeStat('Damp');
    expect(undoFace()).toBeEnabled();
    expect(redoFace()).toBeDisabled();
    fireEvent.pointerEnter(undoFace());
    fireEvent.focus(undoFace());
    expect(await screen.findByText('Undo (Ctrl+Z)')).toBeInTheDocument();

    await step(() => fireEvent.click(undoFace()));
    expect(rows()).toEqual(['Warmth', 'Damp', 'Dread']);
    expect(undoFace()).toBeDisabled();
    expect(redoFace()).toBeEnabled();
    fireEvent.pointerEnter(redoFace());
    fireEvent.focus(redoFace());
    expect(await screen.findByText('Redo (Ctrl+Y or Ctrl+Shift+Z)')).toBeInTheDocument();

    await step(() => fireEvent.click(redoFace()));
    expect(rows()).toEqual(['Warmth', 'Dread']);
  });

  it('leaves Ctrl+Z to a text field', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await removeStat('Damp');
    expect(await chord('z', {}, screen.getByPlaceholderText('Filter Stats'))).toBe(false);
    expect(rows()).toEqual(['Warmth', 'Dread']);
  });

  it('works under the host dialog and does nothing while a dialog opened after the editor is open', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced', {}, inHost);
    openEditorTab(/Stats/);
    await removeStat('Damp');
    await removeStat('Dread');
    await chord('z');
    expect(rows()).toEqual(['Warmth', 'Dread']);

    fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
    await screen.findByRole('dialog', { name: 'Settings' });
    expect(await chord('z')).toBe(false);
    expect(await chord('y')).toBe(false);
    // The modal hides the list from the accessibility tree, so the world is read directly.
    expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth', 'Dread']);
  });

  it('does nothing while the Authoring Tour runs', async () => {
    writeTourRecord(WORLD.id, { step: TOUR_STEPS[0].id, items: {} });
    reloadTourProgress();
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await removeStat('Damp');
    expect(await chord('z')).toBe(false);
    expect(rows()).toEqual(['Warmth', 'Dread']);
    expect(undoFace()).toBeDisabled();
  });

  it('starts with an empty stack when the editor closes and opens again over the same world', async () => {
    const { ctx, reopen } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await removeStat('Damp');
    expect(undoFace()).toBeEnabled();

    await step(() => reopen());
    openEditorTab(/Stats/);
    expect(undoFace()).toBeDisabled();
    expect(redoFace()).toBeDisabled();
    await chord('z');
    // The edit stays in the world; only its history is gone.
    expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth', 'Dread']);
  });

  it('leaves no Steps for the next open after Exit Without Saving', async () => {
    const { ctx, reopen } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await removeStat('Damp');

    fireEvent.click(document.querySelector('.lucide-arrow-left')!.closest('button')!);
    await step(() => fireEvent.click(screen.getByRole('button', { name: 'Exit Without Saving' })));
    expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth', 'Damp', 'Dread']);

    await step(() => reopen());
    openEditorTab(/Stats/);
    expect(undoFace()).toBeDisabled();
    await chord('z');
    expect(rows()).toEqual(['Warmth', 'Damp', 'Dread']);
  });

  it('undoes from the chord and the pill in the in-game host, and clears when its editor closes', async () => {
    const props = { inGame: true };
    const { ctx, reopen } = renderWorldEditorBench(WORLD, 'advanced', props, inHost);
    openEditorTab(/Stats/);
    await removeStat('Damp');
    await removeStat('Dread');

    expect(await chord('z')).toBe(true);
    expect(rows()).toEqual(['Warmth', 'Dread']);
    await step(() => fireEvent.click(undoFace()));
    expect(rows()).toEqual(['Warmth', 'Damp', 'Dread']);
    await step(() => fireEvent.click(redoFace()));
    expect(rows()).toEqual(['Warmth', 'Dread']);

    await step(() => reopen(props));
    openEditorTab(/Stats/);
    expect(undoFace()).toBeDisabled();
    expect(redoFace()).toBeDisabled();
    expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth', 'Dread']);
  });

  it('does nothing while the key composes text', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await removeStat('Damp');
    expect(await chord('z', { isComposing: true })).toBe(false);
    expect(rows()).toEqual(['Warmth', 'Dread']);
  });
});

describe('the full-screen Locations Canvas', () => {
  const MAP: World = benchEditorWorld({
    locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }, { id: 'docks', name: 'Docks' }],
  });
  const openWindow = async () => {
    openEditorTab(/Locations/);
    fireEvent.click(screen.getByRole('radio', { name: 'Canvas' }));
    await step(() => fireEvent.click(screen.getByRole('button', { name: /^Edit full screen$/i })));
    return screen.findByRole('dialog', { name: 'Locations Canvas' });
  };
  const docks = (ctx: () => { locations: GameLocation[] }) => ctx().locations.find((l) => l.id === 'docks')!;

  it('undoes and redoes the world from inside the window', async () => {
    const { ctx } = renderWorldEditorBench(MAP, 'advanced', {}, inHost);
    const shell = await openWindow();
    await step(() => ctx().updateLocation({ ...docks(ctx), name: 'Quay' }));

    expect(await chord('z', {}, shell)).toBe(true);
    expect(docks(ctx).name).toBe('Docks');
    expect(await chord('y', {}, shell)).toBe(true);
    expect(docks(ctx).name).toBe('Quay');
  });

  it('leaves the world alone under a modal raised over the window', async () => {
    const Unreported = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Ask</button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent aria-describedby={undefined}><DialogTitle>Question</DialogTitle></DialogContent>
          </Dialog>
        </>
      );
    };
    const { ctx } = renderWorldEditorBench(MAP, 'advanced', {}, (tree) => inHost(<>{tree}<Unreported /></>));
    const shell = await openWindow();
    await step(() => ctx().updateLocation({ ...docks(ctx), name: 'Quay' }));
    // The window hides the rest of the page from the accessibility tree, so the opener is found by its text.
    fireEvent.click(screen.getByText('Ask'));
    const question = await screen.findByRole('dialog', { name: 'Question' });

    expect(await chord('z', {}, question)).toBe(false);
    expect(await chord('z', {}, shell)).toBe(false);
    expect(docks(ctx).name).toBe('Quay');
  });
});

/** Lets the event loop move on, so the next write is a new Step and does not fold into the last one. */
const apart = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
const removeApart = async (name: string) => { await apart(); await removeStat(name); };
const historyFace = () => screen.getByRole('button', { name: 'History' });
const openHistory = () => step(() => fireEvent.click(historyFace()));
const historyList = () => screen.getByRole('dialog', { name: 'History' });
const listRow = (name: string | RegExp) => within(historyList()).getByRole('button', { name });
const listRows = () => within(historyList()).getAllByRole('button').map((b) => b.textContent);

describe('the History popover (desktop)', () => {
  it('joins Undo, Redo and the History chevron in one pill, each with a tip', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    const pill = screen.getByRole('group', { name: 'History' });
    expect(within(pill).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Undo', 'Redo', 'History']);

    fireEvent.pointerEnter(historyFace());
    fireEvent.focus(historyFace());
    expect(await screen.findByText('History')).toBeInTheDocument();

    expect(historyFace()).toHaveAttribute('aria-pressed', 'false');
    await openHistory();
    expect(historyFace()).toHaveAttribute('aria-pressed', 'true');
    expect(historyList()).toBeInTheDocument();
  });

  it('lists World opened, each Step with its label, the current Step marked and the future dimmed', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await removeStat('Damp');
    await removeApart('Dread');
    await chord('z');
    await openHistory();

    expect(listRows()).toEqual(['World opened', 'Remove Stat DampNow', 'Remove Stat Dread(undone)']);
    // Each row is named by its full label, and an undone row says so.
    expect(listRow('Remove Stat Damp')).toHaveAttribute('aria-current', 'step');
    expect(listRow('Remove Stat Dread (undone)')).toHaveAttribute('data-undone', 'true');
    expect(listRow('Remove Stat Damp')).not.toHaveAttribute('data-undone');
    expect(listRow('World opened')).not.toHaveAttribute('aria-current');
  });

  it('moves the world to the row that is clicked, back to World opened and forward to a dimmed row', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await removeStat('Damp');
    await removeApart('Dread');
    expect(rows()).toEqual(['Warmth']);
    await openHistory();

    await step(() => fireEvent.click(listRow('World opened')));
    expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth', 'Damp', 'Dread']);
    expect(listRow('World opened')).toHaveAttribute('aria-current', 'step');

    await step(() => fireEvent.click(listRow(/^Remove Stat Dread/)));
    expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth']);
    expect(listRow(/^Remove Stat Dread/)).toHaveAttribute('aria-current', 'step');

    await step(() => fireEvent.click(listRow(/^Remove Stat Damp/)));
    expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth', 'Dread']);
    expect(undoFace()).toBeEnabled();
    expect(redoFace()).toBeEnabled();
  });

  it('is shut during the Authoring Tour', async () => {
    writeTourRecord(WORLD.id, { step: TOUR_STEPS[0].id, items: {} });
    reloadTourProgress();
    renderWorldEditorBench(WORLD, 'advanced');
    expect(historyFace()).toBeDisabled();
  });

  // The route ledger lists what the router can target, so each listed value must open the popover.
  it.each([...DEV_MODAL_TABS.worldEditorHistory])('opens from the dev route with history=%s', async (value) => {
    window.location.hash = `#dev?modal=worldEditor&history=${value}`;
    try {
      renderWorldEditorBench(WORLD, 'advanced');
      expect(await screen.findByRole('dialog', { name: 'History' })).toBeInTheDocument();
    } finally {
      window.location.hash = '';
      // The router drops the route on the hashchange event, which arrives a task later.
      await apart();
    }
  });
});

describe('the History popover (mobile)', () => {
  it('puts one History icon in the header and Undo and Redo in the popover head', async () => {
    const restore = asMobile();
    try {
      renderWorldEditorBench(WORLD, 'advanced');
      expect(screen.queryByRole('group', { name: 'History' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'History' })).toHaveLength(1);

      await openHistory();
      const head = historyList();
      expect(within(head).getByRole('button', { name: 'Undo' })).toBeDisabled();
      expect(within(head).getByRole('button', { name: 'Redo' })).toBeDisabled();
    } finally {
      restore();
    }
  });

  it('sits between the mode select and the Bench', () => {
    const restore = asMobile();
    try {
      renderWorldEditorBench(WORLD, 'advanced');
      const order = [screen.getByRole('combobox', { name: 'Editor mode' }), historyFace(), screen.getByRole('button', { name: /^Test Bench/ })];
      expect(order.every((el, i) => i === 0
        || (order[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)).toBe(true);
    } finally {
      restore();
    }
  });
});

/** A trait that toggles Damp, so removing Damp is the one defect in an otherwise clean world. */
const TOGGLED_WORLD: World = benchEditorWorld({
  ...WORLD,
  traits: [{ id: 't-dry', name: 'Dry Boots', statChanges: [], statToggles: [{ statId: 's-damp', enabled: false }] }],
} as Partial<World>);
const flask = () => screen.getByRole('button', { name: /^Test Bench/ });
/** Outlasts the pass debounce, so the badge has had its chance to move. */
const settled = { timeout: 2000 };

describe('the Test Bench after an undo', () => {
  it('updates its findings after Ctrl+Z as it does after any edit', async () => {
    renderWorldEditorBench(TOGGLED_WORLD, 'advanced');
    openEditorTab(/Stats/);
    await waitFor(() => expect(flask()).toHaveAccessibleName('Test Bench'), settled);

    await removeStat('Damp');
    await waitFor(() => expect(flask()).toHaveAccessibleName('Test Bench, 1 new finding'), settled);

    expect(await chord('z')).toBe(true);
    expect(rows()).toEqual(['Warmth', 'Damp', 'Dread']);
    await waitFor(() => expect(flask()).toHaveAccessibleName('Test Bench'), settled);
  });
});
