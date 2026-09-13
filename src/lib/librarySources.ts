import { randomUUID } from '@/lib/uuid';
import { buildDictionaryFile } from '@/lib/dictionaryFile';
import { buildEntityCardData } from '@/lib/entityFile';
import {
  libraryOwned, libraryRevision, withoutWorldFields,
  type LibrarySource, type LinkableContent,
} from '@/lib/linkedContent';
import type { InstalledSource } from '@/lib/worldDependencies';
import AuthService from '@/services/AuthService';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import EntityStorageService from '@/services/EntityStorageService';
import type {
  CommunityLink, ContentLocationRef, Dictionary, DictionaryMetadata, Entity, EntityMetadata, GameLocation,
  Placeholder,
} from '@/types';

/** What the link choice means for the content picked, by who owns it. */
export const LINK_EXPLANATIONS = {
  own: 'Saved changes stay synchronized across your linked worlds.',
  other: 'Receive source updates. Your edits stay specific to this world.',
  independent: 'Add an independent copy.',
} as const;

/** Which library a piece of world content belongs to. */
export type LibraryKind = 'entity' | 'dictionary';

/** One library row, as a picker draws it and as a link records it. */
export interface LibraryItemSummary extends LibrarySource {
  kind: LibraryKind;
  /** The listing version this item holds, where it came from one. A world update compares it against the
   *  listing's own, which is what says whether the author republished the source. */
  sourceUpdatedAt?: string;
  /** Who wrote the item. */
  authorLine: string;
  /** Where the item came from. */
  sourceLine: string;
  /** The character portrait, for the character picker's row. */
  image?: string;
  /** How many entries the book holds, for the dictionary picker's row. */
  entryCount?: number;
}

/** The library record fields these lines and states are read from. */
type LibraryStamps = CommunityLink & { createdAt?: string };

/** Who wrote the item, in the picker's own words. Two items can share a name, so this is what tells them
 *  apart. */
export function libraryAuthorLine(record: LibraryStamps, owned: boolean): string {
  if (owned) return 'You';
  return record.sourceAuthorName?.trim() || 'Another author';
}

/** Where the item came from. An item you never published is only in your library. */
export function librarySourceLine(record: LibraryStamps): string {
  return record.sourceId ? 'Community Creations' : 'Your library';
}

/** The signed-in account's id, or undefined while nobody is signed in. */
function currentUserId(): string | undefined {
  return String(AuthService.getCurrentUser()?.id ?? '') || undefined;
}

function summarize(kind: LibraryKind, record: LibraryStamps & { id: string; name: string }): LibraryItemSummary {
  const owned = libraryOwned(record, currentUserId());
  return {
    kind,
    id: record.id,
    name: record.name,
    revision: libraryRevision(record),
    owned,
    ...(record.sourceId ? { sourceId: record.sourceId } : {}),
    ...(record.sourceUpdatedAt ? { sourceUpdatedAt: record.sourceUpdatedAt } : {}),
    authorLine: libraryAuthorLine(record, owned),
    sourceLine: librarySourceLine(record),
  };
}

/** How one kind reaches its own library. The two differ only in which service they go through and which
 *  extra field their picker row draws, so that difference lives here rather than at each call site. */
const LIBRARIES: Record<LibraryKind, {
  list: () => Promise<(LibraryStamps & { id: string; name: string })[]>;
  load: (id: string) => Promise<LinkableContent>;
  store: (record: CommunityLink & { id: string; name: string; createdAt: string; data: LinkableContent }) => Promise<void>;
  row: (meta: DictionaryMetadata & EntityMetadata) => Partial<LibraryItemSummary>;
}> = {
  dictionary: {
    list: () => DictionaryStorageService.getDictionaryMetadata(),
    load: (id) => DictionaryStorageService.getDictionaryData(id),
    store: (record) => DictionaryStorageService.storeDictionary({ ...record, data: record.data as Dictionary }),
    row: (meta) => ({ entryCount: meta.entryCount }),
  },
  entity: {
    list: () => EntityStorageService.getEntityMetadata(),
    load: (id) => EntityStorageService.getEntityData(id),
    store: (record) => EntityStorageService.storeEntity({ ...record, data: record.data as Entity }),
    row: (meta) => ({ image: meta.image ?? undefined }),
  },
};

