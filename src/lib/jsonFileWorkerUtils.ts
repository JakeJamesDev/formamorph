/**
 * Client for the JSON file worker. See `createWorkerClient` for the request/response model.
 */
import { createWorkerClient } from './createWorkerClient';
import type { BackupIndex } from './backupIndex';
import type { RestoreCounts, RestoreRequest } from './backupRestore';
import type { PublishBody } from './publishBody';
import type { PublishPayload } from './publishPayload';
import type { World } from '@/types';

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

/** Serialize `value` to a compact Blob in parts, opening containers down to `splitDepth`. */
export const serializeJsonBlobSplit = (value: unknown, splitDepth: number): Promise<Blob> =>
  client.run({ op: 'serialize', value, splitDepth }) as Promise<Blob>;

/** Index a backup file for restore off the main thread. Rejects on a file that is not a backup. */
export const indexBackupInWorker = (file: Blob): Promise<BackupIndex> =>
  client.run({ op: 'indexBackup', file }) as Promise<BackupIndex>;

/** Restore a backup's ticked records off the main thread; `onProgress(done)` counts optimized images. */
export const restoreBackupInWorker = (request: RestoreRequest, onProgress?: (done: number) => void): Promise<RestoreCounts> =>
  client.run({ op: 'restoreBackup', request }, (done) => typeof done === 'number' && onProgress?.(done)) as Promise<RestoreCounts>;

/** Parse an imported file's text off the main thread. Rejects on malformed JSON. */
export const parseJsonText = (text: string): Promise<unknown> => client.run({ op: 'parse', text });

/** Read, parse and migrate an imported world file off the main thread. Rejects on a file that is not JSON. */
export const parseWorldFile = (file: Blob): Promise<World> => client.run({ op: 'parseWorld', file }) as Promise<World>;

/** Build a publish request's body and size its content off the main thread. */
export const buildPublishBodyInWorker = (payload: PublishPayload, contestEventId: string | null): Promise<PublishBody> =>
  client.run({ op: 'publishBody', payload, contestEventId }) as Promise<PublishBody>;

/** Terminate the JSON worker when it's no longer needed. */
export const terminateWorker = () => client.terminate();
