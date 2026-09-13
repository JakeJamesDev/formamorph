import type { LibraryItemSummary, LibraryKind } from '@/lib/librarySources';
import type { ContentLink, Dictionary, Entity } from '@/types';

/** Public or hidden from discovery. A world is always public; only a component can be unlisted. */
export type ListingVisibility = 'public' | 'unlisted';

/** The two listing choices, in the order every surface offers them. */
export const LISTING_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'unlisted', label: 'Unlisted' },
] as const satisfies readonly { value: ListingVisibility; label: string }[];

/** Library id to the listing it was published as. */
export type ResolvedSources = Readonly<Record<string, string>>;

/** Where a linked copy's source stands when its world is about to publish. */
export type LinkedSourceState =
  /** It is already a listing. This world declares it and never republishes it. */
  | 'published'
  /** A library item with no listing yet. Publishing the world can create one. */
  | 'unpublished'
  /** The library item is gone and the copy names no listing, so nothing can be required. */
  | 'unavailable';

/** One row of the world's Linked Content section: a source, and what this publish does about it. */
export interface LinkedContentRow {
  /** The library item every copy in this row follows. One row per source, however many copies follow it. */
  libraryId: string;
  kind: LibraryKind;
  name: string;
  state: LinkedSourceState;
  /** The listing behind the source, where it has one. */
  sourceId?: string;
  /** Include as required. */
  required: boolean;
  /** The listing a source published with this world is created as. Unused once it has one. */
  visibility: ListingVisibility;
}

/** The two content lists a world publishes, as this module reads and rewrites them. */
export interface LinkedWorldContent {
  entities?: Entity[];
  dictionaries?: Dictionary[];
}

/** The library item a copy follows, or null for an independent copy. The one reading of a link record's
 *  `libraryId`, so every surface agrees on which copies follow something. */
export const followedLibraryId = (item: { link?: ContentLink }): string | null => {
  const id = item.link?.libraryId;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
};

/**
 * Whether any copy in this world follows a source.
 *
 * Read from the content alone, so it is settled before the library or the listing has loaded. A world
 * that follows nothing requires nothing, whatever its listing currently says: a dependency exists only
 * because a copy in the world follows it.
 *
 * @param world - The world about to publish
 * @returns True when at least one copy carries a link record
 */
export function hasLinkedContent(world: LinkedWorldContent | undefined | null): boolean {
  if (!world || typeof world !== 'object') return false;
  return [...(world.entities ?? []), ...(world.dictionaries ?? [])].some((item) => followedLibraryId(item) !== null);
}

/**
 * Build the Linked Content rows for one world.
 *
 * `declared` is the listing's current required set, which is what remembers the author's choices; pass
 * null when this publish creates a listing. A first publication checks every row, as the author has made
 * no choice yet. A later one checks what the listing already requires — and leaves a source with no
 * listing unchecked, because a listing that required it would name it, so it was not required last time.
 * Pass an empty array rather than null when a listing's set could not be read: every row is then
 * unchecked, and no source publishes without the author asking for it.
 *
 * @param world - The world about to publish
 * @param library - The author's library, which says who owns each source and whether it is published
 * @param declared - The listing's current required source ids, or null when publishing a new listing
 * @returns One row per followed library item, in the order the world's content names them
 */
export function linkedContentRows(
  world: LinkedWorldContent,
  library: readonly LibraryItemSummary[],
  declared: readonly string[] | null,
): LinkedContentRow[] {
  const byId = new Map(library.map((item) => [item.id, item]));
  const rows = new Map<string, LinkedContentRow>();

  const add = (kind: LibraryKind, item: Entity | Dictionary) => {
    const libraryId = followedLibraryId(item);
    if (!libraryId || rows.has(libraryId)) return;
    const source = byId.get(libraryId);
    const sourceId = source?.sourceId ?? item.link?.sourceId;
    const state: LinkedSourceState = sourceId ? 'published' : source ? 'unpublished' : 'unavailable';
    rows.set(libraryId, {
      libraryId,
      kind,
      name: source?.name || item.link?.sourceName || item.name || 'Untitled',
      state,
      ...(sourceId ? { sourceId } : {}),
      required: state === 'unavailable' ? false : declared ? Boolean(sourceId && declared.includes(sourceId)) : true,
      visibility: 'unlisted',
    });
  };

  for (const entity of world.entities ?? []) add('entity', entity);
  for (const book of world.dictionaries ?? []) add('dictionary', book);

  return [...rows.values()];
}

