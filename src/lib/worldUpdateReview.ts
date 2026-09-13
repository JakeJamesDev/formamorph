/**
 * The review a world update opens before it replaces an installed copy.
 *
 * Updating a world in place fetches the author's new content and writes it over the copy the player has.
 * This module is what stands between those two things: it says which linked components the write would
 * move, which sources the world has started requiring, and which it has stopped, and it rewrites the
 * incoming content so every copy the player protected survives the write.
 *
 * Nothing here reads the network or storage. The coordinator supplies the two sides and applies the answer.
 */

import { defaultAction, needsReview, type UpdateAction } from '@/lib/componentUpdates';
import { contentLinkState, type ContentLinkState } from '@/lib/contentLink';
import { getDownloadState } from '@/lib/downloadState';
import { chipTexts, unlink, type LinkableContent } from '@/lib/linkedContent';
import { allPlaceholders, sharedPlaceholdersUsed } from '@/lib/placeholderHomes';
import { componentKind, type DependencyRow, type InstalledSource } from '@/lib/worldDependencies';
import type { LibraryKind } from '@/lib/librarySources';
import type { ContentLink, Dictionary, Entity, EntityGroup, GameLocation, Placeholder } from '@/types';

/** What one row of the review is about. */
export type WorldUpdateRowKind =
  /** The world holds a copy the update would move. */
  | 'changed'
  /** The world has started requiring a source it holds no copy of. */
  | 'added'
  /** The world holds a copy of a source it no longer requires. */
  | 'dropped';

/** One consequence of updating the installed copy in place. */
export interface WorldUpdateRow {
  /** The listing the component follows. The row's identity: the world's own item ids are replaced by the
   *  update, and the listing id is what survives it. */
  sourceId: string;
  name: string;
  rowKind: WorldUpdateRowKind;
  /** Which library the component belongs in. */
  library?: LibraryKind;
  /** The copy's state, where the world already holds one. */
  state?: ContentLinkState;
  /** The copy in the installed world. */
  itemId?: string;
  /** The server could not resolve this source, so Apply cannot install it. */
  unavailable?: boolean;
}

/**
 * One library item, as the comparison reads it. A `LibraryItemSummary` is one already, so the caller hands
 * its library straight over: an item with no listing behind it answers for no required source and is
 * skipped here rather than filtered at every call site.
 */
export interface HeldSource {
  /** The listing the item was downloaded from, where it came from one. */
  sourceId?: string;
  /** The item's revision, so a copy left behind by a library update is listed. */
  revision: string;
  /** The listing version the item holds, against the listing's own. */
  sourceUpdatedAt?: string;
}

/** The slices of a world a linked copy lives in. A caller hands in a whole world; these are the parts read
 *  and rewritten. */
export interface WorldContentSlices {
  entities?: Entity[];
  dictionaries?: Dictionary[];
  placeholders?: Placeholder[];
  entityGroups?: EntityGroup[];
  locations?: GameLocation[];
}

/** Every copy in one world, with the library each came from. */
function worldCopies(world: WorldContentSlices): { item: LinkableContent; kind: LibraryKind }[] {
  return [
    ...(world.entities ?? []).map((item) => ({ item, kind: 'entity' as const })),
    ...(world.dictionaries ?? []).map((item) => ({ item, kind: 'dictionary' as const })),
  ];
}

/**
 * Whether the update would move this copy.
 *
 * A local replacement always would: the write replaces it with the author's version, which is exactly the
 * edit the player is owed a say over. Otherwise the source has to have moved — the author republished the
 * listing, or the library item the copy follows has run ahead of it. A copy whose library item is gone
 * moves too, because the update installs the source again.
 */
function updateWouldMove(
  dependency: DependencyRow, held: HeldSource | undefined, link: ContentLink | undefined,
): boolean {
  if (link?.localReplacement) return true;
  if (!held) return true;
  if (getDownloadState(dependency.listing?.updated_at, [held]) === 'update') return true;
  return needsReview(link, held.revision);
}

