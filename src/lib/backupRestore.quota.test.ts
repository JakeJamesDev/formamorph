import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach } from 'vitest';
import { STORE_TARGETS } from './backupRestore';
import { failWritesOnQuota } from '@/test/quotaAbort';

/** A backup restore into a library on a full disk rejects with the browser's error, never a false success. */

let restore: (() => void) | null = null;
afterEach(() => { restore?.(); restore = null; });

describe('a restore on a full disk', () => {
  it('rejects with the QuotaExceededError', async () => {
    const target = STORE_TARGETS.entities;
    const db = await target.open();
    restore = failWritesOnQuota(target.store);

    await expect(target.write(db, [{ id: 'e1', name: 'Wren', data: {} }]))
      .rejects.toMatchObject({ name: 'QuotaExceededError' });
    db.close();
  });
});
