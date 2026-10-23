import { assetHash, loadLibraryVrms } from '@/lib/libraryVrm';
import { withVrmPick } from '@/lib/worldVrmStore';
import ModelStorageService from '@/services/ModelStorageService';
import type { Entity, MediaAsset, VrmPick, WorldVrmStore } from '@/types';

/** The Avatar a character card or entity listing carries for its entity's pick. */
export interface CarriedVrm {
  name: string;
  file: MediaAsset;
  hash: string;
}

/** An entity as a shared file holds it: the pick, plus the picked Avatar's file. */
export type PortableEntity = Entity & { vrm?: CarriedVrm };

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The Avatar a file carries. Only an embedded file counts, so an import never fetches from a host the file names. */
export function readCarriedVrm(raw: unknown): CarriedVrm | undefined {
  if (!isRecord(raw) || !isRecord(raw.file) || typeof raw.file.data !== 'string' || !raw.file.data.startsWith('data:')) return undefined;
  // `data` is checked above; the other MediaAsset fields are optional strings the library import reads loosely.
  const file = raw.file as unknown as MediaAsset;
  return {
    name: typeof raw.name === 'string' && raw.name ? raw.name : 'Avatar',
    file,
    hash: typeof raw.hash === 'string' ? raw.hash : '',
  };
}

const withoutVrm = <T extends PortableEntity>(entity: T, pick: VrmPick | undefined): T => {
  const { vrm: _vrm, ...rest } = entity;
  // `vrm` is optional on T, so T without it is still a T.
  return withVrmPick(rest as T, pick);
};

/**
 * The entity ready to share: a library or world pick carries its Avatar's file in `vrm`. A pick whose Avatar
 * can't be found exports as none; User's Default exports as it is. An embedded Avatar, such as downloaded listing
 * content, goes out only when the pick names that same file or nothing on this device.
 */
export async function withCarriedVrm<T extends PortableEntity>(entity: T, store?: WorldVrmStore): Promise<T> {
  const pick = entity.vrmPick;
  if (pick?.kind !== 'library' && pick?.kind !== 'world') return withoutVrm(entity, pick);
  const picked = await resolvePick(pick, store);
  const held = readCarriedVrm(entity.vrm);
  if (held) {
    const hash = held.hash || await assetHash(held.file);
    if (!picked || picked.hash === hash) return { ...entity, vrm: { ...held, hash } };
  }
  return picked ? { ...entity, vrm: picked } : withoutVrm(entity, undefined);
}

/** The Avatar a library or world pick names on this device, if it still exists. */
async function resolvePick(pick: Extract<VrmPick, { kind: 'library' | 'world' }>, store?: WorldVrmStore): Promise<CarriedVrm | undefined> {
  if (pick.kind === 'library') return (await loadLibraryVrms([pick.id])).get(pick.id);
  const entry = store?.[pick.id];
  return entry && { name: entry.name, file: entry.file, hash: entry.hash ?? await assetHash(entry.file) };
}

/**
 * A shared entity as the library keeps it: a carried Avatar joins the Avatar library, reusing a record with the
 * same content, and the pick names that record. User's Default stays, and so does a library pick this library
 * holds, so adopting twice changes nothing. Any other pick becomes none.
 */
export async function adoptCarriedVrm<T extends Entity>(entity: Omit<T, 'vrmPick'> & { vrmPick?: unknown; vrm?: unknown }): Promise<T> {
  const { vrm, vrmPick, ...rest } = entity;
  const carried = readCarriedVrm(vrm);
  let pick: VrmPick | undefined;
  if (carried) {
    const blob = await (await fetch(carried.file.data)).blob();
    pick = { kind: 'library', id: await ModelStorageService.importModelBlob(blob, carried.file.name || `${carried.name}.vrm`) };
  } else if (isRecord(vrmPick) && vrmPick.kind === 'default') {
    pick = { kind: 'default' };
  } else if (isRecord(vrmPick) && vrmPick.kind === 'library' && typeof vrmPick.id === 'string'
    && (await ModelStorageService.getModelMetadata()).some((model) => model.id === vrmPick.id)) {
    pick = { kind: 'library', id: vrmPick.id };
  }
  // `rest` is T without the two fields read here.
  return (pick ? { ...rest, vrmPick: pick } : rest) as unknown as T;
}

/** Listing content as the library keeps it: an entity's carried Avatar adopted, anything else as it is. */
export const adoptListingVrm = async <T extends object>(kind: string, content: T): Promise<T> =>
  // An entity listing's content is an Entity.
  (kind === 'entity' ? await adoptCarriedVrm(content as unknown as Entity) as unknown as T : content);
