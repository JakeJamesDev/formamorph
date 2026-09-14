/**
 * Gathering the relationship metadata a component export writes.
 *
 * Split from the file shape itself so the shape stays readable without reaching storage: the parsers run
 * wherever a file is read, and this runs only where one is written.
 */

import {
  sourceFromLink, type ComponentFileLinks,
} from '@/lib/componentFileLinks';
import type { WorldAssociation } from '@/lib/compatibleWorlds';
import { libraryItems, type LibraryKind } from '@/lib/librarySources';
import WorldStorageService from '@/services/WorldStorageService';
import type { ContentLink } from '@/types';

/**
 * The worlds a library item's copies would be offered for.
 *
 * A world is named by its listing, never by the local copy: an association has to mean something on
 * another machine. A world holding a copy but carrying no listing is left out for the same reason.
 *
 * @param libraryId - The library item the world copies follow
 * @returns One row per published world holding a copy, in storage order
 */
export async function associatedWorlds(libraryId: string): Promise<WorldAssociation[]> {
  if (!libraryId) return [];
  try {
    const [copies, worlds] = await Promise.all([
      WorldStorageService.linkedCopies(libraryId),
      WorldStorageService.getWorldMetadata(),
    ]);
    const listings = new Map(worlds.map((world) => [world.id, world]));
    const rows = new Map<string, WorldAssociation>();
    for (const copy of copies) {
      const listing = listings.get(copy.worldId);
      const id = listing?.sourceId?.trim();
      if (!id || rows.has(id)) continue;
      rows.set(id, { id, name: listing?.name || copy.worldName || 'Untitled world' });
    }
    return [...rows.values()];
  } catch (error) {
    // An unreadable library says nothing about compatibility, and an export is not worth failing over it.
    console.error('Could not read which worlds hold this component:', error);
    return [];
  }
}

/**
 * The relationship metadata to write into a world copy's file.
 *
 * @param link - The exported copy's own record, where it has one
 * @returns The blocks to spread onto the file, each absent where there is nothing to say
 */
export async function exportedComponentLinks(
  link: ContentLink | undefined | null,
): Promise<ComponentFileLinks> {
  const source = sourceFromLink(link);
  const associations = link?.libraryId ? await associatedWorlds(link.libraryId) : [];
  return { ...(source ? { source } : {}), ...(associations.length ? { associations } : {}) };
}

/**
 * The relationship metadata to write into a library item's own file.
 *
 * The item is its own source here, so the file names the item, the listing behind it, and the revision
 * it stands at. An item that is gone by the time this runs contributes nothing rather than failing the
 * export.
 *
 * @param kind - Which library the item is in
 * @param id - The library record's id
 * @returns The blocks to spread onto the file
 */
export async function exportedLibraryLinks(kind: LibraryKind, id: string): Promise<ComponentFileLinks> {
  if (!id) return {};
  const item = (await libraryItems(kind).catch(() => [])).find((row) => row.id === id);
  if (!item) return {};
  return exportedComponentLinks({
    libraryId: item.id,
    ...(item.sourceId ? { sourceId: item.sourceId } : {}),
    sourceName: item.name,
    ...(item.revision ? { sourceRevision: item.revision } : {}),
  });
}
