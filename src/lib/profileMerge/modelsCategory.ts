/**
 * The merge category for local models: files in the AppData profile's models folder move into the folder's
 * models directory. A file the folder already holds stays on both sides.
 */
import type { MergeCategory, MergeItem } from './engine';
import type { ModelFile, ProfileMergeBridge } from './bridge';
import { MERGE_KEYS } from './keys';

const isSidecar = (name: string) => name.toLowerCase().endsWith('.gguf.part.json');

// A resume sidecar weighs 0 so the smallest-first order puts it ahead of the part it describes.
const itemOf = (file: ModelFile): MergeItem => ({ id: file.name, label: file.name, size: isSidecar(file.name) ? 0 : file.size });

/** Local models. Bytes count the progress, and the category runs after every other one. */
export function modelsCategory(bridge: ProfileMergeBridge): MergeCategory {
  let sides: Promise<{ source: ModelFile[]; target: ModelFile[] }> | undefined;
  const read = () => (sides ??= bridge.models());
  return {
    key: MERGE_KEYS.models,
    label: 'Local Models',
    stamped: false,
    unit: 'bytes',
    last: true,
    target: async () => (await read()).target.map(itemOf),
    source: async () => (await read()).source.map(itemOf),
    copy: (item, report) => bridge.moveModel(item.id, report),
  };
}
