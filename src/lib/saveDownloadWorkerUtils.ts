/**
 * Client for the save-download web worker. See `createWorkerClient` for the request/response model.
 */
import { createWorkerClient } from './createWorkerClient';

const client = createWorkerClient(
  // type:'module' — required in dev, where Vite serves the worker with bare ESM imports a classic worker rejects.
  () => new Worker(new URL('./saveDownloadWorker.ts', import.meta.url), { type: 'module' }),
);

/** Build a downloadable save file off the main thread; resolves with the worker's `result`. */
export const downloadSaveFile = (saveData: unknown) => client.run({ saveData });

/** Terminate the download worker when it's no longer needed. */
export const terminateWorker = () => client.terminate();