/** Every item in one library, in stored order — the order the author already knows it in. */
export async function libraryItems(kind: LibraryKind): Promise<LibraryItemSummary[]> {
  const list = await LIBRARIES[kind].list();
  return list.map((meta) => ({
    ...summarize(kind, meta),
    ...LIBRARIES[kind].row(meta as DictionaryMetadata & EntityMetadata),
  }));
}

/** One item's full content, or null when it is gone. */
export async function libraryItemData(kind: LibraryKind, id: string): Promise<LinkableContent | null> {
  try {
    return await LIBRARIES[kind].load(id);
  } catch {
    return null;
  }
}

/** Which library a piece of content belongs to, read from its own shape. */
export const kindOf = (item: LinkableContent): LibraryKind => ('entries' in item ? 'dictionary' : 'entity');

/** An entity's location membership named rather than pointed at, so a receiving world can connect each
 *  place to one of its own. A membership at a location this world no longer holds is dropped. */
function carriedLocations(entity: Entity, worldLocations: readonly GameLocation[]): ContentLocationRef[] {
  const byId = new Map(worldLocations.map((l) => [l.id, l]));
  return (entity.locations ?? []).flatMap((id) => {
    const location = byId.get(id);
    return location ? [{ id: location.id, name: location.name }] : [];
  });
}

/**
 * A world's copy rewritten as a standalone library item: the world's own fields dropped, and the shared
 * placeholders its chips reach carried with it so it still resolves wherever it is added next.
 *
 * `available` is the world's combined placeholder pool, which is what those chips currently point at.
 * `worldLocations` names the places an entity stood in; the entity keeps the references, and the world
 * receiving it decides which of its own locations each one means.
 */
export function toLibraryItem<T extends LinkableContent>(
  item: T, available: Placeholder[], worldLocations: readonly GameLocation[] = [],
): T {
  const carried = kindOf(item) === 'dictionary'
    ? buildDictionaryFile(item as Dictionary, available)
    : buildEntityCardData(item as Entity, available);
  const locationRefs = kindOf(item) === 'entity' ? carriedLocations(item as Entity, worldLocations) : [];
  // The world's own fields go, including its id: the caller stamps the library record's own.
  return {
    ...withoutWorldFields(item),
    ...(carried.placeholders?.length ? { placeholders: carried.placeholders } : {}),
    ...(carried.sharedPlaceholders?.length ? { sharedPlaceholders: carried.sharedPlaceholders } : {}),
    ...(locationRefs.length ? { locationRefs } : {}),
  } as T;
}

/**
 * Store a world's copy as a new library item owned by the author, and describe the item so the copy can
 * link to it. The item gets its own id: the world keeps the copy it already has.
 */
export async function saveCopyToLibrary(
  item: LinkableContent, available: Placeholder[], worldLocations: readonly GameLocation[] = [],
): Promise<LibrarySource> {
  const id = randomUUID();
  const data = { ...toLibraryItem(item, available, worldLocations), id };
  const now = new Date().toISOString();
  await LIBRARIES[kindOf(item)].store({ id, name: data.name, createdAt: now, data });
  // `store` stamps `lastAccessed` itself and leaves `editedAt` unset, so the revision this link holds is
  // the creation stamp — the same one a later read computes.
  return { id, name: data.name, revision: now, owned: true, data };
}

/** What a downloaded component's library record remembers about where it came from. */
export interface DownloadedListing {
  /** The listing it was downloaded from. */
  sourceId: string;
  /** The listing's own name, used when the content carries none. */
  name?: string;
  /** The listing's `updated_at`, so a later check can tell this copy is behind. */
  sourceUpdatedAt?: string;
  authorId?: string;
  authorName?: string;
}

