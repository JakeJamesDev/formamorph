import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { openLatestDetails, toastTexts } from '@/test/toastText';
import { EXPORT_TO_KEEP, SAVE_FAILED, STORAGE_FULL } from '@/lib/saveFailureToast';
import { downloadBlob } from '@/lib/downloadBlob';
import { serializeJsonBlob } from '@/lib/jsonFileWorkerUtils';
import WorldStorageService from '../services/WorldStorageService';

/**
 * A World Editor save that fails: a full disk names the space and offers Export World for the unsaved world;
 * any other failure shows the general message with View Details.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

// The export serializes off-thread; jsdom has no worker.
vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(async () => new Blob()),
  parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }));

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('react-toastify', () => ({ toast, ToastContainer: () => null }));

const storeWorld = vi.mocked(WorldStorageService.storeWorld);
const GB = 1_000_000_000;

/** jsdom has no `navigator.storage`; this stands in for the browser's estimate. */
const setStorage = (storage: unknown) =>
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });

const renameAndSave = async (name: string) => {
  renderWorldEditorBench(benchEditorWorld({}), 'simple');
  fireEvent.change(screen.getByDisplayValue('Sedge Landing'), { target: { value: name } });
  const save = screen.getByRole('button', { name: 'Save' });
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(save);
};

let quietConsole: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  quietConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
  setStorage({ estimate: async () => ({ usage: 2.4 * GB, quota: 2.5 * GB }) });
});
afterEach(() => {
  setStorage(undefined);
  quietConsole.mockRestore();
  vi.mocked(downloadBlob).mockClear();
  storeWorld.mockReset().mockResolvedValue(undefined);
  toast.error.mockReset();
});

describe('a save on a full disk', () => {
  it('says the storage is full, with the space used and available', async () => {
    storeWorld.mockRejectedValueOnce(new DOMException('The quota has been exceeded.', 'QuotaExceededError'));
    await renameAndSave('Brinewell');

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const [text] = toastTexts(toast.error);
    expect(text).toContain(STORAGE_FULL);
    expect(text).toContain('Formamorph uses 2.4 GB. 100 MB is available.');
    expect(text).toContain(EXPORT_TO_KEEP);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('Export World downloads the unsaved world', async () => {
    storeWorld.mockRejectedValueOnce(new DOMException('The quota has been exceeded.', 'QuotaExceededError'));
    await renameAndSave('Brinewell');
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));

    const view = render(toast.error.mock.calls[0][0] as ReactNode);
    fireEvent.click(within(view.container).getByRole('button', { name: 'Export World' }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe('Brinewell.json');
    expect(vi.mocked(serializeJsonBlob).mock.calls[0][0]).toMatchObject({ worldOverview: { name: 'Brinewell' } });
  });

  it('leaves out the space line when the browser gives no estimate', async () => {
    setStorage(undefined);
    storeWorld.mockRejectedValueOnce(new DOMException('The quota has been exceeded.', 'QuotaExceededError'));
    await renameAndSave('Brinewell');

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const [text] = toastTexts(toast.error);
    expect(text).toContain(STORAGE_FULL);
    expect(text).not.toContain('available');
  });
});

describe('a save that fails for another reason', () => {
  it('shows the general message, and View Details holds the cause', async () => {
    // A browser's DOMException is an Error; jsdom's is not, so the test builds the browser's shape.
    storeWorld.mockRejectedValueOnce(Object.assign(new Error('The transaction was aborted.'), { name: 'AbortError' }));
    await renameAndSave('Brinewell');

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toastTexts(toast.error)[0]).toContain(SAVE_FAILED);
    expect(toastTexts(toast.error)[0]).not.toContain('Export World');
    expect(openLatestDetails(toast.error)?.details).toContain('AbortError');
  });
});
