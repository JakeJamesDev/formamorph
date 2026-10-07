import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { asMobile, benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { downloadBlob } from '@/lib/downloadBlob';

/** The World Editor's desktop app bar: its order, the world actions per mode, the save state, and the footer. */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

// The export serializes off-thread; jsdom has no worker.
vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(async () => new Blob()), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const WORLD = benchEditorWorld({});

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const saveState = () => screen.queryByText(/^(Saved|Unsaved changes)$/);
/** Types a new world name over the current one. */
const rename = (from: string, to: string) => fireEvent.change(screen.getByDisplayValue(from), { target: { value: to } });
const save = async () => {
  await waitFor(() => expect(button('Save')).toBeEnabled());
  await act(async () => { fireEvent.click(button('Save')); });
};
/** True when each element comes after the one before it in the document. */
const inOrder = (elements: HTMLElement[]) => elements.every((el, i) => i === 0
  || (elements[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);

beforeEach(() => { localStorage.clear(); vi.mocked(downloadBlob).mockClear(); });

describe('World Editor app bar (desktop)', () => {
  it('reads back, title, save state, Find, Test Bench, the mode, the world actions and Save, with no ?', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple', { initialTab: 'stats' });
    act(() => { ctx().loadWorldData(WORLD, false, { stored: true }); });
    const order = [
      button('Back'),
      screen.getByRole('heading', { name: 'World Editor' }),
      screen.getByText('Saved'),
      button('Find and replace'),
      button(/^Test Bench/),
      screen.getByRole('combobox', { name: 'Editor mode' }),
      button('Export World'),
      button('Save'),
    ];
    expect(inOrder(order)).toBe(true);
    expect(screen.queryAllByRole('button', { name: /^About / })).toHaveLength(0);
  });

  it('shows the Export World icon in Simple, and it downloads the world', async () => {
    renderWorldEditorBench(WORLD, 'simple');
    expect(screen.queryByRole('button', { name: 'More world actions' })).toBeNull();
    fireEvent.click(button('Export World'));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe('Sedge Landing.json');
  });

  it('gathers Export World and Optimize Images in a menu in Advanced, and its Export downloads the world', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    expect(screen.queryByRole('button', { name: 'Export World' })).toBeNull();
    fireEvent.click(button('More world actions'));
    const menu = await screen.findByRole('dialog');
    expect(within(menu).getByRole('button', { name: 'Optimize Images' })).toBeEnabled();
    fireEvent.click(within(menu).getByRole('button', { name: 'Export World' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    // The menu itself: the first-visit Authoring Tour offer is a dialog too, and opens on its own delay.
    await waitFor(() => expect(menu).not.toBeInTheDocument());
  });

  it('shows no save state for a world never stored, even with edits, then Saved, then Unsaved changes', async () => {
    renderWorldEditorBench(WORLD, 'simple');
    expect(saveState()).toBeNull();
    rename('Sedge Landing', 'Brinewell');
    expect(saveState()).toBeNull();

    await save();
    expect(saveState()).toHaveTextContent('Saved');
    rename('Brinewell', 'Brinewell Reach');
    expect(saveState()).toHaveTextContent('Unsaved changes');
  });

  it('shows Saved at once for a world loaded from world storage, and keeps it through a discard', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    act(() => { ctx().loadWorldData(WORLD, false, { stored: true }); });
    expect(saveState()).toHaveTextContent('Saved');
    rename('Sedge Landing', 'Brinewell');
    expect(saveState()).toHaveTextContent('Unsaved changes');
    act(() => { ctx().discardChanges(); });
    expect(saveState()).toHaveTextContent('Saved');
  });

  it('draws no footer on Overview, and only the tab\'s own actions on Entities', () => {
    renderWorldEditorBench(WORLD, 'simple', { initialTab: 'overview' });
    expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Export World' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Save to Library' })).toBeNull();

    openEditorTab(/^Entities$/);
    expect(button('Save to Library')).toBeInTheDocument();
    // The adds live in the + menu, not the footer.
    expect(screen.queryByRole('button', { name: 'Add Entity' })).toBeNull();
    // The bar's Save and Export World are the only ones: the footer adds neither.
    expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Export World' })).toHaveLength(1);
  });
});

describe('World Editor footer (mobile)', () => {
  let undoMobile: () => void;
  beforeEach(() => { undoMobile = asMobile(); });
  afterEach(() => undoMobile());

  it('keeps Export World, Optimize Images in Advanced, and Save', () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'overview' });
    expect(button('Export World')).toBeInTheDocument();
    expect(button('Optimize Images')).toBeInTheDocument();
    expect(button('Save')).toBeInTheDocument();
  });
});
