import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  serializeJsonBlobSplit: vi.fn(),
  downloadBlob: vi.fn(),
}));
vi.mock('@/lib/jsonFileWorkerUtils', () => ({ serializeJsonBlobSplit: mocks.serializeJsonBlobSplit }));
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: mocks.downloadBlob }));

import { saveBackup, type BackupBundle } from './backup';

describe('saveBackup', () => {
  it('serializes each record as its own part and downloads the file', async () => {
    const bundle: BackupBundle = {
      formamorphBackup: 1,
      appVersion: 'test',
      exportedAt: '2026-10-02T00:00:00.000Z',
      data: { worlds: [], saves: [], entities: [], dictionaries: [] },
    };
    const blob = new Blob(['{}']);
    mocks.serializeJsonBlobSplit.mockResolvedValue(blob);
    await saveBackup(bundle);
    expect(mocks.serializeJsonBlobSplit).toHaveBeenCalledWith(bundle, 3);
    expect(mocks.downloadBlob).toHaveBeenCalledWith(blob, 'formamorph-backup-2026-10-02.json');
  });
});
