/**
 * Missing sources: which of a world's copies follow a published source, what a check said about each one,
 * and the three repairs a copy can take.
 *
 * Pure. The check itself is network work the caller does; its answers arrive here as data, so the editor's
 * issue list and the main menu's gate read one module and cannot disagree about what is missing.
 */
import { applyLibraryUpdate, unlink, type LibrarySource, type LinkableContent } from '@/lib/linkedContent';
import type { LibraryKind } from '@/lib/librarySources';
import type { Dictionary, Entity, Placeholder } from '@/types';

/**
 * What a check said about one source.
 *
 * `not_found` is a definite answer: the source is gone. Every other failure is `unavailable`, which says
 * only that this check could not reach it — a network error is not evidence that anything was deleted.
 */
export type SourceCheckStatus = 'ok' | 'not_found' | 'unavailable';

/** Listing id to what the check said about it. */
export type SourceCheckResults = Readonly<Record<string, SourceCheckStatus>>;

/** A world as this module reads and rewrites it: the two lists its copies live in, and the shared
 *  placeholder list a Replace resolves the incoming content's references against. */
export interface SourceCheckWorld {
  entities?: Entity[];
  dictionaries?: Dictionary[];
  placeholders?: Placeholder[];
}

/** One copy in a world that follows a published source. */
export interface SourceCopy {
  /** The copy's own id in this world — what a repair addresses and what the editor opens. */
  id: string;
  name: string;
  kind: LibraryKind;
  /** The listing the copy follows. */
  sourceId: string;
  /** The source's name as the link recorded it, so a gone source can still be named. */
  sourceName: string;
  /** The world's own listing declares this source required. */
  required: boolean;
}

