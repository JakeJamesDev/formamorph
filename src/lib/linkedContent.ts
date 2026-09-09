import { randomUUID } from '@/lib/uuid';
import type { CommunityLink, ContentLink, Dictionary, Entity } from '@/types';

/** An entity or a dictionary — the two kinds of content a world copy can follow a source for. */
export type LinkableContent = Entity | Dictionary;

/**
 * A local library item, as the linking flows need to read it: what to follow, what to call it, which
 * revision it is at, and whether the signed-in author owns it. `data` is the item's content, which only
 * the synchronization pass needs.
 */
export interface LibrarySource<T extends LinkableContent = LinkableContent> {
  /** The library record's id — what `ContentLink.libraryId` names. */
  id: string;
  name: string;
  /** Changes whenever the item is saved, so a copy can tell it is behind. */
  revision: string;
  /** The signed-in author owns the item, so its saves push to their linked copies. */
  owned: boolean;
  /** The published listing behind the item, where it has one. */
  sourceId?: string;
  data?: T;
}

/**
 * The fields a world owns on its own copy. A source never writes them, and a comparison never reads them:
 * two copies that differ only here hold the same authored content.
 *
 * Placeholders are here because the world resolved them when the copy arrived — a source's own ids mean
 * nothing in this world. Bringing a source's new references across is the Connect World References step.
 */
const WORLD_OWNED_FIELDS = [
  'id', 'link', 'groupId', 'order', 'locations', 'placeholders', 'sharedPlaceholders',
] as const;

/** The library record fields that stamp a revision, newest meaning first. */
type RevisionStamps = Pick<CommunityLink, 'editedAt' | 'downloadedAt'> & { createdAt?: string };

/** The revision marker a copy holds against. The last save wins; a downloaded item that was never edited
 *  here holds its download, and one written before either stamp existed holds its creation. */
export function libraryRevision(record: RevisionStamps): string {
  return record.editedAt || record.downloadedAt || record.createdAt || '';
}

/** Whether `userId` owns the library item. An item that was never downloaded is the author's own; a
 *  downloaded one is theirs only when they published it, which needs them signed in to establish. */
export function libraryOwned(record: Pick<CommunityLink, 'sourceId' | 'sourceAuthorId'>, userId?: string): boolean {
  if (!record.sourceId) return true;
  return !!userId && record.sourceAuthorId === userId;
}

/** The record a copy carries once it follows `source`. `differs` marks it a local replacement at once,
 *  which is what linking an independent copy to an item it does not match produces. */
export function linkToSource(source: LibrarySource, differs = false): ContentLink {
  return {
    libraryId: source.id,
    ...(source.sourceId ? { sourceId: source.sourceId } : {}),
    sourceName: source.name,
    sourceRevision: source.revision,
    ...(differs ? { localReplacement: true } : {}),
  };
}

/** The copy after an edit: still following its source, but no longer a copy of it. Independent copies and
 *  copies already marked are returned as they are, so this is safe to run on every change. */
export function markEdited<T extends LinkableContent>(item: T): T {
  if (!item.link || item.link.localReplacement) return item;
  return { ...item, link: { ...item.link, localReplacement: true } };
}

/** The copy with its record cleared. The content stays exactly as it is. */
export function unlink<T extends LinkableContent>(item: T): T {
  const { link: _cleared, ...rest } = item;
  return rest as T;
}

/** Sort an object's keys so two equal payloads serialize identically whatever order they were built in. */
const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value === null || typeof value !== 'object') return value;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => [k, stable(v)]);
};

/** The item with every field the world owns removed — what is left is what its author wrote. The one
 *  list, so a comparison and a save to the library can never disagree about which fields those are. */
export function withoutWorldFields<T extends LinkableContent>(item: T): Partial<T> {
  const shed: Record<string, unknown> = { ...item };
  for (const field of WORLD_OWNED_FIELDS) delete shed[field];
  return shed as Partial<T>;
}

/** The authored content of one item, ready to compare. Dictionary entry ids go too: every copy mints its
 *  own, so two identical books never share them. */
function authoredContent(item: LinkableContent): unknown {
  const shed: Record<string, unknown> = withoutWorldFields(item);
  if (Array.isArray(shed.entries)) {
    shed.entries = (shed.entries as { id?: string }[]).map(({ id: _entryId, ...entry }) => entry);
  }
  return stable(shed);
}

/** Whether the copy still holds exactly what the source holds. Names alone prove nothing, so this reads
 *  the whole authored payload. */
export function contentMatchesSource(copy: LinkableContent, source: LinkableContent): boolean {
  return JSON.stringify(authoredContent(copy)) === JSON.stringify(authoredContent(source));
}

/**
 * The copy rewritten to the source's current content. The world keeps its own id, folder, order, location
 * membership, and resolved placeholders; everything the author writes comes from the source.
 *
 * A book's entries take the copy's own ids in order, so the entry open in the editor is still the entry
 * open in the editor after the update.
 */
export function applyLibraryUpdate<T extends LinkableContent>(copy: T, sourceData: T, source: LibrarySource): T {
  const kept: Record<string, unknown> = {};
  const held: Record<string, unknown> = { ...copy };
  for (const field of WORLD_OWNED_FIELDS) {
    if (field in held) kept[field] = held[field];
  }
  const next = { ...sourceData, ...kept, link: linkToSource(source) } as T;
  if ('entries' in next && Array.isArray(next.entries)) {
    const heldIds = ('entries' in copy && Array.isArray(copy.entries) ? copy.entries : []).map((e) => e.id);
    (next as Dictionary).entries = (next as Dictionary).entries.map((entry, index) => ({
      ...entry, id: heldIds[index] ?? randomUUID(),
    }));
  }
  return next;
}

/** The content of one world, as the synchronization pass reads and returns it. */
export interface WorldContent {
  entities: Entity[];
  dictionaries: Dictionary[];
}

function syncList<T extends LinkableContent>(items: T[], sources: Map<string, LibrarySource>): { items: T[]; updated: number } {
  let updated = 0;
  const next = items.map((item) => {
    const link = item.link;
    if (!link?.libraryId || link.localReplacement) return item;
    const source = sources.get(link.libraryId);
    // Another author's source is only ever pulled through Check for Updates, which the player drives.
    if (!source?.owned || !source.data) return item;
    if (source.revision === link.sourceRevision) return item;
    updated += 1;
    return applyLibraryUpdate(item, source.data as T, source);
  });
  return { items: updated ? next : items, updated };
}

/**
 * Bring a world's linked copies up to date with the library items their author owns. Saving a library item
 * is what moves its revision on; this is where that reaches the worlds holding a copy of it.
 *
 * A local replacement is never touched, a copy whose library item is gone or belongs to somebody else is
 * never touched, and a world with nothing to update gets its own arrays back so opening it stays clean.
 */
export function syncWorldContent(world: WorldContent, sources: LibrarySource[]): WorldContent & { updated: number } {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const entities = syncList(world.entities, byId);
  const dictionaries = syncList(world.dictionaries, byId);
  return {
    entities: entities.items,
    dictionaries: dictionaries.items,
    updated: entities.updated + dictionaries.updated,
  };
}
