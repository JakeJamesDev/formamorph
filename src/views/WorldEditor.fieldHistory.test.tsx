import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import {
  $createParagraphNode, $createTextNode, $getRoot, getNearestEditorFromDOMNode,
  type LexicalEditor,
} from 'lexical';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { SurfaceLayer, SurfaceReporterContext } from '@/components/ui/surface';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { surfaceRegistry } from '@/lib/surface/surfaceRegistry';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import type { World } from '@/types';

/** A field's own history and the world's meet at Ctrl+Z: the field goes first, the world takes the rest. */

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

const rowButton = (name: string) => screen.getByRole('button', { name: `Select ${name}` });
const statNames = (ctx: () => { stats: { name: string }[] }) => ctx().stats.map((s) => s.name);

/** One author action, then the event loop moves on as it does between two presses. */
const step = (action: () => void) => act(async () => { action(); });
/** Lets the event loop move on, so the next write is a new Step and does not fold into the last one. */
const apart = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
const removeStat = (name: string) => step(() => {
  fireEvent.click(within(rowButton(name).parentElement as HTMLElement).getByRole('button', { name: 'Delete' }));
});

/** The prompt field under a visible label: its label names no editable, so the field is the nearest one below. */
const promptFieldUnder = (label: string): HTMLElement => {
  for (let at: HTMLElement | null = screen.getByText(label); at; at = at.parentElement) {
    const field = at.querySelector<HTMLElement>('[data-lexical-editor="true"]');
    if (field) return field;
  }
  throw new Error(`no field under ${label}`);
};

const editorOf = (field: HTMLElement): LexicalEditor => {
  const found = getNearestEditorFromDOMNode(field);
  if (!found) throw new Error('no editor');
  return found;
};
/** Replaces the field's text through the composer, as one edit. */
const setText = (field: HTMLElement, text: string) => step(() => {
  editorOf(field).update(() => {
    $getRoot().clear().append($createParagraphNode().append($createTextNode(text)));
  }, { discrete: true });
});
const fieldText = (field: HTMLElement) => editorOf(field).getEditorState().read(() => $getRoot().getTextContent());

/**
 * The chord pressed in a field. The editor's listener decides first; the composer's own key handling then
 * dispatches its undo or redo command, as it does in the app. Both claim the key, so tests read the outcome.
 */
const chordIn = (field: HTMLElement, key: 'z' | 'y') => step(() => { fireEvent.keyDown(field, { key, ctrlKey: true }); });
const chord = async (target: Element, key: 'z' | 'y') => {
  let claimed = false;
  await step(() => { claimed = !fireEvent.keyDown(target, { key, ctrlKey: true }); });
  return claimed;
};

const openHistory = () => step(() => fireEvent.click(screen.getByRole('button', { name: 'History' })));
const historyRows = () => within(screen.getByRole('dialog', { name: 'History' })).getAllByRole('button');
const currentRow = () => historyRows().find((row) => row.getAttribute('aria-current') === 'step')?.textContent;

beforeEach(() => {
  localStorage.clear();
  reloadTourProgress();
});
// Only the clock: restoring every mock would drop the storage stubs' resolved values.
let clock: { mockRestore(): void } | null = null;
afterEach(() => { clock?.mockRestore(); clock = null; });

describe('Ctrl+Z in a prompt field', () => {
  it("undoes the field's own text first, adds no Step, then hands the press to the world", async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await removeStat('Damp');
    await apart();
    openEditorTab(/Entities/);
    fireEvent.click(screen.getAllByText('Odd Wick')[0]);
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Descriptions/ }));
    const field = promptFieldUnder('Player-Facing Description');
    await setText(field, 'The lamp-keeper, soaked.');
    expect(ctx().entities[0].playerDescription).toBe('The lamp-keeper, soaked.');

    // Past the pause, so a plain write could not merge into the typing's Step.
    const later = Date.now() + 60_000;
    clock = vi.spyOn(Date, 'now').mockReturnValue(later);
    await chordIn(field, 'z');
    expect(fieldText(field)).toBe('The lamp-keeper.');
    expect(ctx().entities[0].playerDescription).toBe('The lamp-keeper.');
    expect(statNames(ctx)).toEqual(['Warmth', 'Dread']);

    await openHistory();
    expect(historyRows()).toHaveLength(3);
    expect(currentRow()).toMatch(/^Remove Stat Damp/);
    await openHistory();

    // The field has nothing left, so the press reaches the Step before the typing.
    await chordIn(field, 'z');
    expect(statNames(ctx)).toEqual(['Warmth', 'Damp', 'Dread']);
    expect(ctx().entities[0].playerDescription).toBe('The lamp-keeper.');
  });

  it("redoes the field's own text and moves the world forward with it", async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);
    fireEvent.click(screen.getAllByText('Odd Wick')[0]);
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Descriptions/ }));
    const field = promptFieldUnder('Player-Facing Description');
    await setText(field, 'The lamp-keeper, soaked.');
    await chordIn(field, 'z');
    expect(ctx().entities[0].playerDescription).toBe('The lamp-keeper.');
    await chordIn(field, 'y');
    expect(fieldText(field)).toBe('The lamp-keeper, soaked.');
    expect(ctx().entities[0].playerDescription).toBe('The lamp-keeper, soaked.');

    await openHistory();
    expect(historyRows()).toHaveLength(2);
    expect(currentRow()).toMatch(/^Edit Entity Odd Wick/);
  });
});

