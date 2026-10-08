import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { SurfaceLayer, SurfaceReporterContext } from '@/components/ui/surface';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { surfaceRegistry } from '@/lib/surface/surfaceRegistry';
import { reloadTourProgress, writeTourRecord } from '@/lib/authoringTour/progress';
import { TOUR_STEPS } from '@/lib/authoringTour/steps';
import type { World } from '@/types';

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
    expect(await screen.findByText('Redo (Ctrl+Y)')).toBeInTheDocument();

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

  it('does nothing while the key composes text', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await removeStat('Damp');
    expect(await chord('z', { isComposing: true })).toBe(false);
    expect(rows()).toEqual(['Warmth', 'Dread']);
  });
});
