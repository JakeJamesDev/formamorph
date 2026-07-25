/**
 * Client for the JSON file worker. See `createWorkerClient` for the request/response model.
 */
import { createWorkerClient } from './createWorkerClient';

const client = createWorkerClient(
  // type:'module' — required in dev, where Vite serves the worker with bare ESM imports a classic worker rejects.
  () => new Worker(new URL('./jsonFileWorker.ts', import.meta.url), { type: 'module' }),
);

/** Serialize `value` to a downloadable Blob off the main thread. `space` matches `JSON.stringify`'s. */
export const serializeJsonBlob = (
  value: unknown,
  space?: number,
  mime = 'application/json',
): Promise<Blob> => client.run({ op: 'serialize', value, space, mime }) as Promise<Blob>;

/** Parse an imported file's text off the main thread. Rejects on malformed JSON. */
export const parseJsonText = (text: string): Promise<unknown> => client.run({ op: 'parse', text });

/** Terminate the JSON worker when it's no longer needed. */
export const terminateWorker = () => client.terminate();
