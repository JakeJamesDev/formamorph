// Only the game imports this module, so the site build bundles no world files.
import type { BundledWorlds } from '@/lib/defaultWorlds';

/**
 * The bundled default worlds as raw JSON text, so their content can be hashed without re-serializing the
 * parsed object (they carry base64 images and run to megabytes).
 */
const BUNDLED_WORLD_RAW = import.meta.glob('../defaultworlds/*.json', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

/** Each bundled world's `contentHash`, computed at build time from the text above. */
const BUNDLED_WORLD_HASH = import.meta.glob('../defaultworlds/*.json', {
  query: '?raw&world-hash',
  import: 'default',
}) as Record<string, () => Promise<string>>;

/** One world's module from `modules`. Rejects when no file has that id. */
function loadWorldModule(modules: Record<string, () => Promise<string>>, id: string): Promise<string> {
  const load = modules[`../defaultworlds/${id}.json`];
  if (!load) return Promise.reject(new Error(`No bundled JSON for default world "${id}"`));
  return load();
}

/** The bundled worlds as the seeder reads them. */
export const bundledWorlds: BundledWorlds = {
  hashOf: (id) => loadWorldModule(BUNDLED_WORLD_HASH, id),
  read: (id) => loadWorldModule(BUNDLED_WORLD_RAW, id),
};
