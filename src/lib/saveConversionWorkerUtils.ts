/**
 * Client for the save-conversion web worker. See `createWorkerClient` for the request/response model.
 */
import { createWorkerClient } from './createWorkerClient';

const client = createWorkerClient(
  () => new Worker(new URL('./saveConversionWorker.ts', import.meta.url)),
);

/** Convert a save file off the main thread; resolves with the worker's `result`. */
export const convertSaveFile = (savedData: unknown) => client.run({ savedData });

/** Terminate the conversion worker when it's no longer needed. */
export const terminateWorker = () => client.terminate();
