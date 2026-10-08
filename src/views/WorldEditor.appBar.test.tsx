import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { asMobile, benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { downloadBlob } from '@/lib/downloadBlob';

/** The World Editor's desktop app bar: its order, the world actions per mode, the world name, and the footer. */

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
/** The bar's start column: back, the title, the chevron and the world's name. */
const barStart = () => screen.getByRole('heading', { name: 'World Editor' }).parentElement!;
const barChevron = () => barStart().querySelector<HTMLElement>('.lucide-chevron-right');
const barName = (name: string) => within(barStart()).getByText(name);
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
  it('reads back, title, world name, Search World, the mode, Test Bench, Save and its menu, with no ?', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple', { initialTab: 'stats' });
    act(() => { ctx().loadWorldData(WORLD, false, { stored: true }); });
    const order = [
      button('Back'),
      screen.getByRole('heading', { name: 'World Editor' }),
      barName('Sedge Landing'),
      screen.getByRole('textbox', { name: 'Search World' }),
      screen.getByRole('combobox', { name: 'Editor mode' }),
      button(/^Test Bench/),
      button('Save'),
      button('Save options'),
    ];
    expect(inOrder(order)).toBe(true);
    expect(screen.queryAllByRole('button', { name: /^About / })).toHaveLength(0);
  });

  it.each(['simple', 'advanced'] as const)('holds Export World in the Save menu in %s, and it downloads the world', async (mode) => {
    renderWorldEditorBench(WORLD, mode);
    expect(screen.queryByRole('button', { name: 'More world actions' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export World' })).toBeNull();
    fireEvent.click(button('Save options'));
    fireEvent.click(await screen.findByRole('button', { name: 'Export World' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe('Sedge Landing.json');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Export World' })).toBeNull());
  });

  it('shows Optimize Images as an icon button before the Test Bench in Advanced only', () => {
    const { unmount } = renderWorldEditorBench(WORLD, 'simple');
    expect(screen.queryByRole('button', { name: 'Optimize Images' })).toBeNull();
    unmount();

    renderWorldEditorBench(WORLD, 'advanced');
    const optimize = button('Optimize Images');
    expect(optimize).toBeEnabled();
    expect(optimize).toHaveTextContent(/^$/);
    expect(inOrder([screen.getByRole('combobox', { name: 'Editor mode' }), optimize, button(/^Test Bench/), button('Save')]))
      .toBe(true);
  });

  it('keeps the Save menu open to use while a clean world disables the Save face', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    act(() => { ctx().loadWorldData(WORLD, false, { stored: true }); });
    expect(button('Save')).toBeDisabled();
    expect(button('Save options')).toBeEnabled();
  });

  it('names the world after a chevron, trimmed, and follows a rename', () => {
    renderWorldEditorBench(WORLD, 'simple');
    expect(barName('Sedge Landing')).toBeInTheDocument();
    expect(barChevron()).not.toBeNull();
    expect(inOrder([screen.getByRole('heading', { name: 'World Editor' }), barChevron()!, barName('Sedge Landing')])).toBe(true);

    rename('Sedge Landing', '  Brinewell  ');
    expect(barName('Brinewell')).toBeInTheDocument();
  });

  it('shows the title alone, with no chevron, for a blank name', () => {
    renderWorldEditorBench(WORLD, 'simple');
    rename('Sedge Landing', '   ');
    expect(barChevron()).toBeNull();
    expect(barStart().textContent).toBe('World Editor');
  });

  it('shows no save-state text, and Save alone tracks whether the world has changes', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    act(() => { ctx().loadWorldData(WORLD, false, { stored: true }); });
    expect(saveState()).toBeNull();
    expect(button('Save')).toBeDisabled();

    rename('Sedge Landing', 'Brinewell');
    expect(saveState()).toBeNull();
    expect(button('Save')).toBeEnabled();

    await save();
    expect(saveState()).toBeNull();
    expect(button('Save')).toBeDisabled();
  });

  it('draws no footer on Overview, and only the tab\'s own actions on Entities', () => {
    renderWorldEditorBench(WORLD, 'simple', { initialTab: 'overview' });
    expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Save options' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Save to Library' })).toBeNull();

    openEditorTab(/^Entities$/);
    expect(button('Save to Library')).toBeInTheDocument();
    // The adds live in the + menu, not the footer.
    expect(screen.queryByRole('button', { name: 'Add Entity' })).toBeNull();
    // The bar's Save pair is the only one: the footer adds none.
    expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Save options' })).toHaveLength(1);
  });
});

describe('World Editor footer (mobile)', () => {
  let undoMobile: () => void;
  beforeEach(() => { undoMobile = asMobile(); });
  afterEach(() => undoMobile());

  it('keeps Optimize Images as an icon in Advanced, and Export World in the Save menu', async () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'overview' });
    expect(screen.queryByRole('button', { name: 'More world actions' })).toBeNull();
    expect(button('Optimize Images')).toBeInTheDocument();
    expect(button('Save')).toBeInTheDocument();
    fireEvent.click(button('Save options'));
    expect(await screen.findByRole('button', { name: 'Export World' })).toBeInTheDocument();
  });
});
