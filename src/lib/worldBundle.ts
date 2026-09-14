/**
 * The bundled content inside an imported world file.
 *
 * A world file carries complete entities and dictionaries in the world's own collections, plus a link
 * record on each copy that followed a source where the file was written. Those records name a library on
 * another machine, so importing resolves each one: restore it, repoint it at a local item, or set it
 * aside as bundled until the player asks for it to be placed in their library.
 *
 * Nothing here reads storage and nothing here writes. The file's content always wins: a copy is never
 * replaced by a library item's version, and a local replacement stays a local replacement.
 */

import { contentMatchesSource, linkToSource, type LibrarySource, type LinkableContent } from '@/lib/linkedContent';
import type { LibraryKind } from '@/lib/librarySources';
import type { LinkedWorldContent } from '@/lib/publishLinks';
import type { ContentLink, Dictionary, Entity } from '@/types';

/** One local library item, as the resolution reads it. `data` is needed only to tell whether the file's
 *  copy still matches the item it is about to follow. */
export interface LocalLibraryItem {
  id: string;
  name: string;
  revision: string;
  sourceId?: string;
  data?: LinkableContent;
}

/** A trimmed string, or null for anything that is not one. */
const text = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/** Every copy in one world, with the library each came from. */
function copies(world: LinkedWorldContent): { item: LinkableContent; kind: LibraryKind }[] {
  return [
    ...(world.entities ?? []).map((item) => ({ item: item as LinkableContent, kind: 'entity' as const })),
    ...(world.dictionaries ?? []).map((item) => ({ item: item as LinkableContent, kind: 'dictionary' as const })),
  ];
}

/** Rewrite both content lists through `revise`, leaving a list the world does not have absent. */
function mapContent<T extends LinkedWorldContent>(
  world: T, revise: <I extends LinkableContent>(item: I) => I,
): T {
  return {
    ...world,
    ...(world.entities ? { entities: world.entities.map((item) => revise<Entity>(item)) } : {}),
    ...(world.dictionaries ? { dictionaries: world.dictionaries.map((item) => revise<Dictionary>(item)) } : {}),
  };
}

/**
 * The published listings an imported world's records name.
 *
 * The caller loads the content of the local items behind these before resolving, so a repointed copy can
 * be told from the item it is about to follow. Nothing else in the library needs reading.
 *
 * @param world - The world as its file was parsed
 * @returns The listing ids named by at least one record, without repeats
 */
export function bundledListingIds(world: LinkedWorldContent): string[] {
  const ids = new Set<string>();
  for (const { item } of copies(world)) {
    const sourceId = text(item.link?.sourceId);
    if (sourceId) ids.add(sourceId);
  }
  return [...ids];
}

/** The record a copy keeps when nothing local answers for it: the identity it arrived with, and the item
 *  it followed remembered as a bundle rather than as a link to something that is not here. */
function asBundled(link: ContentLink): ContentLink {
  const from = text(link.libraryId) ?? text(link.sourceId);
  if (!from) return link;
  const { libraryId: _elsewhere, ...rest } = link;
  return { ...rest, bundledFrom: from };
}

/** The record a copy takes when a local item answers for it. The file's revision is kept, so the copy is
 *  reported behind until the player reviews it: the item here may hold different content entirely. */
function follow(link: ContentLink, item: LocalLibraryItem, differs: boolean): ContentLink {
  return {
    ...link,
    libraryId: item.id,
    ...(item.sourceId ? { sourceId: item.sourceId } : {}),
    sourceName: item.name,
    ...(differs || link.localReplacement ? { localReplacement: true } : {}),
  };
}

/**
 * Resolve every link record an imported world carries against this machine's library.
 *
 * A record whose library item is here is left exactly as it is, which is what makes re-importing a world
 * on the machine that exported it restore its links. A record naming a listing the player already holds
 * is repointed at their own item, and the file's content stays as it is: where it differs from that item
 * the copy becomes a local replacement, so a later review offers the choice rather than making it. Every
 * other record is set aside as bundled content, following nothing until the player asks for it.
 *
 * @param world - The world as its file was parsed
 * @param library - This machine's entity and dictionary items, with content for the ones a record names
 * @returns The world with each record resolved. Content is never changed
 */
