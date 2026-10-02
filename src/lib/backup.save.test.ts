import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  serializeJsonBlobSplit: vi.fn(),
  downloadBlob: vi.fn(),
}));
vi.mock('@/lib/jsonFileWorkerUtils', () => ({ serializeJsonBlobSplit: mocks.serializeJsonBlobSplit }));
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: mocks.downloadBlob }));

import { BackupTooLargeError, MAX_RESTORE_BYTES, saveBackup, type BackupBundle } from './backup';

const bundle: BackupBundle = {
  formamorphBackup: 1,
  appVersion: 'test',
  exportedAt: '2026-10-02T00:00:00.000Z',
  data: { worlds: [], saves: [], entities: [], dictionaries: [] },
};

/** A Blob stand-in that reports a size without holding the bytes. */
const sizedBlob = (size: number) => ({ size }) as Blob;

describe('saveBackup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('downloads a backup that restore can read', async () => {
    mocks.serializeJsonBlobSplit.mockResolvedValue(sizedBlob(MAX_RESTORE_BYTES));
    await saveBackup(bundle);
    expect(mocks.serializeJsonBlobSplit).toHaveBeenCalledWith(bundle, 3);
    expect(mocks.downloadBlob).toHaveBeenCalledWith(expect.anything(), 'formamorph-backup-2026-10-02.json');
  });

  it('refuses a backup over the restore limit and states its size', async () => {
    mocks.serializeJsonBlobSplit.mockResolvedValue(sizedBlob(700 * 2 ** 20));
    const error = await saveBackup(bundle).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BackupTooLargeError);
    expect((error as Error).message).toContain('700 MB');
    expect(mocks.downloadBlob).not.toHaveBeenCalled();
  });
});
