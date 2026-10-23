import { blobHash } from '@/lib/blobHash';
import { blobToDataUrl } from '@/lib/imageSource';
import { withVrmPick } from '@/lib/worldVrmStore';
import { libraryPickIds, placeLibraryPicks, type LibraryVrm, type NamedHash, type VrmLookup } from '@/lib/vrmPickMatch';
import ModelStorageService from '@/services/ModelStorageService';
import type { Entity, MediaAsset, VrmLicense, VrmPick, WorldVrmStore as Store } from '@/types';

/** A library Avatar's file name: its display name, with the extension its format calls for. */
export const libraryFileName = (name: string, license: VrmLicense | undefined) =>
  `${name}.${license?.metaVersion === null ? 'glb' : 'vrm'}`;

const fileBlob = async (file: MediaAsset): Promise<Blob> => (await fetch(file.data)).blob();

const assetHashes = new WeakMap<MediaAsset, Promise<string>>();

/** A store file's content hash, computed the way the Avatar library computes its own. Cached per file. */
export function assetHash(file: MediaAsset): Promise<string> {
  let hash = assetHashes.get(file);
  if (!hash) {
    hash = fileBlob(file).then(blobHash);
    hash.catch(() => assetHashes.delete(file));
    assetHashes.set(file, hash);
  }
  return hash;
}

/** Each store entry's content hash by id. An entry without a stored hash is hashed now. */
export async function storeHashes(store: Store | undefined): Promise<Map<string, string>> {
  const entries = await Promise.all(Object.entries(store ?? {}).map(async ([id, vrm]) => (
    [id, vrm.hash ?? await assetHash(vrm.file)] as const
  )));
  return new Map(entries);
}

/** The lookup for a world's store. A side that can't be read is empty, so its picks match only themselves. */
export async function loadVrmLookup(store: Store | undefined): Promise<VrmLookup> {
  const [hashes, library] = await Promise.all([
    storeHashes(store).catch(() => new Map<string, string>()),
    ModelStorageService.getModelHashes().catch(() => new Map<string, NamedHash>()),
  ]);
  const world = new Map(Object.entries(store ?? {}).flatMap(([id, vrm]) => {
    const hash = hashes.get(id);
    return hash ? [[id, { name: vrm.name, hash }] as const] : [];
  }));
  return { world, library };
}

/** The library Avatars `ids` name, read for embedding. An id the library no longer holds is absent. */
export async function loadLibraryVrms(ids: Iterable<string>): Promise<Map<string, LibraryVrm>> {
  const wanted = [...new Set(ids)];
  if (!wanted.length) return new Map();
  const library = await ModelStorageService.getModelHashes();
  const read = await Promise.all(wanted.flatMap((id) => {
    const named = library.get(id);
    return named ? [{ id, ...named }] : [];
  }).map(async ({ id, name, hash }) => {
    const { blob, type, license } = await ModelStorageService.getModelData(id);
    const file: MediaAsset = { data: await blobToDataUrl(blob), type: type || 'model/vrm', name: libraryFileName(name, license), size: blob.size };
    return [id, { name, hash, file }] as const;
  }));
  return new Map(read);
}

/** Place the library picks of `entities` in `store`, reading what that needs. */
export async function embedLibraryPicks<T extends Entity>(
  entities: readonly T[], store: Store | undefined,
): Promise<{ entities: T[]; store: Store | undefined }> {
  const ids = libraryPickIds(entities);
  if (!ids.length) return { entities: [...entities], store };
  const [hashes, vrms] = await Promise.all([storeHashes(store), loadLibraryVrms(ids)]);
  return placeLibraryPicks(entities, store, hashes, vrms);
}

/**
 * `pick` in library form. A world Avatar becomes the library record with the same content, imported into the
 * library when it holds none. A store id the store lacks becomes none; other picks stay as they are.
 */
export async function toLibraryPick(pick: VrmPick | undefined, store: Store | undefined): Promise<VrmPick | undefined> {
  if (pick?.kind !== 'world') return pick;
  const entry = store?.[pick.id];
  if (!entry) return undefined;
  const id = await ModelStorageService.importModelBlob(await fileBlob(entry.file), entry.file.name || libraryFileName(entry.name, undefined));
  return { kind: 'library', id };
}

/** The entity with its pick in library form; anything else as it is. */
export async function withLibraryPick<T extends object>(item: T, store: Store | undefined): Promise<T> {
  // A dictionary has no pick, so it reads as one with the pick absent.
  const pick = (item as Partial<Entity>).vrmPick;
  if (pick?.kind !== 'world') return item;
  const next = await toLibraryPick(pick, store);
  return withVrmPick(item as T & Pick<Entity, 'vrmPick'>, next);
}
