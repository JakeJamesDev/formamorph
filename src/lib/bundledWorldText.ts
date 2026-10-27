// Only the game imports this module, so the site build bundles no world files.

/**
 * The bundled default worlds as raw JSON text, so their content can be hashed without re-serializing the
 * parsed object (they carry base64 images and run to megabytes).
 */
const BUNDLED_WORLD_RAW = import.meta.glob('../defaultworlds/*.json', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

/** Reads one bundled world's JSON text by its id. Rejects when no file has that id. */
export async function readBundledWorld(id: string): Promise<string> {
  const load = BUNDLED_WORLD_RAW[`../defaultworlds/${id}.json`];
  if (!load) throw new Error(`No bundled JSON for default world "${id}"`);
  return load();
}
