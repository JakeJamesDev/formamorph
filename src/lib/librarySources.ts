import { randomUUID } from '@/lib/uuid';
import { buildDictionaryFile } from '@/lib/dictionaryFile';
import { buildEntityCardData } from '@/lib/entityFile';
import {
  libraryOwned, libraryRevision, withoutWorldFields,
  type LibrarySource, type LinkableContent,
} from '@/lib/linkedContent';
import AuthService from '@/services/AuthService';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import EntityStorageService from '@/services/EntityStorageService';
import type { CommunityLink, Dictionary, DictionaryMetadata, Entity, EntityMetadata, Placeholder } from '@/types';

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
    authorLine: libraryAuthorLine(record, owned),
    sourceLine: librarySourceLine(record),
  };
}

/** How one kind reaches its own library. The two differ only in which service they go through and which
 *  extra field their picker row draws, so that difference lives here rather than at each call site. */
const LIBRARIES: Record<LibraryKind, {
  list: () => Promise<(LibraryStamps & { id: string; name: string })[]>;
  load: (id: string) => Promise<LinkableContent>;
  store: (record: { id: string; name: string; createdAt: string; data: LinkableContent }) => Promise<void>;
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

/**
 * A world's copy rewritten as a standalone library item: the world's own fields dropped, and the shared
 * placeholders its chips reach carried with it so it still resolves wherever it is added next.
 *
 * `available` is the world's combined placeholder pool, which is what those chips currently point at.
 */
export function toLibraryItem<T extends LinkableContent>(item: T, available: Placeholder[]): T {
  const carried = kindOf(item) === 'dictionary'
    ? buildDictionaryFile(item as Dictionary, available)
    : buildEntityCardData(item as Entity, available);
  // The world's own fields go, including its id: the caller stamps the library record's own.
  return {
    ...withoutWorldFields(item),
    ...(carried.placeholders?.length ? { placeholders: carried.placeholders } : {}),
    ...(carried.sharedPlaceholders?.length ? { sharedPlaceholders: carried.sharedPlaceholders } : {}),
  } as T;
}

/**
 * Store a world's copy as a new library item owned by the author, and describe the item so the copy can
 * link to it. The item gets its own id: the world keeps the copy it already has.
 */
export async function saveCopyToLibrary(item: LinkableContent, available: Placeholder[]): Promise<LibrarySource> {
  const id = randomUUID();
  const data = { ...toLibraryItem(item, available), id };
  const now = new Date().toISOString();
  await LIBRARIES[kindOf(item)].store({ id, name: data.name, createdAt: now, data });
  // `store` stamps `lastAccessed` itself and leaves `editedAt` unset, so the revision this link holds is
  // the creation stamp — the same one a later read computes.
  return { id, name: data.name, revision: now, owned: true, data };
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