/**
 * Everything updating this world in place would do to its linked components.
 *
 * A copy that follows a library item and no listing is left out: the world's required set speaks for
 * listings, and nothing in this update can move a source it cannot name.
 *
 * @param world - The installed copy's content, as it stands
 * @param dependencies - What the listing requires now, as the server resolves it
 * @param held - The library items behind those sources
 * @returns One row per consequence, the world's own copies first
 */
export function buildWorldUpdateReview(
  world: WorldContentSlices, dependencies: readonly DependencyRow[], held: readonly HeldSource[],
): WorldUpdateRow[] {
  const required = new Map(dependencies.map((row) => [row.id, row]));
  const heldById = new Map(held.flatMap((source) => (source.sourceId ? [[source.sourceId, source]] as const : [])));
  const rows: WorldUpdateRow[] = [];
  const seen = new Set<string>();

  for (const { item, kind } of worldCopies(world)) {
    const sourceId = item.link?.sourceId;
    const state = contentLinkState(item.link);
    if (!sourceId || !state) continue;
    seen.add(sourceId);
    const dependency = required.get(sourceId);
    const base = {
      sourceId,
      name: item.link?.sourceName?.trim() || dependency?.listing?.name || item.name,
      library: kind,
      state,
      itemId: item.id,
    };
    if (!dependency) rows.push({ ...base, rowKind: 'dropped' });
    else if (updateWouldMove(dependency, heldById.get(sourceId), item.link)) {
      rows.push({ ...base, rowKind: 'changed' });
    }
  }

  for (const dependency of dependencies) {
    if (seen.has(dependency.id)) continue;
    const listing = dependency.listing;
    const library = listing ? componentKind(listing) : null;
    // A source the server could not resolve is still something the world has started requiring. Leaving it
    // out would promise a review of the new required set and then withhold the one row that fails.
    const unavailable = dependency.status !== 'ok' || !listing;
    rows.push({
      sourceId: dependency.id,
      name: listing?.name || 'This source',
      rowKind: 'added',
      ...(library ? { library } : {}),
      ...(unavailable ? { unavailable: true } : {}),
    });
  }

  return rows;
}

/** The action a row starts on. Only a changed row offers a choice; the other two describe what the update
 *  does, and their action is what it does. */
export function defaultWorldUpdateAction(row: WorldUpdateRow): UpdateAction {
  if (row.rowKind === 'dropped') return 'unlink';
  if (row.rowKind === 'added') return 'update';
  return defaultAction(row.state ?? 'linked');
}

/** One component the update must not overwrite, and what happens to its record instead. */
export interface ProtectedCopy {
  sourceId: string;
  action: 'keep' | 'unlink';
  /** Where the run put the source in the library. Keep Mine rewrites the copy's record from it, so a copy
   *  still follows the item even when the library stored it under a fresh id. */
  installed?: InstalledSource;
  /** The world no longer requires this source, so the author may have embedded their copy of it with no
   *  record at all. Only such a copy is matched by name, because only such a copy has nothing else to
   *  match on. A source still required always publishes a copy naming it. */
  embedded?: boolean;
}

/** The protected copy's record after the player's answer. Keep Mine records the revision they declined, so
 *  the same one does not come back; Unlink clears the record and leaves the content alone. */
function reviseCopy<T extends LinkableContent>(copy: T, chosen: ProtectedCopy): T {
  if (chosen.action === 'unlink') return unlink(copy);
  const installed = chosen.installed;
  const link: ContentLink = {
    ...copy.link,
    ...(installed
      ? { libraryId: installed.libraryId, sourceName: installed.name, reviewedRevision: installed.revision }
      : {}),
  };
  return { ...copy, link };
}

/** The copy with references the new world does not have removed, so nothing points at a folder or a place
 *  the author deleted. A book carries neither, so it comes back untouched. */
function settleInWorld(copy: Entity, groups: ReadonlySet<string>, locations: ReadonlySet<string>): Entity {
  const settled = { ...copy };
  if (settled.groupId && !groups.has(settled.groupId)) delete settled.groupId;
  if (settled.locations) settled.locations = settled.locations.filter((id) => locations.has(id));
  return settled;
}

