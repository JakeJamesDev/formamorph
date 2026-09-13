import { kindOf as catalogKindOf } from '@/lib/catalogKinds';
import type { ReviewState } from '@/lib/compatibleWorlds';
import type { LinkedWorldContent } from '@/lib/publishLinks';
import type { LibraryKind } from '@/lib/librarySources';
import type { WorldRecord } from '@/components/WorldDetails';
import type { ContentLink, Dictionary, Entity } from '@/types';

/** Whether the server could still reach a required source. */
export type DependencyStatus = 'ok' | 'not_found';

/** One entry of a world's required set, as the server resolves it. A deleted source carries no listing. */
export interface DependencyRow {
  id: string;
  status: DependencyStatus;
  listing?: WorldRecord;
}

/** One component offered for a world, with the world author's answer to the offer. `kind` and `name` are
 *  named rather than left to the record's own loose shape, because every reader here uses them. */
export interface AddonRow extends WorldRecord {
  kind?: string;
  name?: string;
  reviewState?: ReviewState;
  /** When the component's author made the offer. The listing's own dates cannot stand in for it: a
   *  republish moves them and would reset how long the offer has waited. */
  offeredAt?: string;
  /** When the world's author last answered. */
  reviewedAt?: string;
  /** The source changed after that answer. */
  updatedSinceReview?: boolean;
}

/** Where an installed component landed, so the world's copies can be pointed at it. */
export interface InstalledSource {
  /** The listing the component was downloaded from — what a published copy names. */
  sourceId: string;
  /** The local library record it was stored as. */
  libraryId: string;
  name: string;
  /** The library item's revision, which is what a later update compares against. */
  revision: string;
}

/** The two add-on tabs, in the order the download review offers them. */
export interface AddonTabs {
  approved: AddonRow[];
  community: AddonRow[];
}

/** Which library a component listing belongs in. A listing of any other kind is not a component. */
export function componentKind(listing: WorldRecord): LibraryKind | null {
  const kind = catalogKindOf(listing);
  return kind === 'entity' || kind === 'dictionary' ? kind : null;
}

/** A listing's own id, whichever spelling the endpoint used. */
export const listingId = (listing: WorldRecord): string => String(listing?._id || listing?.id || '');

/** The two fields a surface needs to address a listing and name it. */
export interface ListingRef {
  id: string;
  name: string;
}

/** A listing record reduced to its id and name. `fallbackName` covers a record with no name. */
export const listingRef = (listing: WorldRecord, fallbackName = 'Untitled'): ListingRef => ({
  id: listingId(listing),
  name: String(listing?.name ?? fallbackName),
});

/**
 * Split a world's add-on offerings into the two tabs that offer them.
 *
 * A declined offering is in neither. The server already withholds declined rows from everybody but the
 * world's author, and the author downloading their own world is exactly who would otherwise see one
 * offered back to them after turning it away.
 *
 * @param addons - What the world's add-on route answered with
 * @returns The approved and community rows, each in the order the server gave them
 */
export function addonTabs(addons: readonly AddonRow[]): AddonTabs {
  const offered = addons.filter((addon) => addon.reviewState !== 'declined');
  return {
    approved: offered.filter((addon) => addon.reviewState === 'approved'),
    community: offered.filter((addon) => addon.reviewState !== 'approved'),
  };
}

/** The add-ons a player selected, in the order the tabs list them. A selected id that is no longer
 *  offered is dropped: the tabs are what the download is built from. */
export function selectedAddons(addons: readonly AddonRow[], selected: Iterable<string>): AddonRow[] {
  const wanted = new Set(selected);
  const { approved, community } = addonTabs(addons);
  return [...approved, ...community].filter((addon) => wanted.has(listingId(addon)));
}

/** The required sources a download can actually install. One the server could not resolve is not among
 *  them: it is reported, and counting it would promise an install that cannot happen. */
export const installableSources = (dependencies: readonly DependencyRow[]): DependencyRow[] =>
  dependencies.filter((row) => row.status === 'ok' && row.listing);

/** How many items the download button installs: every required source it can reach, plus what the player
 *  picked. */
export function downloadItemCount(
  dependencies: readonly DependencyRow[], addons: readonly AddonRow[], selected: Iterable<string>,
): number {
  return installableSources(dependencies).length + selectedAddons(addons, selected).length;
}

/** The copy's record pointed at the library item the download just stored. The published record named a
 *  listing; this adds the local item behind it, which is what makes the copy read as Linked. */
function followInstalled(link: ContentLink, installed: InstalledSource): ContentLink {
  return {
    ...link,
    libraryId: installed.libraryId,
    sourceId: installed.sourceId,
    sourceName: installed.name,
    sourceRevision: installed.revision,
  };
}

function linkList<T extends Entity | Dictionary>(
  items: T[] | undefined, byListing: Map<string, InstalledSource>,
): T[] | undefined {
  if (!items) return items;
  return items.map((item) => {
    const sourceId = item.link?.sourceId;
    const installed = sourceId ? byListing.get(sourceId) : undefined;
    return installed ? { ...item, link: followInstalled(item.link ?? {}, installed) } : item;
  });
}

/**
 * Point a downloaded world's copies at the library items this download stored for them.
 *
 * A published world names its required sources by listing id and nothing else — the publisher's own
 * library ids mean nothing here. This is where each copy gains the local item it follows, which is what
 * the World Editor reads to show Linked.
 *
 * @param world - The downloaded world's content
 * @param installed - The components this download placed in the library
 * @returns The content with every matched copy following its installed source
 */
export function linkInstalledSources<T extends LinkedWorldContent>(
  world: T, installed: readonly InstalledSource[],
): T {
  if (!installed.length) return world;
  const byListing = new Map(installed.map((source) => [source.sourceId, source]));
  return {
    ...world,
    ...(world.entities ? { entities: linkList(world.entities, byListing) } : {}),
    ...(world.dictionaries ? { dictionaries: linkList(world.dictionaries, byListing) } : {}),
  };
}
