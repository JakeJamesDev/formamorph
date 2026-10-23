import { addWorldVrm, withVrmPick } from '@/lib/worldVrmStore';
import type { Entity, MediaAsset, VrmPick, WorldVrmStore as Store } from '@/types';

/** One Avatar as the comparisons name and match it. */
export interface NamedHash {
  name: string;
  hash: string;
}

/** What a pick comparison reads: one world's store and the player's Avatar library, by id. */
export interface VrmLookup {
  world: ReadonlyMap<string, NamedHash>;
  library: ReadonlyMap<string, NamedHash>;
}

/**
 * A pick as a comparable value. None and User's Default compare as they are; a world or library Avatar compares by
 * its content, so a world copy and its library item match when they show the same file. A store id the store
 * lacks is none, as the resolver reads it. Any other pick the lookup can't hash matches only itself.
 */
export function pickToken(pick: VrmPick | undefined, lookup: VrmLookup): string | undefined {
  if (!pick) return undefined;
  if (pick.kind === 'default') return 'default';
  const named = lookup[pick.kind].get(pick.id);
  if (named) return `avatar:${named.hash}`;
  return pick.kind === 'world' && !lookup.world.has(pick.id) ? undefined : `${pick.kind}:${pick.id}`;
}

/** How a library pick this device lacks reads. */
export const MISSING_AVATAR = 'Missing Avatar';

/** A pick as a reader names it. */
export function pickLabel(pick: VrmPick | undefined, lookup: VrmLookup): string {
  if (!pick) return 'None';
  if (pick.kind === 'default') return "User's Default";
  return lookup[pick.kind].get(pick.id)?.name || (pick.kind === 'world' ? 'None' : MISSING_AVATAR);
}

/** A library Avatar ready to embed in a world. */
export interface LibraryVrm {
  name: string;
  hash: string;
  file: MediaAsset;
}

/** The library ids the entities pick. */
export const libraryPickIds = (entities: readonly Entity[]): string[] =>
  entities.flatMap((entity) => (entity.vrmPick?.kind === 'library' ? [entity.vrmPick.id] : []));

/**
 * The entities with each library pick placed in the world store. A store entry with the same content is reused;
 * otherwise the Avatar is embedded once under its library name. A library id `vrms` lacks becomes none.
 * Entities without a library pick keep their identity.
 *
 * `hashes` holds the store's hashes for entries that carry none.
 */
export function placeLibraryPicks<T extends Entity>(
  entities: readonly T[], store: Store | undefined, hashes: ReadonlyMap<string, string>, vrms: ReadonlyMap<string, LibraryVrm>,
): { entities: T[]; store: Store | undefined } {
  let next = store;
  const placed = entities.map((entity) => {
    const pick = entity.vrmPick;
    if (pick?.kind !== 'library') return entity;
    const vrm = vrms.get(pick.id);
    if (!vrm) return withVrmPick(entity);
    const held = Object.entries(next ?? {}).find(([id, entry]) => (entry.hash ?? hashes.get(id)) === vrm.hash);
    if (held) return { ...entity, vrmPick: { kind: 'world', id: held[0] } };
    const added = addWorldVrm(next, vrm.name, vrm.file, vrm.hash);
    next = added.store;
    return { ...entity, vrmPick: { kind: 'world', id: added.id } };
  });
  return { entities: placed, store: next };
}