/** The listing ids the world publishes as its required set, once `resolved` names every source published
 *  in this run by its library id. */
export function requiredSourceIds(
  rows: readonly LinkedContentRow[], resolved: ResolvedSources = {},
): string[] {
  return rows.flatMap((row) => {
    if (!row.required) return [];
    const id = row.sourceId ?? resolved[row.libraryId];
    return id ? [id] : [];
  });
}

/** The rows this publish still has to create a listing for: required, owned, and not yet published here. */
export function sourcesToPublish(
  rows: readonly LinkedContentRow[], resolved: ResolvedSources = {},
): LinkedContentRow[] {
  return rows.filter((row) => row.required && row.state === 'unpublished' && !resolved[row.libraryId]);
}

/**
 * Whether this publish states a required set at all.
 *
 * A set the author asked for is always stated. An empty one is stated only to clear a listing known to
 * require something: with `declared` null the listing's own set is unknown, and a publish must not clear
 * what it could not read.
 *
 * @param required - The set this publish would state
 * @param declared - The listing's current set, or null when it is unknown
 * @returns True when `requiredDependencies` belongs on the body
 */
export function declaresDependencies(
  required: readonly string[], declared: readonly string[] | null,
): boolean {
  return required.length > 0 || (declared?.length ?? 0) > 0;
}

/**
 * The link record a required copy publishes with.
 *
 * `libraryId`, `sourceRevision` and `reviewedRevision` all describe the publisher's own library, which
 * the reader does not have, so they go. What is left names the listing the reader can resolve, the name
 * to show for it, and the world-owned references the copy already connected.
 */
function publishedLink(link: ContentLink, sourceId: string): ContentLink {
  const { libraryId: _local, sourceRevision: _held, reviewedRevision: _reviewed, ...rest } = link;
  return { ...rest, sourceId };
}

function forPublication<T extends Entity | Dictionary>(
  items: T[] | undefined, required: Map<string, string>,
): T[] | undefined {
  if (!items) return items;
  return items.map((item) => {
    const libraryId = followedLibraryId(item);
    if (!libraryId) return item;
    const sourceId = required.get(libraryId);
    // Embedded: the reader receives the content and follows nothing, so the record goes with the link.
    if (!sourceId) {
      const { link: _embedded, ...rest } = item;
      return rest as T;
    }
    return { ...item, link: publishedLink(item.link ?? {}, sourceId) };
  });
}

/**
 * The world as it is published: every required copy names the listing it follows, and every copy the
 * author left unchecked is embedded with no record at all. The author's own world is untouched — their
 * local links are editing links and survive whatever they publish.
 *
 * @param world - The world's content
 * @param rows - The Linked Content rows, as the author left them
 * @param resolved - Library id to listing id for the sources published in this run
 * @returns The content to publish
 */
export function worldPublishContent<T extends LinkedWorldContent>(
  world: T, rows: readonly LinkedContentRow[], resolved: ResolvedSources = {},
): T {
  const required = new Map<string, string>();
  for (const row of rows) {
    if (!row.required) continue;
    const id = row.sourceId ?? resolved[row.libraryId];
    if (id) required.set(row.libraryId, id);
  }

  return {
    ...world,
    ...(world.entities ? { entities: forPublication(world.entities, required) } : {}),
    ...(world.dictionaries ? { dictionaries: forPublication(world.dictionaries, required) } : {}),
  };
}