/** One copy whose source the check could not confirm. */
export interface MissingSource extends SourceCopy {
  status: 'not_found' | 'unavailable';
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Every copy in `world` that follows a published source, in the order the world's lists name them.
 *
 * A copy with no listing behind it is not here: only a published source can be checked, and a library item
 * that was never published has nothing on a server to ask about.
 *
 * @param world - The world's content
 * @param required - The listing ids the world's own listing declares required
 * @returns One row per copy, entities before dictionaries
 */
export function linkedSourceCopies(
  world: SourceCheckWorld | null | undefined, required: Iterable<string> = [],
): SourceCopy[] {
  const needed = new Set([...required].map(text).filter(Boolean));
  const rows: SourceCopy[] = [];
  const add = (kind: LibraryKind, item: Entity | Dictionary) => {
    const sourceId = text(item.link?.sourceId);
    if (!sourceId) return;
    rows.push({
      id: item.id,
      name: text(item.name) || 'Untitled',
      kind,
      sourceId,
      sourceName: text(item.link?.sourceName) || text(item.name) || 'Untitled',
      required: needed.has(sourceId),
    });
  };
  for (const entity of world?.entities ?? []) add('entity', entity);
  for (const book of world?.dictionaries ?? []) add('dictionary', book);
  return rows;
}

/** The copies whose source the check could not confirm. A source never checked is not among them: a
 *  finding needs an answer, and no answer is not one. */
export function missingSources(
  copies: readonly SourceCopy[], results: SourceCheckResults,
): MissingSource[] {
  return copies.flatMap((copy) => {
    const status = results[copy.sourceId];
    return status === 'not_found' || status === 'unavailable' ? [{ ...copy, status }] : [];
  });
}

/**
 * The copies that block a new game and a publish: a required source the server answered not found for.
 *
 * An unavailable source never blocks. A failed check says nothing about whether the source exists, and
 * installed content stays playable until something definite says otherwise.
 */
export function blockingSources(
  copies: readonly SourceCopy[], results: SourceCheckResults,
): MissingSource[] {
  return missingSources(copies, results).filter((row) => row.required && row.status === 'not_found');
}

/** "a, b and c" — how one line names the handful of sources it covers. */
const listNames = (names: string[]): string =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * Why this world cannot start a new game or publish, or null when nothing blocks it.
 *
 * It names what is gone and stops. Where to repair it is the surface's own to say, and the main menu says
 * it with a button rather than a second sentence.
 *
 * @param copies - The world's linked copies
 * @param results - What the last check said
 * @returns One line naming the removed sources, or null
 */
export function sourceBlockReason(
  copies: readonly SourceCopy[], results: SourceCheckResults,
): string | null {
  const blocked = blockingSources(copies, results);
  if (blocked.length === 0) return null;
  const names = [...new Set(blocked.map((row) => row.sourceName))];
  const subject = names.length === 1 ? 'a source its author removed' : 'sources their authors removed';
  return `This world requires ${subject}: ${listNames(names)}.`;
}

/** What the author does about one copy whose source is gone. */
export type RepairAction = 'replace' | 'unlink' | 'remove';

/** The repairs one row offers, in the order the row lists them. */
export const REPAIR_CHOICES = [
  { value: 'replace', label: 'Replace from Library' },
  { value: 'unlink', label: 'Unlink and Keep Content' },
  { value: 'remove', label: 'Remove from World' },
] as const satisfies readonly { value: RepairAction; label: string }[];

/** The library item a Replace picks, with the content behind it. */
export interface ReplacementPick {
  source: LibrarySource;
  data: LinkableContent;
}

/** `list` with `id` dropped, or `list` itself when it holds no such item. */
function without<T extends { id: string }>(list: T[] | undefined, id: string): T[] | undefined {
  if (!list) return list;
  const next = list.filter((item) => item.id !== id);
  return next.length === list.length ? list : next;
}

/** `list` with `id` replaced by `fn`'s result, or `list` itself when it holds no such item. */
function replacing<T extends { id: string }>(list: T[] | undefined, id: string, fn: (item: T) => T): T[] | undefined {
  if (!list) return list;
  let changed = false;
  const next = list.map((item) => {
    if (item.id !== id) return item;
    changed = true;
    return fn(item);
  });
  return changed ? next : list;
}

/**
 * The world after one repair.
 *
 * Replace rewrites the copy to the picked item's content and points it at that item, which is the one way
 * back from a republished source: republishing mints a new identity, so nothing reconnects on its own.
 * Unlink clears the record and keeps the content exactly as it is. Remove drops the copy.
 *
 * Returns the same world when nothing matched, so applying a repair twice equals applying it once.
 *
 * @param world - The world's content
 * @param copyId - The copy to repair
 * @param action - What to do about it
 * @param replacement - The picked library item, required by Replace and ignored by the others
 * @returns The repaired world
 */
export function applyRepair<T extends SourceCheckWorld>(
  world: T, copyId: string, action: RepairAction, replacement?: ReplacementPick,
): T {
  if (action === 'remove') {
    const entities = without(world.entities, copyId);
    const dictionaries = without(world.dictionaries, copyId);
    if (entities === world.entities && dictionaries === world.dictionaries) return world;
    return { ...world, entities, dictionaries };
  }

  if (action === 'unlink') {
    const entities = replacing(world.entities, copyId, unlink);
    const dictionaries = replacing(world.dictionaries, copyId, unlink);
    if (entities === world.entities && dictionaries === world.dictionaries) return world;
    return { ...world, entities, dictionaries };
  }

  if (!replacement) return world;
  const shared = world.placeholders ?? [];
  const added: Placeholder[] = [];
  const relink = <I extends LinkableContent>(item: I): I => {
    const applied = applyLibraryUpdate(item, replacement.data as I, replacement.source, shared);
    added.push(...applied.toAdd);
    return applied.item;
  };
  const isBook = 'entries' in replacement.data;
  const entities = isBook ? world.entities : replacing(world.entities, copyId, relink);
  const dictionaries = isBook ? replacing(world.dictionaries, copyId, relink) : world.dictionaries;
  if (entities === world.entities && dictionaries === world.dictionaries) return world;
  return {
    ...world,
    entities,
    dictionaries,
    ...(added.length ? { placeholders: [...shared, ...added] } : {}),
  };
}
