import type { World } from '@/types';
import { serializeJsonBlob } from './jsonFileWorkerUtils';
import { APP_VERSION, WORLD_FILE_KIND } from './version';

/** Serializes a world into the importable file format without modifying its authored content. */
export function serializeWorldFile(world: World): Promise<Blob> {
  const { id: _id, ...worldFields } = world;
  return serializeJsonBlob({ formamorphKind: WORLD_FILE_KIND, ...worldFields, version: APP_VERSION }, 2);
}
