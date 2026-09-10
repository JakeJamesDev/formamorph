/**
 * Client for publish-size measures in the JSON file worker. Its own instance, apart from the export client
 * in `jsonFileWorkerUtils`: a measure never queues behind an export, and the World Editor can stop it on
 * close without stopping an export still in flight.
 */
import { createWorkerClient } from './createWorkerClient';

const client = createWorkerClient(
  // type:'module' — required in dev, where Vite serves the worker with bare ESM imports a classic worker rejects.
  () => new Worker(new URL('./jsonFileWorker.ts', import.meta.url), { type: 'module' }),
);

/** The UTF-8 byte length of `value`'s compact JSON, measured off the main thread. */
export const measureJsonBytes = (value: unknown): Promise<number> =>
  client.run({ op: 'measure', value }) as Promise<number>;

/** Terminate the measure worker when the editor that measures closes. */
export const terminateMeasureWorker = () => client.terminate();