describe('a field mark', () => {
  it('belongs to its own tick, so a later write that lands on a Step side still records', async () => {
    const { history } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);
    fireEvent.click(screen.getAllByText('Odd Wick')[0]);
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Descriptions/ }));
    const field = promptFieldUnder('Player-Facing Description');
    await setText(field, 'The lamp-keeper, soaked.');

    // A field outside the world marks a write that never reaches it.
    await step(() => history().markFieldHistory());
    await apart();
    clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    await setText(field, 'The lamp-keeper.');

    await openHistory();
    expect(historyRows()).toHaveLength(3);
  });
});

describe('a world undo into a focused field', () => {
  it('rebuilds the field without a text-undo entry, so the next Ctrl+Z reaches the next Step', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await removeStat('Dread');
    await apart();
    fireEvent.click(rowButton('Warmth'));
    await setText(screen.getByRole('textbox', { name: 'Description' }), 'Heat in the bones.');
    // A fresh field over the same record: its own history starts empty.
    fireEvent.click(rowButton('Damp'));
    fireEvent.click(rowButton('Warmth'));
    const field = screen.getByRole('textbox', { name: 'Description' });
    expect(fieldText(field)).toBe('Heat in the bones.');

    await chordIn(field, 'z');
    expect(ctx().stats[0].description).toBe('');
    expect(fieldText(field)).toBe('');

    await chordIn(field, 'z');
    expect(statNames(ctx)).toEqual(['Warmth', 'Damp', 'Dread']);
  });
});

describe('a world restore into a field with its own history', () => {
  it("ends the field's stacks, so the next Ctrl+Y redoes the world instead of the field's stale text", async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    fireEvent.click(rowButton('Warmth'));
    await setText(screen.getByRole('textbox', { name: 'Description' }), 'Heat');
    fireEvent.click(rowButton('Damp'));
    fireEvent.click(rowButton('Warmth'));
    const field = screen.getByRole('textbox', { name: 'Description' });
    clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    await setText(field, 'Heat!');

    // The field undoes its own typing, then the world undoes the earlier Step into the field.
    await chordIn(field, 'z');
    await chordIn(field, 'z');
    expect(fieldText(field)).toBe('');

    await chordIn(field, 'y');
    expect(ctx().stats[0].description).toBe('Heat');
    await openHistory();
    expect(historyRows()).toHaveLength(3);
    expect(currentRow()).toMatch(/^Edit Stat Warmth/);
  });
});

describe('Ctrl+Z in a plain input', () => {
  it('undoes a world-bound input through the world and keeps the browser undo shut', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    fireEvent.click(rowButton('Warmth'));
    const max = screen.getByDisplayValue('10');
    await step(() => fireEvent.change(max, { target: { value: '50' } }));
    expect(ctx().stats[0].max).toBe(50);

    expect(await chord(max, 'z')).toBe(true);
    expect(ctx().stats[0].max).toBe(10);
  });

  it('leaves a filter box to the browser', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await removeStat('Damp');
    expect(await chord(screen.getByPlaceholderText('Filter Stats'), 'z')).toBe(false);
    expect(statNames(ctx)).toEqual(['Warmth', 'Dread']);
  });
});

/** The app's reporter around the editor, as the hosts mount it. */
const reported = (tree: ReactNode) => (
  <SurfaceReporterContext.Provider value={surfaceRegistry}>
    <SurfaceLayer id="worldEditor">{tree}</SurfaceLayer>
  </SurfaceReporterContext.Provider>
);

describe('Ctrl+Z under a question the editor asks', () => {
  it.each(['imageReplace', 'codeRename', 'replaceAll'])('leaves the world alone under %s, which reports its surface', async (modal) => {
    window.location.hash = `#dev?modal=${modal}`;
    try {
      const { ctx } = renderWorldEditorBench(WORLD, 'advanced', {}, reported);
      openEditorTab(/Stats/);
      await removeStat('Damp');
      // The dev route raises the question over the edit.
      await screen.findByRole(modal === 'imageReplace' ? 'dialog' : 'alertdialog');
      expect(surfaceRegistry.get().dialog).toBe(modal);
      expect(await chord(document.body, 'z')).toBe(false);
      expect(statNames(ctx)).toEqual(['Warmth', 'Dread']);
    } finally {
      window.location.hash = '';
      await apart();
    }
  });

  it('leaves the world alone under a modal that reports no surface', async () => {
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
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced', {}, (tree) => <>{tree}<Unreported /></>);
    openEditorTab(/Stats/);
    await removeStat('Damp');
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    const question = await screen.findByRole('dialog', { name: 'Question' });
    expect(await chord(question, 'z')).toBe(false);
    expect(statNames(ctx)).toEqual(['Warmth', 'Dread']);
  });
});
