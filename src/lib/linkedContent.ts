import { adoptBookPlaceholders, adoptEntityPlaceholders } from '@/lib/placeholderHomes';
import { followedLibraryId } from '@/lib/publishLinks';
import { randomUUID } from '@/lib/uuid';
import type { CommunityLink, ContentLink, Dictionary, Entity, Placeholder } from '@/types';

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

/**
 * The copy after the library item it followed is gone.
 *
 * `libraryId`, `sourceRevision` and `reviewedRevision` all describe that item, so they go. A published
 * listing the copy also follows is a source of its own and stands. A record left naming nothing goes with
 * them, which makes the copy an independent copy. The content is never touched.
 *
 * Returns the same reference when there is no library item named, so a second run is a no-op.
 */
export function dropLibraryLink<T extends LinkableContent>(item: T): T {
  if (!followedLibraryId(item)) return item;
  const { libraryId: _gone, sourceRevision: _libraryRevision, reviewedRevision: _reviewed, ...rest } = item.link ?? {};
  return rest.sourceId ? { ...item, link: rest } : unlink(item);
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

/**
 * Every authored string on one item that can hold a chip.
 *
 * The one list, so a placeholder sweep and an export cannot disagree about which fields a copy's chips
 * live in. Media, ids and the world-owned fields carry no text.
 */
export function chipTexts(item: LinkableContent): string[] {
  if ('entries' in item) {
    return item.entries
      .flatMap((entry) => [entry.name ?? '', ...(entry.key ?? []), ...(entry.secondaryKeys ?? []), entry.value ?? '']);
  }
  return [
    item.name, ...(item.aliases ?? []),
    item.playerDescription, item.aiDescription, item.aiSummary, item.imageTags,
  ].filter((text): text is string => !!text);
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

/** The world-owned fields an update keeps from the copy. The two placeholder lists are absent: the source
 *  writes them, and the adopt pass is what turns its ids into this world's. */
const KEPT_ON_UPDATE = WORLD_OWNED_FIELDS
  .filter((field) => field !== 'placeholders' && field !== 'sharedPlaceholders');

/**
 * The connections an update carries over untouched: the ones the adopt pass does not settle, which is
 * every location the copy connected. A key the source no longer names goes, so a reference it dropped
 * stops being reported as a connection to something missing.
 */
function carriedConnections(copy: LinkableContent, sourceData: LinkableContent): Record<string, string> {
  const held = copy.link?.connections ?? {};
  const named = new Set([
    ...(sourceData.sharedPlaceholders ?? []).map((p) => p.id),
    ...((sourceData as Entity).locationRefs ?? []).map((ref) => ref.id),
  ]);
  return Object.fromEntries(Object.entries(held).filter(([key]) => named.has(key)));
}

/**
 * The copy rewritten to the source's current content. The world keeps its own id, folder, order and
 * location membership; everything the author writes comes from the source.
 *
 * The source's chips name the source's own placeholders, so the pass re-adopts them: the item's own
 * placeholders are minted fresh here, and every world-owned reference resolves through the connections the
 * copy stored. A reference the source has since renamed stays connected, because a connection is keyed by
 * the source's id and never by a name. A reference the source has newly introduced has no connection yet
 * and joins the world as a placeholder of its own, which Save Connections can then re-aim.
 *
 * A book's entries take the copy's own ids in order, so the entry open in the editor is still the entry
 * open in the editor after the update.
 */
export function applyLibraryUpdate<T extends LinkableContent>(
  copy: T, sourceData: T, source: LibrarySource, worldShared: readonly Placeholder[],
): { item: T; toAdd: Placeholder[] } {
  const kept: Record<string, unknown> = {};
  const held: Record<string, unknown> = { ...copy };
  for (const field of KEPT_ON_UPDATE) {
    if (field in held) kept[field] = held[field];
  }
  // The source's location references are its own world's; the copy's membership here is what stands.
  const { locationRefs: _theirs, ...content } = sourceData as T & { locationRefs?: unknown };
  const incoming = { ...content, ...kept } as T;
  const resolved = 'entries' in incoming
    ? adoptBookPlaceholders(incoming as Dictionary, worldShared, copy.link?.connections)
    : adoptEntityPlaceholders(incoming as Entity, worldShared, copy.link?.connections);
  const adopted = 'book' in resolved ? resolved.book : resolved.entity;
  const connections = { ...carriedConnections(copy, sourceData), ...resolved.connections };
  const link: ContentLink = {
    ...linkToSource(source),
    ...(Object.keys(connections).length ? { connections } : {}),
  };
  const next = { ...adopted, link } as T;
  if ('entries' in next && Array.isArray(next.entries)) {
    const heldIds = ('entries' in copy && Array.isArray(copy.entries) ? copy.entries : []).map((e) => e.id);
    (next as Dictionary).entries = (next as Dictionary).entries.map((entry, index) => ({
      ...entry, id: heldIds[index] ?? randomUUID(),
    }));
  }
  return { item: next, toAdd: resolved.toAdd };
}

/** The content of one world, as the synchronization pass reads and returns it. */
export interface WorldContent {
  entities: Entity[];
  dictionaries: Dictionary[];
}

function syncList<T extends LinkableContent>(
  items: T[], sources: Map<string, LibrarySource>, shared: Placeholder[],
): { items: T[]; updated: number; unlinked: number; toAdd: Placeholder[] } {
  let updated = 0;
  let unlinked = 0;
  const toAdd: Placeholder[] = [];
  const next = items.map((item) => {
    const link = item.link;
    const libraryId = followedLibraryId(item);
    if (!libraryId || !link) return item;
    // The lookup covered every library id the world names, so an id it did not answer is an item the
    // player deleted. This is where that reaches the copies, which is why no scan runs at deletion time.
    if (!sources.has(libraryId)) {
      unlinked += 1;
      return dropLibraryLink(item);
    }
    if (link.localReplacement) return item;
    const source = sources.get(libraryId);
    // Another author's source is only ever pulled through Check for Updates, which the player drives.
    if (!source?.owned || !source.data) return item;
    if (source.revision === link.sourceRevision) return item;
    updated += 1;
    // Each copy resolves against the world plus whatever the copies before it already brought in, so two
    // copies expecting the same new reference land on one placeholder rather than two.
    const applied = applyLibraryUpdate(item, source.data as T, source, [...shared, ...toAdd]);
    toAdd.push(...applied.toAdd);
    return applied.item;
  });
  return { items: updated || unlinked ? next : items, updated, unlinked, toAdd };
}

/**
 * Bring a world's linked copies up to date with the library items their author owns, and let go of the
 * items that are gone. Saving a library item is what moves its revision on; this is where that reaches the
 * worlds holding a copy of it.
 *
 * A local replacement is never updated and a copy of somebody else's item is never updated, but both let
 * go of an item that is gone. A world with nothing to change gets its own arrays back so opening it stays
 * clean.
 *
 * `sources` must be the answer to looking up every library id the world's copies name: an id it does not
 * carry reads as an item the player deleted, and its copies become independent copies.
 *
 * `placeholders` is the world's shared list, which the updated content resolves its references against;
 * `toAdd` is what the world gains for references no copy had a connection for.
 */
export function syncWorldContent(
  world: WorldContent & { placeholders: Placeholder[] }, sources: LibrarySource[],
): WorldContent & { updated: number; unlinked: number; toAdd: Placeholder[] } {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const entities = syncList(world.entities, byId, world.placeholders);
  const dictionaries = syncList(world.dictionaries, byId, [...world.placeholders, ...entities.toAdd]);
  return {
    entities: entities.items,
    dictionaries: dictionaries.items,
    updated: entities.updated + dictionaries.updated,
    unlinked: entities.unlinked + dictionaries.unlinked,
    toAdd: [...entities.toAdd, ...dictionaries.toAdd],
  };
}