/**
 * Store a component downloaded from the catalog as a library item that follows its listing.
 *
 * One local copy per listing, as every other library download is: re-downloading refreshes the copy the
 * player already has rather than leaving them two rows with the same name. The copy takes its own record
 * id, never the content's — a listing forked from the same ancestor as a local original carries that id
 * too, and writing there would silently replace a different item.
 *
 * @param kind - Which library the component belongs in
 * @param content - The downloaded content
 * @param listing - Where it came from
 * @returns The library item, with the revision a world copy following it holds against
 */
export async function saveDownloadToLibrary(
  kind: LibraryKind, content: LinkableContent, listing: DownloadedListing,
): Promise<InstalledSource> {
  const held = (await LIBRARIES[kind].list()).find((record) => record.sourceId === listing.sourceId);
  // An edited copy is kept exactly as it is, and the world's copy follows it. Replacing it here would
  // discard the player's own work with no warning; taking the source's version is an update review.
  if (held?.dirty) {
    return { sourceId: listing.sourceId, libraryId: held.id, name: held.name, revision: libraryRevision(held) };
  }
  const id = held?.id ?? randomUUID();
  const now = new Date().toISOString();
  const data = { ...content, id };
  const name = data.name?.trim() || listing.name?.trim() || 'Untitled';
  await LIBRARIES[kind].store({
    id,
    name,
    createdAt: held?.createdAt ?? now,
    data: { ...data, name },
    sourceId: listing.sourceId,
    downloadedAt: now,
    // A fresh download is by definition unedited, which also clears the flag on a copy that was edited.
    dirty: false,
    ...(listing.sourceUpdatedAt ? { sourceUpdatedAt: listing.sourceUpdatedAt } : {}),
    ...(listing.authorId ? { sourceAuthorId: listing.authorId } : {}),
    ...(listing.authorName ? { sourceAuthorName: listing.authorName } : {}),
  });
  return {
    sourceId: listing.sourceId,
    libraryId: id,
    name,
    // Read the way a later library read computes it, so the copy that follows this item is not reported
    // behind the moment it arrives. `editedAt` is sticky across a store and still wins.
    revision: libraryRevision({ editedAt: held?.editedAt, downloadedAt: now, createdAt: now }),
  };
}

/**
 * Record that a library item now has a listing of its own.
 *
 * Written the moment a source publishes, before the world that required it goes up: a publish that fails
 * later must not offer to publish this item a second time, and the listing already exists either way.
 *
 * @param kind - Which library the item is in
 * @param id - The library record's id
 * @param sourceId - The listing it was published as
 * @param author - The account that published it, so `libraryOwned` still reads it as theirs
 */
export async function linkLibraryItemToListing(
  kind: LibraryKind, id: string, sourceId: string, author?: { id?: string; name?: string },
): Promise<void> {
  const data = await libraryItemData(kind, id);
  if (!data) return;
  await LIBRARIES[kind].store({
    id,
    name: data.name,
    createdAt: new Date().toISOString(),
    data,
    sourceId,
    ...(author?.id ? { sourceAuthorId: author.id } : {}),
    ...(author?.name ? { sourceAuthorName: author.name } : {}),
  });
}

/** The owned library items a world's copies follow, with their content, ready for the synchronization
 *  pass. Items belonging to another author are listed without content: their updates are reviewed, not
 *  pushed. */
export async function loadLinkedSources(libraryIds: Iterable<string>): Promise<LibrarySource[]> {
  const wanted = new Set(libraryIds);
  if (!wanted.size) return [];
  const [entities, dictionaries] = await Promise.all([libraryItems('entity'), libraryItems('dictionary')]);
  const matched = [...entities, ...dictionaries].filter((item) => wanted.has(item.id));
  return Promise.all(matched.map(async (item) => (
    item.owned ? { ...item, data: (await libraryItemData(item.kind, item.id)) ?? undefined } : item
  )));
}
