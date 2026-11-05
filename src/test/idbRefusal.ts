import { IDBObjectStore } from 'fake-indexeddb';
import { vi } from 'vitest';

/**
 * Have the browser refuse each listed id's read, and whole-store reads of each listed store, as a lost file does.
 * The real requests run in their live transactions. Chromium aborts a read-write one, even after preventDefault.
 *
 * @param lost - The refused ids, by store name
 * @returns Puts the real reads back
 */
export function refuseReads(lost: Record<string, string[]>): () => void {
  const refuse = (request: IDBRequest) => {
    const error = new DOMException('Data lost', 'NotReadableError');
    Object.defineProperty(request, 'error', { get: () => error, set: () => {} });
    Object.defineProperty(request, 'onsuccess', {
      get: () => () => {
        request.onerror?.({ target: request, preventDefault() {}, stopPropagation() {} } as unknown as Event);
        if (request.transaction?.mode === 'readwrite') request.transaction.abort();
      },
      set: () => {},
    });
    return request;
  };
  const get = IDBObjectStore.prototype.get;
  const getAll = IDBObjectStore.prototype.getAll;
  const spies = [
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
      const request = get.call(this, key) as unknown as IDBRequest;
      return (lost[this.name]?.includes(String(key)) ? refuse(request) : request) as never;
    }),
    vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['getAll']>) {
      const request = getAll.apply(this, args) as unknown as IDBRequest;
      return (lost[this.name] ? refuse(request) : request) as never;
    }),
  ];
  return () => spies.forEach((spy) => spy.mockRestore());
}