/** Put `kept` where the incoming list already holds this component: the copy following the same listing,
 *  else, for a dropped requirement alone, the copy the author embedded under the same name. A list holding
 *  neither gains it, so content the author removed outright is not lost. */
function placeCopy<T extends LinkableContent>(list: T[], chosen: ProtectedCopy, kept: T): void {
  const linked = list.findIndex((item) => item.link?.sourceId === chosen.sourceId);
  const called = kept.name?.trim().toLowerCase();
  const at = linked >= 0 || !chosen.embedded
    ? linked
    : list.findIndex((item) => !item.link?.sourceId && item.name?.trim().toLowerCase() === called);
  if (at < 0) list.push(kept);
  else list[at] = kept;
}

/**
 * The components an update must not write over, from what the player answered.
 *
 * A source the run could not install protects its copy whatever the player chose: the author's version is
 * not there to take, so the copy keeps the content it already has and the failure is reported instead.
 *
 * @param rows - The review's rows, which say which sources the world has stopped requiring
 * @param actions - The player's answer per listing, defaulting to each row's own
 * @param installed - The sources this run placed in the library
 * @returns One entry per copy to protect
 */
export function protectedCopies(
  rows: readonly WorldUpdateRow[],
  actions: Readonly<Record<string, UpdateAction>>,
  installed: readonly InstalledSource[],
): ProtectedCopy[] {
  const landed = new Map(installed.map((source) => [source.sourceId, source]));
  return rows.flatMap((row) => {
    const action = actions[row.sourceId] ?? defaultWorldUpdateAction(row);
    const source = landed.get(row.sourceId);
    if (action === 'update' && source) return [];
    const held = {
      sourceId: row.sourceId,
      action: action === 'unlink' ? ('unlink' as const) : ('keep' as const),
      ...(source ? { installed: source } : {}),
      ...(row.rowKind === 'dropped' ? { embedded: true } : {}),
    };
    return [held];
  });
}

/**
 * The author's new world with every protected copy standing in for the version it publishes.
 *
 * The player's copy goes in whole — its own id, its own placeholders, its own content — because what the
 * review promised is that it survives unchanged. A shared placeholder its chips reach that the new world
 * lacks is carried across under the same id, so those chips still resolve. A copy the author removed from
 * the world outright is put back rather than dropped: the row said the content is kept.
 *
 * @param incoming - The world content the update downloaded
 * @param previous - The installed copy's content, before the update
 * @param protectedCopies - The components the review protects, by listing
 * @returns The content to store
 */
export function keepInstalledCopies<T extends WorldContentSlices>(
  incoming: T, previous: WorldContentSlices, protect: readonly ProtectedCopy[],
): T {
  if (!protect.length) return incoming;

  const pool = allPlaceholders(previous);
  const groups = new Set((incoming.entityGroups ?? []).map((group) => group.id));
  const locations = new Set((incoming.locations ?? []).map((location) => location.id));
  const priorCopies = worldCopies(previous);

  const entities = [...(incoming.entities ?? [])];
  const dictionaries = [...(incoming.dictionaries ?? [])];
  const shared = [...(incoming.placeholders ?? [])];
  const sharedIds = new Set(shared.map((placeholder) => placeholder.id));

  for (const chosen of protect) {
    const prior = priorCopies.find(({ item }) => item.link?.sourceId === chosen.sourceId);
    if (!prior) continue;
    const revised = reviseCopy(prior.item, chosen);
    const kept = 'entries' in revised ? revised : settleInWorld(revised, groups, locations);

    for (const placeholder of sharedPlaceholdersUsed(chipTexts(kept), kept.placeholders ?? [], pool)) {
      if (sharedIds.has(placeholder.id)) continue;
      sharedIds.add(placeholder.id);
      shared.push(placeholder);
    }

    if ('entries' in kept) placeCopy(dictionaries, chosen, kept);
    else placeCopy(entities, chosen, kept);
  }

  return {
    ...incoming,
    entities,
    dictionaries,
    ...(shared.length ? { placeholders: shared } : {}),
  };
}
