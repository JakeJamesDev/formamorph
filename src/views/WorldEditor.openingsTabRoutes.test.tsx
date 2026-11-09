import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  benchEditorWorld, entityFieldsTab, openEditorTab, renderWorldEditorBench, searchWorldField, shownEditorTab,
} from '@/test/worldEditorBench';
import type { World } from '@/types';

/** The routes that land on the Openings tab, driven through the real editor: a Find hit in an opening, and
 *  an undo or redo of an opening edit made there. Each reads the shown tab and the selected owner row. */

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

/** Each owner's opening holds a word found nowhere else, so a query names the owner it lands on. */
const WORLD: World = benchEditorWorld({
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', readme: '', tags: [],
    openings: [{ id: 'w1', text: 'The ferry bell tolls over the reeds.', kind: 'narration' }],
  },
  locations: [
    { id: 'harbor', name: 'Harbor Steps', isStarting: true, openings: [{ id: 'h1', text: 'Gulls wheel over the pilings.', kind: 'action' }] },
  ],
  entities: [
    { id: 'resident', name: 'Odd Wick', locations: ['harbor'], openings: [{ id: 'r1', text: 'Odd Wick trims a lamp.', kind: 'action' }] },
  ],
} as unknown as Partial<World>);

const listPane = () => document.querySelector<HTMLElement>('[data-panel-id="editor-list"]')!;
const detailPane = () => document.querySelector<HTMLElement>('[data-panel-id="editor-detail"]')!;
const selectedOwner = () => listPane().querySelector('[data-editor-row-selected] button[aria-label^="Select "]')?.textContent;
const selectOwner = (name: string) => fireEvent.click(within(listPane()).getByRole('button', { name: `Select ${name}` }));

/** Press Ctrl+F, type the query, and wait for the search to land on its first hit. */
const findFirst = async (query: string) => {
  fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
  await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
  fireEvent.change(searchWorldField(), { target: { value: query } });
  await waitFor(() => expect(screen.getByText(/^1 \/ \d+$/)).toBeInTheDocument());
};
const ringed = () => waitFor(() => {
  const el = document.querySelector('.editor-find-target');
  expect(el).not.toBeNull();
  return el as HTMLElement;
});

const step = (action: () => void | Promise<void>) => act(async () => { await action(); });
const undo = () => step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
const redo = () => step(() => { fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true }); });

const open = async () => {
  const bench = renderWorldEditorBench(WORLD, 'advanced');
  await screen.findByLabelText('World Name');
  return bench;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('a Find hit in an opening', () => {
  it.each([
    ['This World', 'ferry'],
    ['Harbor Steps', 'gulls'],
    ['Odd Wick', 'trims'],
  ])('opens the Openings tab with %s selected, and rings the hit', async (owner, word) => {
    await open();
    openEditorTab(/Stats/);
    await findFirst(word);

    await waitFor(() => expect(shownEditorTab()).toMatch(/Openings/));
    expect(selectedOwner()).toBe(owner);
    expect((await ringed()).textContent?.toLowerCase()).toContain(word);
  });
});

describe('an undo of an opening edit made on the Openings tab', () => {
  it.each([
    ['This World', (w: World) => w.worldOverview.openings],
    ['Harbor Steps', (w: World) => w.locations.find((l) => l.id === 'harbor')!.openings],
    ['Odd Wick', (w: World) => w.entities.find((e) => e.id === 'resident')!.openings],
  ])('opens the Openings tab on %s from another tab, on undo and redo', async (owner, openingsOf) => {
    const { ctx } = await open();
    openEditorTab(/^Openings$/);
    // This World is the desktop default, held with nothing selected.
    if (owner !== 'This World') selectOwner(owner);
    expect(selectedOwner()).toBe(owner);
    await step(() => { fireEvent.click(within(detailPane()).getByRole('button', { name: 'Add Opening' })); });
    expect(openingsOf(ctx() as unknown as World)).toHaveLength(2);

    // The selection moves to another owner before each move, so the reveal has to bring it back.
    const other = owner === 'Odd Wick' ? 'Harbor Steps' : 'Odd Wick';
    for (const move of [undo, redo]) {
      selectOwner(other);
      openEditorTab(/Stats/);
      await move();
      expect(shownEditorTab()).toMatch(/Openings/);
      expect(selectedOwner()).toBe(owner);
    }
    expect(openingsOf(ctx() as unknown as World)).toHaveLength(2);
  });
});

describe("an undo of an opening edit made on an entity's own Openings tab", () => {
  it('returns to that tab, not the Openings tab', async () => {
    const { ctx } = await open();
    openEditorTab(/Entities/);
    fireEvent.click(screen.getAllByText('Odd Wick')[0]);
    fireEvent.mouseDown(entityFieldsTab('Openings'));
    await step(() => { fireEvent.click(within(detailPane()).getByRole('button', { name: /Add Opening/ })); });
    expect(ctx().entities[0].openings).toHaveLength(2);
    openEditorTab(/Stats/);

    await undo();
    expect(shownEditorTab()).toMatch(/Entities/);
    expect(entityFieldsTab('Openings')).toHaveAttribute('aria-selected', 'true');
  });
});
