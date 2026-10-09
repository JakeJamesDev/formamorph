import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { AUTO_SAVE_IDLE_MS } from '@/lib/autoSaveScheduler';
import { WORLD_CHANGE_CHANNEL } from '@/lib/worldChangeSignal';
import WorldStorageService from '../services/WorldStorageService';

/**
 * A tab that hears its open world saved in another tab stops auto saving and asks which copy wins. Another
 * tab is a second channel on the save signal's name, which is what another tab's copy of the app opens.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
    isUneditedDefault: vi.fn().mockResolvedValue(false),
    getWorldData: vi.fn(),
  },
}));

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('react-toastify', () => ({ toast, ToastContainer: () => null }));

const storeWorld = vi.mocked(WorldStorageService.storeWorld);
const getWorldData = vi.mocked(WorldStorageService.getWorldData);
const TITLE = 'World Saved in Another Tab';

const nextTask = () => act(() => new Promise<void>((resolve) => { setTimeout(resolve, 0); }));
const nameField = () => screen.getByRole('textbox', { name: /World Name/i }) as HTMLInputElement;
const type = async (chars: number) => {
  const field = nameField();
  fireEvent.change(field, { target: { value: field.value + 'x'.repeat(chars) } });
  await nextTask();
};
const pressSave = () => fireEvent.keyDown(window, { key: 's', ctrlKey: true });

let otherTab: BroadcastChannel;
/** Another tab writes `worldId`, as its save or import does. */
const savedElsewhere = (worldId = 'w1') => act(() => { otherTab.postMessage({ worldId }); });
const dialog = () => screen.findByRole('alertdialog', { name: TITLE });
/** Lets a message already posted arrive and render. */
const settle = () => act(() => new Promise<void>((resolve) => { setTimeout(resolve, 50); }));

const openOptedIn = async () => {
  const bench = renderWorldEditorBench(benchEditorWorld({}), 'simple');
  fireEvent.change(await screen.findByDisplayValue('Sedge Landing'), { target: { value: 'Brinewell' } });
  await nextTask();
  pressSave();
  await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
  await nextTask();
  storeWorld.mockClear();
  return bench;
};

let quietConsole: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  otherTab = new BroadcastChannel(WORLD_CHANGE_CHANNEL);
  quietConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  otherTab.close();
  vi.useRealTimers();
  quietConsole.mockRestore();
  storeWorld.mockReset().mockResolvedValue(undefined);
  getWorldData.mockReset();
  toast.error.mockReset();
  localStorage.clear();
});

describe('a save of the open world in another tab', () => {
  it('pauses auto save and asks, and Escape does not dismiss it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openOptedIn();
    await type(30);
    await savedElsewhere();
    const asked = await dialog();
    expect(within(asked).getByText(/close the other tab/i)).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS));
    expect(storeWorld).not.toHaveBeenCalled();
    fireEvent.keyDown(asked, { key: 'Escape' });
    fireEvent.pointerDown(document.body);
    // A closing alert unmounts a commit late.
    await settle();
    expect(screen.getByRole('alertdialog', { name: TITLE })).toBeInTheDocument();
  });

  it('asks a tab with no unsaved changes too', async () => {
    await openOptedIn();
    await savedElsewhere();
    expect(await dialog()).toBeInTheDocument();
  });

  it('leaves a tab with another world open alone', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openOptedIn();
    await type(30);
    await savedElsewhere('another-world');
    await settle();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS));
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
  });
});

describe('Keep Mine', () => {
  it('resumes auto save, and the next save writes this tab’s world', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openOptedIn();
    await type(30);
    await savedElsewhere();
    fireEvent.click(within(await dialog()).getByRole('button', { name: 'Keep Mine' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS));
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
    expect(storeWorld.mock.calls[0][0]).toMatchObject({ name: `Brinewell${'x'.repeat(30)}` });
  });

  it('is what a save by hand does, once it works', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openOptedIn();
    await type(30);
    await savedElsewhere();
    await dialog();

    storeWorld.mockRejectedValueOnce(new Error('disk gone'));
    pressSave();
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
    await nextTask();
    expect(screen.getByRole('alertdialog', { name: TITLE })).toBeInTheDocument();

    pressSave();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(storeWorld).toHaveBeenCalledTimes(2);
    await type(30);
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS));
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(3));
  });
});

describe('Reload', () => {
  it('loads the other tab’s save, drops this tab’s edits, and starts History over', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const bench = await openOptedIn();
    await type(30);
    expect(bench.historyState().steps.length).toBeGreaterThan(0);
    getWorldData.mockResolvedValue(benchEditorWorld({
      worldOverview: { ...benchEditorWorld({}).worldOverview, name: 'Saltmarsh' },
    }));
    await savedElsewhere();
    fireEvent.click(within(await dialog()).getByRole('button', { name: 'Reload' }));

    await waitFor(() => expect(nameField().value).toBe('Saltmarsh'));
    expect(getWorldData).toHaveBeenCalledWith('w1');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(bench.ctx().isWorldDirty).toBe(false);
    expect(bench.ctx().isWorldStored).toBe(true);
    expect(bench.historyState().steps).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS));
    expect(storeWorld).not.toHaveBeenCalled();
  });

  it('keeps asking when the other tab’s save cannot be read', async () => {
    const bench = await openOptedIn();
    getWorldData.mockRejectedValue('World not found');
    await savedElsewhere();
    fireEvent.click(within(await dialog()).getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('alertdialog', { name: TITLE })).toBeInTheDocument();
    // The open dialog hides the editor from the accessibility tree, so the store is read.
    expect(bench.ctx().worldOverview.name).toBe('Brinewell');
  });
});

const DELETED = 'World Deleted in Another Tab';
const deletedElsewhere = () => act(() => { otherTab.postMessage({ worldId: 'w1', deleted: true }); });
const deletedDialog = () => screen.findByRole('alertdialog', { name: DELETED });

describe('a delete of the open world in another tab', () => {
  it('pauses auto save and asks, and Escape does not dismiss it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openOptedIn();
    await type(30);
    await deletedElsewhere();
    const asked = await deletedDialog();
    expect(within(asked).getByRole('button', { name: 'Close' })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS));
    expect(storeWorld).not.toHaveBeenCalled();
    fireEvent.keyDown(asked, { key: 'Escape' });
    await settle();
    expect(screen.getByRole('alertdialog', { name: DELETED })).toBeInTheDocument();
  });

  it('Keep Mine saves this copy back and resumes', async () => {
    await openOptedIn();
    await type(30);
    await deletedElsewhere();
    fireEvent.click(within(await deletedDialog()).getByRole('button', { name: 'Keep Mine' }));
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
    expect(storeWorld.mock.calls[0][0]).toMatchObject({ id: 'w1', name: `Brinewell${'x'.repeat(30)}` });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('Close leaves the editor and discards the edits', async () => {
    const bench = await openOptedIn();
    await type(30);
    await deletedElsewhere();
    fireEvent.click(within(await deletedDialog()).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(bench.onClose).toHaveBeenCalledTimes(1));
    expect(bench.ctx().worldOverview.name).toBe('Brinewell');
    expect(bench.ctx().isWorldDirty).toBe(false);
    expect(storeWorld).not.toHaveBeenCalled();
  });
});