export function resolveBundledLinks<T extends LinkedWorldContent>(
  world: T, library: readonly LocalLibraryItem[],
): T {
  const byId = new Map(library.map((item) => [item.id, item]));
  const byListing = new Map(library.flatMap((item) => (item.sourceId ? [[item.sourceId, item] as const] : [])));

  return mapContent(world, (copy) => {
    const link = copy.link;
    if (!link) return copy;
    if (text(link.libraryId) && byId.has(link.libraryId!)) return copy;

    const listing = text(link.sourceId);
    const held = listing ? byListing.get(listing) : undefined;
    if (!held) {
      const bundled = asBundled(link);
      return bundled === link ? copy : { ...copy, link: bundled };
    }
    // Without the item's content the copy cannot be shown to match it, and claiming a match it may not
    // have would hide the player's own version behind a silent update.
    const differs = !held.data || !contentMatchesSource(copy, held.data);
    return { ...copy, link: follow(link, held, differs) };
  });
}

/** One source a world's bundled copies followed where the file was written. */
export interface BundledSource {
  /** The library item this group follows: the exporter's id until the group is placed here, and the
   *  local item's id afterwards. Either way it is what the copies in the group share. */
  bundledFrom: string;
  kind: LibraryKind;
  /** What to call the library item this places, taken from the record or from the copy. */
  name: string;
  /** The copies in this world that belong to the group. */
  itemIds: string[];
  /** The copies already follow a local item, so placing has nothing to do for this group. */
  placed: boolean;
}

/**
 * The bundled sources one world holds, whether or not they are placed.
 *
 * Copies that followed one item share a row: placing writes one library item for the group, so two
 * copies of a source never become two items.
 *
 * @param world - The world as it is stored
 * @returns One row per bundled source, in the order the world's content names them
 */
export function bundledSources(world: LinkedWorldContent): BundledSource[] {
  const rows = new Map<string, BundledSource>();
  for (const { item, kind } of copies(world)) {
    const from = text(item.link?.bundledFrom);
    if (!from) continue;
    const held = rows.get(from);
    if (held) {
      held.itemIds.push(item.id);
      continue;
    }
    rows.set(from, {
      bundledFrom: from,
      kind,
      name: text(item.link?.sourceName) ?? text(item.name) ?? 'Untitled',
      itemIds: [item.id],
      placed: !!text(item.link?.libraryId),
    });
  }
  return [...rows.values()];
}

/** Whether this world's bundled content follows library items. A world with no bundled content has no
 *  choice to offer, which is what `null` says. */
export function bundledContentLinked(world: LinkedWorldContent): boolean | null {
  const rows = bundledSources(world);
  if (!rows.length) return null;
  return rows.every((row) => row.placed);
}

/**
 * The world with its bundled copies following the items just placed for them.
 *
 * The group's id becomes the local item's, so embedding the content again and linking it a second time
 * finds the item already there rather than placing a second copy of it.
 *
 * @param world - The world as it is stored
 * @param placed - The library item placed for each bundled source, by that source's id
 * @returns The world with each matched copy linked. Content is never changed
 */
export function followBundled<T extends LinkedWorldContent>(
  world: T, placed: ReadonlyMap<string, LibrarySource>,
): T {
  if (!placed.size) return world;
  return mapContent(world, (copy) => {
    const from = text(copy.link?.bundledFrom);
    const source = from ? placed.get(from) : undefined;
    if (!source) return copy;
    // The item was written from this copy unless the player already had one, so a difference is real.
    const differs = !!source.data && !contentMatchesSource(copy, source.data);
    // The copy's own record is kept under the new one, so the world references it already connected
    // survive being linked.
    return {
      ...copy,
      link: {
        ...copy.link,
        ...linkToSource(source, differs || !!copy.link?.localReplacement),
        bundledFrom: source.id,
      },
    };
  });
}

/**
 * The world with its bundled copies embedded: following nothing, and holding exactly what they hold.
 *
 * The bundle is still remembered, so the choice can be made again without the content being placed twice.
 *
 * @param world - The world as it is stored
 * @returns The world with every bundled copy unlinked
 */
export function embedBundled<T extends LinkedWorldContent>(world: T): T {
  return mapContent(world, (copy) => {
    const from = text(copy.link?.bundledFrom);
    if (!from || !copy.link?.libraryId) return copy;
    const { libraryId: _released, sourceRevision: _held, reviewedRevision: _reviewed, ...rest } = copy.link;
    return { ...copy, link: { ...rest, bundledFrom: from } };
  });
}
