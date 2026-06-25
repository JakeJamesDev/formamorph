/**
 * Shared request/response client for our web workers. Lazily spins up a single worker, tags each
 * request with a unique id, and resolves/rejects the matching promise when the worker replies with
 * `{ type: 'success' | 'error', id, result?, error? }`.
 *
 * Pass a factory that constructs the worker (kept as a literal `new Worker(new URL('./x.ts',
 * import.meta.url))` at the call site so Vite can statically bundle it).
 */
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

export function createWorkerClient(createWorker: () => Worker) {
  const pendingRequests = new Map<string, PendingRequest>();
  let workerInstance: Worker | null = null;

  const getWorker = (): Worker => {
    if (!workerInstance) {
      workerInstance = createWorker();
      workerInstance.addEventListener('message', (event) => {
        const { type, id, result, error } = event.data;
        const pendingRequest = pendingRequests.get(id);
        if (!pendingRequest) {
          console.warn(`Received response for unknown request ID: ${id}`);
          return;
        }
        if (type === 'success') {
          pendingRequest.resolve(result);
        } else if (type === 'error') {
          pendingRequest.reject(new Error(error.message));
        }
        pendingRequests.delete(id);
      });
    }
    return workerInstance;
  };

  /** Send `payload` (plus a generated `id`) to the worker; resolves with its `result`. */
  const run = (payload: Record<string, unknown>): Promise<unknown> =>
    new Promise((resolve, reject) => {
      try {
        const worker = getWorker();
        const id = crypto.randomUUID();
        pendingRequests.set(id, { resolve, reject });
        worker.postMessage({ ...payload, id });
      } catch (error) {
        reject(error as Error);
      }
    });

  /** Terminate the worker and drop any in-flight requests (e.g. on teardown). */
  const terminate = () => {
    if (workerInstance) {
      workerInstance.terminate();
      workerInstance = null;
      pendingRequests.clear();
    }
  };

  return { run, terminate };
}
