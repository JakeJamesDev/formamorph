/**
 * Reading an imported component file against what this machine already has.
 *
 * A component file names the worlds it suits and the source it came from. Neither creates anything on
 * its own: the rows below are what the import review offers, and the player chooses.
 */

import type { WorldAssociation } from '@/lib/compatibleWorlds';
import type { ComponentFileSource } from '@/lib/componentFileLinks';
import type { LibraryItemSummary } from '@/lib/librarySources';

/** One world a component file is offered for, and where that world stands here. */
export interface AssociationRow {
  /** The world's listing, which is how the file names it. */
  listingId: string;
  name: string;
  /** The local world holding that listing, where this machine has one. */
  worldId?: string;
  /** The local world's name, which can differ from the listing's. */
  worldName?: string;
}

/** The local world record fields the match reads. */
export interface InstalledWorld {
  id: string;
  name: string;
  sourceId?: string;
}

/**
 * The file's associations, each matched against the installed worlds.
 *
 * A row with a local world can be linked straight away; a row without one names a world that has to be
 * downloaded first. Matching is by listing id alone: two worlds can share a name, and a name has never
 * been an identity here.
 *
 * @param associations - What the file says it is compatible with
 * @param worlds - The worlds installed on this machine
 * @returns One row per association, in the file's own order
 */
export function associationRows(
  associations: readonly WorldAssociation[], worlds: readonly InstalledWorld[],
): AssociationRow[] {
  const installed = new Map(worlds.flatMap((world) => (
    world.sourceId ? [[world.sourceId, world] as const] : []
  )));
  const rows = new Map<string, AssociationRow>();
  for (const association of associations) {
    const id = association.id?.trim();
    if (!id || rows.has(id)) continue;
    const held = installed.get(id);
    rows.set(id, {
      listingId: id,
      name: association.name?.trim() || held?.name || 'Untitled world',
      ...(held ? { worldId: held.id, worldName: held.name } : {}),
    });
  }
  return [...rows.values()];
}

/** The rows a player can link right now, and the ones they would have to download first. */
export const installedRows = (rows: readonly AssociationRow[]): AssociationRow[] =>
  rows.filter((row) => !!row.worldId);

export const onlineRows = (rows: readonly AssociationRow[]): AssociationRow[] =>
  rows.filter((row) => !row.worldId);

/**
 * The library item the file's source already has here, where it has one.
 *
 * The listing is checked first: two machines share a listing id and never a library id. A library id is
 * read only as the machine's own, which is what makes re-importing a file written here find its item.
 *
 * @param source - What the file says about where it came from
 * @param library - This machine's items in the file's own library
 * @returns The item to review the file against, or undefined for a component that is new here
 */
export function heldLibraryItem(
  source: ComponentFileSource | undefined, library: readonly LibraryItemSummary[],
): LibraryItemSummary | undefined {
  if (!source) return undefined;
  const listing = source.sourceId?.trim();
  const byListing = listing ? library.find((item) => item.sourceId === listing) : undefined;
  if (byListing) return byListing;
  const local = source.libraryId?.trim();
  return local ? library.find((item) => item.id === local) : undefined;
}
