/**
 * A full disk under fake-indexeddb, which has no storage limit of its own.
 *
 * A browser out of space lets every request succeed and aborts the transaction at commit with a
 * `QuotaExceededError`. No request fails, so only the transaction's abort event reports it.
 */

/** fake-indexeddb's own abort, which sets the transaction's error by name as a quota abort does. */
interface FakeTransaction extends IDBTransaction {
  _abort(errorName: string): void;
}

/**
 * Abort every transaction that puts a record into `storeName`, as a full disk does. Returns the undo.
 *
 * @param storeName - The object store whose writes run out of space
 */
export function failWritesOnQuota(storeName: string): () => void {
  const proto = IDBObjectStore.prototype;
  const realPut = proto.put;
  proto.put = function put(this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
    const request = realPut.apply(this, args);
    if (this.name === storeName) {
      const transaction = this.transaction as FakeTransaction;
      request.addEventListener('success', () => transaction._abort('QuotaExceededError'));
    }
    return request;
  };
  return () => { proto.put = realPut; };
}
