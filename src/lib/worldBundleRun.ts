/**
 * Running an imported world's bundled content against this machine's library.
 *
 * Reading resolves each link record the file carries. Placing writes one library item per bundled source
 * and points the world's copies at it. Both leave the world's own content exactly as the file wrote it.
 */

import { allPlaceholders } from '@/lib/placeholderHomes';
import {
  libraryItemData, libraryItems, saveCopyToLibrary, type LibraryKind,
} from '@/lib/librarySources';
import type { LibrarySource, LinkableContent } from '@/lib/linkedContent';
import {
  bundledListingIds, bundledSources, followBundled, resolveBundledLinks,
  type LocalLibraryItem,
} from '@/lib/worldBundle';
import type { Dictionary, Entity, GameLocation, Placeholder } from '@/types';

/** The slices of a world this pass reads and rewrites. A stored record's `data` satisfies it. */
export interface BundleWorld {
  entities?: Entity[];
  dictionaries?: Dictionary[];
  placeholders?: Placeholder[];
  locations?: GameLocation[];
}

/**
 * This machine's library, as the resolution reads it.
 *
 * Content is loaded only for the items a record could repoint to — the ones published as a listing the
 * file names — because that is the only decision the content is needed for.
 *
 * @param world - The world as its file was parsed
 * @returns Every library item, with content on the ones the world's records name
 */
export async function localLibraryFor(world: BundleWorld): Promise<LocalLibraryItem[]> {
  const named = new Set(bundledListingIds(world));
  const [entities, dictionaries] = await Promise.all([libraryItems('entity'), libraryItems('dictionary')]);
  return Promise.all([...entities, ...dictionaries].map(async (item) => ({
    id: item.id,
    name: item.name,
    revision: item.revision,
    ...(item.sourceId ? { sourceId: item.sourceId } : {}),
    ...(item.sourceId && named.has(item.sourceId)
      ? { data: (await libraryItemData(item.kind, item.id)) ?? undefined }
      : {}),
  })));
}

/**
 * The imported world with every link record resolved against this machine's library.
 *
 * A library that cannot be read leaves every record bundled, which is the same answer an import on a
 * machine with an empty library gives: the content is there and follows nothing yet.
 *
 * @param world - The world as its file was parsed
 * @returns The world with its records resolved
 */
export async function resolveImportedWorld<T extends BundleWorld>(world: T): Promise<T> {
  try {
    return resolveBundledLinks(world, await localLibraryFor(world));
  } catch (error) {
    console.error('Could not read the library to resolve this world\'s links:', error);
    return resolveBundledLinks(world, []);
  }
}

/** The first copy of one bundled group, which is the content its library item is written from. */
function groupContent(world: BundleWorld, kind: LibraryKind, itemIds: readonly string[]): LinkableContent | null {
  const list: LinkableContent[] = kind === 'dictionary' ? world.dictionaries ?? [] : world.entities ?? [];
  return list.find((item) => itemIds.includes(item.id)) ?? null;
}

/**
 * Place this world's bundled content in the library and point its copies at what was placed.
 *
 * A group whose item is already here follows that item rather than placing a second copy of it, which is
 * what makes embedding the content and linking it again land back on the same item. The world's copies
 * keep their own content: linking is a relationship, never an update.
 *
 * @param world - The world as it is stored
 * @returns The world with its bundled copies linked, and how many library items the pass placed
 */
export async function linkBundledContent<T extends BundleWorld>(
  world: T,
): Promise<{ world: T; placed: number }> {
  const groups = bundledSources(world).filter((group) => !group.placed);
  if (!groups.length) return { world, placed: 0 };

  const available = allPlaceholders(world);
  const placed = new Map<string, LibrarySource>();
  let created = 0;

  for (const group of groups) {
    const held = (await libraryItems(group.kind)).find((row) => row.id === group.bundledFrom);
    if (held) {
      placed.set(group.bundledFrom, { ...held, data: (await libraryItemData(group.kind, held.id)) ?? undefined });
      continue;
    }
    const content = groupContent(world, group.kind, group.itemIds);
    if (!content) continue;
    placed.set(group.bundledFrom, await saveCopyToLibrary(content, available, world.locations ?? []));
    created += 1;
  }

  return { world: followBundled(world, placed), placed: created };
}
