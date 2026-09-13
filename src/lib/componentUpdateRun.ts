/**
 * Running a component update review against the worlds that hold copies.
 *
 * Reading finds the copies a library item has left behind. Applying rewrites one world at a time, so a
 * world that fails keeps the content it had while the rest of the batch stands.
 */

import {
  applyLibraryUpdate, unlink, type LibrarySource, type LinkableContent,
} from '@/lib/linkedContent';
import { markReviewed, needsReview, type UpdateAction, type UpdateRow } from '@/lib/componentUpdates';
import { contentLinkState } from '@/lib/contentLink';
import type { LibraryKind } from '@/lib/librarySources';
import WorldStorageService from '@/services/WorldStorageService';
import type { ContentLink, Dictionary, Entity, Placeholder } from '@/types';

/**
 * A world whose content is held in memory rather than in storage.
 *
 * The editor's open world is one: it may carry links the last save did not, so its copies are read from
 * here and written back through it, and the world save is what commits them. A review is given every such
 * world it might name, and reaches storage for the rest.
 */
export interface LiveWorld {
  id: string;
  name: string;
  entities: Entity[];
  dictionaries: Dictionary[];
  /** The world's shared list, which updated content resolves its references against. */
  placeholders: Placeholder[];
  writeItem: (item: LinkableContent) => void;
  addPlaceholder: (placeholder: Placeholder) => void;
}

/** The copies one world holds, with the kind each came from. */
function liveCopies(live: LiveWorld): { item: LinkableContent; kind: LibraryKind }[] {
  return [
    ...live.entities.map((item) => ({ item: item as LinkableContent, kind: 'entity' as const })),
    ...live.dictionaries.map((item) => ({ item: item as LinkableContent, kind: 'dictionary' as const })),
  ];
}

/** One copy found in a world, before the review decides whether it has anything to answer for. */
interface Candidate {
  worldId: string;
  worldName: string;
  itemId: string;
  itemName: string;
  kind: LibraryKind;
  link: ContentLink | undefined;
}

/**
 * The row a candidate becomes, or null where it has nothing to review.
 *
 * A copy whose record identifies nothing is skipped: there is no state to show it in and nothing an
 * action could do to it.
 */
function toRow({ link, ...held }: Candidate, source: LibrarySource): UpdateRow | null {
  const state = contentLinkState(link);
  if (!state || link?.libraryId !== source.id) return null;
  return needsReview(link, source.revision) ? { ...held, state } : null;
}

/** Every copy of `source` that is behind it, the in-memory worlds first. */
export async function affectedCopies(source: LibrarySource, live: LiveWorld[] = []): Promise<UpdateRow[]> {
  const inMemory: Candidate[] = live.flatMap((world) => liveCopies(world).map(({ item, kind }) => ({
    worldId: world.id, worldName: world.name, itemId: item.id, itemName: item.name, kind, link: item.link,
  })));
  const held = new Set(live.map((world) => world.id));
  const stored = (await WorldStorageService.linkedCopies(source.id))
    .filter((copy) => !held.has(copy.worldId));

  return [...inMemory, ...stored]
    .map((candidate) => toRow(candidate, source))
    .filter((row): row is UpdateRow => !!row);
}

/** The in-memory world one row names, where the review was given it. */
export function liveWorldFor(live: LiveWorld[] | undefined, row: UpdateRow): LiveWorld | undefined {
  return live?.find((world) => world.id === row.worldId);
}

/** The copy one row names, from an in-memory world. */
export function liveCopyFor(world: LiveWorld, row: UpdateRow): LinkableContent | undefined {
  return liveCopies(world).find(({ item }) => item.id === row.itemId)?.item;
}

/**
 * The copy after `action`, with whatever the world gains for references the source newly introduced.
 *
 * `sourceData` is only read by Update; the other two actions rewrite the record and leave the content
 * exactly where it is.
 */
function revisedCopy(
  copy: LinkableContent,
  action: UpdateAction,
  source: LibrarySource,
  sourceData: LinkableContent | null,
  worldShared: readonly Placeholder[],
): { item: LinkableContent; toAdd: Placeholder[] } {
  if (action === 'keep') return { item: markReviewed(copy, source.revision), toAdd: [] };
  if (action === 'unlink') return { item: unlink(copy), toAdd: [] };
  if (!sourceData) throw new Error(`"${source.name}" is no longer in your library.`);
  return applyLibraryUpdate(copy, sourceData, source, worldShared);
}

/**
 * Apply one row's action to the world it names.
 *
 * Throws when the world, the copy, or the source content is gone, so the caller can keep that world's
 * content as it stands and offer Retry.
 */
export async function applyUpdate(
  row: UpdateRow,
  action: UpdateAction,
  source: LibrarySource,
  sourceData: LinkableContent | null,
  live?: LiveWorld[],
): Promise<void> {
  const world = liveWorldFor(live, row);
  if (world) {
    const copy = liveCopyFor(world, row);
    if (!copy) throw new Error(`"${row.itemName}" is no longer in ${row.worldName}.`);
    const revised = revisedCopy(copy, action, source, sourceData, world.placeholders);
    world.writeItem(revised.item);
    revised.toAdd.forEach(world.addPlaceholder);
    return;
  }

  await WorldStorageService.updateWorldContent(row.worldId, (data) => {
    const listKey = row.kind === 'dictionary' ? 'dictionaries' : 'entities';
    const list = (data[listKey] ?? []) as LinkableContent[];
    const index = list.findIndex((item) => item.id === row.itemId);
    if (index < 0) throw new Error(`"${row.itemName}" is no longer in ${row.worldName}.`);
    const shared = (data.placeholders ?? []) as Placeholder[];
    const revised = revisedCopy(list[index], action, source, sourceData, shared);
    const next = [...list];
    next[index] = revised.item;
    return {
      ...data,
      [listKey]: next,
      ...(revised.toAdd.length ? { placeholders: [...shared, ...revised.toAdd] } : {}),
    };
  });
}
