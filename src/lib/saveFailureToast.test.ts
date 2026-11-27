// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';
import { linkToast, toastError } from './linkToast';
import {
  toastAutosaveFailure, toastDownloadFailure, toastSaveFailure, isDiskWriteError, DISK_WRITE_CAUSE, SAVE_FAILED, STORAGE_FULL,
} from './saveFailureToast';
import type { World } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }));
vi.mock('./linkToast', () => ({ linkToast: vi.fn(), toastError: vi.fn() }));

const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
/** Chromium's blob-file write failure, as the save in report 253 rejected with. */
const diskWrite = Object.assign(new Error('Failed to write blobs (IOError)'), { name: 'DataError' });
const world = { worldOverview: { name: 'Fen' } } as unknown as World;

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.mocked(linkToast).mockClear();
  vi.mocked(toastError).mockClear();
});

describe('toastSaveFailure', () => {
  it('offers Export World when the storage is full', async () => {
    await toastSaveFailure(quota, world);
    expect(linkToast).toHaveBeenCalledWith(expect.arrayContaining([STORAGE_FULL]), 'Export World', expect.any(Function), expect.anything());
  });

  it('states the reason in place of Export World for a Supporter Copy', async () => {
    await toastSaveFailure(quota, world, "You can't export a Supporter world");
    expect(linkToast).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("You can't export a Supporter world."), { autoClose: false });
  });
});

describe('isDiskWriteError', () => {
  it('matches a blob write failure with any result suffix', () => {
    expect(isDiskWriteError(diskWrite)).toBe(true);
    expect(isDiskWriteError(Object.assign(new Error('Failed to write blobs (Error)'), { name: 'DataError' }))).toBe(true);
  });

  it('rejects other DataErrors, the same text under another name, and non-errors', () => {
    expect(isDiskWriteError(Object.assign(new Error('Failed to read large IndexedDB value'), { name: 'DataError' }))).toBe(false);
    expect(isDiskWriteError(new Error('Failed to write blobs (IOError)'))).toBe(false);
    expect(isDiskWriteError('Failed to write blobs (IOError)')).toBe(false);
    expect(isDiskWriteError(null)).toBe(false);
  });
});

describe('disk write failures', () => {
  it('names the likely causes and offers Export World on a world save', async () => {
    await toastSaveFailure(diskWrite, world);
    expect(toastError).not.toHaveBeenCalled();
    expect(linkToast).toHaveBeenCalledWith(
      expect.arrayContaining([SAVE_FAILED, DISK_WRITE_CAUSE]), 'Export World', expect.any(Function), expect.anything(),
    );
  });

  it('names the likely causes on an autosave and a download', async () => {
    toastAutosaveFailure(diskWrite);
    await toastDownloadFailure(diskWrite);
    expect(toastError).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(2);
    for (const [text] of vi.mocked(toast.error).mock.calls) expect(text).toContain(DISK_WRITE_CAUSE);
  });
});
