/**
 * The component update review: which world copies a library item has left behind, what each world may do
 * about it, and what the source changed.
 *
 * A check compares one revision marker against another. Nothing here reads the network and nothing here
 * writes: the caller applies the answers the player gives.
 */

import type { ContentLinkState } from '@/lib/contentLink';
import { withoutWorldFields, type LinkableContent } from '@/lib/linkedContent';
import type { LibraryKind } from '@/lib/librarySources';
import type { ContentLink, Dictionary, DictionaryEntry } from '@/types';

/** What one world does with the update offered to its copy. */
export type UpdateAction = 'update' | 'keep' | 'unlink';

/** One world holding a copy that is behind the source. */
export interface UpdateRow {
  /** The world holding the copy. Two worlds can hold copies of one item, so this is the row's identity. */
  worldId: string;
  worldName: string;
  /** The copy inside that world. */
  itemId: string;
  itemName: string;
  kind: LibraryKind;
  /** Linked, or a local replacement whose edits the default protects. */
  state: ContentLinkState;
}

/**
 * Whether a copy is behind `revision` and has not already answered for it.
 *
 * Keep Mine writes the reviewed revision, so the same revision does not come back. A copy with no record,
 * or one that follows a published listing rather than this library item, is not this item's to offer.
 */
export function needsReview(link: ContentLink | undefined, revision: string): boolean {
  if (!link?.libraryId || !revision) return false;
  return link.sourceRevision !== revision && link.reviewedRevision !== revision;
}

/** The action a row starts on: an unmodified copy takes the update, a local replacement keeps its edits. */
export function defaultAction(state: ContentLinkState): UpdateAction {
  return state === 'local-replacement' ? 'keep' : 'update';
}

/**
 * The dropdown for one row, in order.
 *
 * Taking the source is one operation under two names: an unmodified copy is brought up to date, while a
 * local replacement is told whose version wins. Every row can decline the revision or stop following.
 */
export function actionChoices(state: ContentLinkState): { value: UpdateAction; label: string }[] {
  return state === 'local-replacement'
    ? [
      { value: 'keep', label: 'Keep Mine' },
      { value: 'update', label: "Use Author's" },
      { value: 'unlink', label: 'Unlink' },
    ]
    : [
      { value: 'update', label: 'Update' },
      { value: 'keep', label: 'Keep Mine' },
      { value: 'unlink', label: 'Unlink' },
    ];
}

/** The word the row's chosen action reads as, for the confirmation summary. */
export function actionLabel(state: ContentLinkState, action: UpdateAction): string {
  return actionChoices(state).find((choice) => choice.value === action)?.label ?? action;
}

/** The copy after Keep Mine: the same content, holding the revision it answered for. */
export function markReviewed<T extends LinkableContent>(item: T, revision: string): T {
  if (!item.link) return item;
  return { ...item, link: { ...item.link, reviewedRevision: revision } };
}

/** The fields whose value is bytes rather than text. A comparison says whether they changed, never what
 *  they hold. */
const MEDIA_FIELDS = new Set(['images', 'thumbnail', 'sound', 'model']);

/** Fields a comparison never lists: the source's own world wrote them, and the update drops them. */
const SKIPPED_FIELDS = new Set(['entries', 'locationRefs']);

/** What each field is called on screen. A field absent here reads as its own name, spaced and capitalized. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  aliases: 'Also Known As',
  type: 'Type',
  playerDescription: 'Player Description',
  aiDescription: 'AI Description',
  aiSummary: 'AI Summary',
  images: 'Images',
  tags: 'Tags',
  imageTags: 'Image Tags',
  sound: 'Sound',
  model: 'Model',
  description: 'Description',
  enabled: 'Enabled',
  thumbnail: 'Cover Art',
};

/** A field name nobody labeled, as words: `aiSummary` reads AI Summary, `scanDepth` reads Scan Depth. */
function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const spaced = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** One field's value as a line of text. Media reports its size, never its bytes. */
export function formatValue(field: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Not set';
  if (MEDIA_FIELDS.has(field)) {
    if (Array.isArray(value)) return value.length === 1 ? '1 image' : `${value.length} images`;
    return 'Set';
  }
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : 'Not set';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** One field, with what this world holds and what the source offers. */
export interface FieldChange {
  field: string;
  label: string;
  current: string;
  incoming: string;
}

/** One dictionary entry, on whichever side has it. */
export interface EntryChange {
  /** What matches the two sides: the entry's name, or its keywords where it has no name. */
  key: string;
  label: string;
  current?: string;
  incoming?: string;
}

/** What the source changed, ready to draw. Changed comes first; unchanged sits behind a disclosure. */
export interface ContentDiff {
  changed: FieldChange[];
  unchanged: FieldChange[];
  addedEntries: EntryChange[];
  removedEntries: EntryChange[];
  changedEntries: EntryChange[];
  unchangedEntries: EntryChange[];
}

/** What a dictionary entry is matched on across two copies. Ids are minted per copy and never match. */
function entryIdentity(entry: DictionaryEntry): string {
  const name = entry.name?.trim();
  if (name) return name.toLowerCase();
  return (entry.key ?? []).join(', ').toLowerCase();
}

/** One entry's content, for telling a changed entry from an unchanged one. */
function entryBody(entry: DictionaryEntry): string {
  const { id: _minted, ...rest } = entry;
  return JSON.stringify(rest);
}

/** The entry's value, as the comparison shows it. */
function entryText(entry: DictionaryEntry): string {
  return entry.value?.trim() || 'Not set';
}

/** The entry's heading: its name, or the keywords that stand in for one. */
function entryLabel(entry: DictionaryEntry): string {
  return entry.name?.trim() || (entry.key ?? []).join(', ') || 'Untitled entry';
}

/**
 * Pair the two sides' entries by identity, in order.
 *
 * Duplicate names are allowed, so an identity can name several entries: they pair off in the order each
 * side lists them, and whatever is left over on one side is an addition or a removal.
 */
function pairEntries(current: DictionaryEntry[], incoming: DictionaryEntry[]): {
  added: EntryChange[]; removed: EntryChange[]; changed: EntryChange[]; unchanged: EntryChange[];
} {
  const queued = new Map<string, DictionaryEntry[]>();
  for (const entry of current) {
    const key = entryIdentity(entry);
    queued.set(key, [...(queued.get(key) ?? []), entry]);
  }

  const added: EntryChange[] = [];
  const changed: EntryChange[] = [];
  const unchanged: EntryChange[] = [];
  for (const entry of incoming) {
    const key = entryIdentity(entry);
    const held = queued.get(key)?.shift();
    if (!held) {
      added.push({ key, label: entryLabel(entry), incoming: entryText(entry) });
      continue;
    }
    const row = { key, label: entryLabel(entry), current: entryText(held), incoming: entryText(entry) };
    if (entryBody(held) === entryBody(entry)) unchanged.push(row);
    else changed.push(row);
  }

  const removed = [...queued.values()].flat()
    .map((entry) => ({ key: entryIdentity(entry), label: entryLabel(entry), current: entryText(entry) }));
  return { added, removed, changed, unchanged };
}

/**
 * What this world's copy holds against what the source offers.
 *
 * Only authored content is compared. The fields a world owns — where the copy sits, what it connects to —
 * are the world's own and are never the source's to change, so two copies differing only there compare
 * equal.
 */
export function diffContent(copy: LinkableContent, source: LinkableContent): ContentDiff {
  const held = withoutWorldFields(copy) as Record<string, unknown>;
  const offered = withoutWorldFields(source) as Record<string, unknown>;
  const fields = [...new Set([...Object.keys(held), ...Object.keys(offered)])]
    .filter((field) => !SKIPPED_FIELDS.has(field))
    .sort();

  const changed: FieldChange[] = [];
  const unchanged: FieldChange[] = [];
  for (const field of fields) {
    const row = {
      field,
      label: fieldLabel(field),
      current: formatValue(field, held[field]),
      incoming: formatValue(field, offered[field]),
    };
    const same = JSON.stringify(held[field] ?? null) === JSON.stringify(offered[field] ?? null);
    (same ? unchanged : changed).push(row);
  }

  const entries = 'entries' in copy || 'entries' in source
    ? pairEntries((copy as Dictionary).entries ?? [], (source as Dictionary).entries ?? [])
    : { added: [], removed: [], changed: [], unchanged: [] };

  return {
    changed,
    unchanged,
    addedEntries: entries.added,
    removedEntries: entries.removed,
    changedEntries: entries.changed,
    unchangedEntries: entries.unchanged,
  };
}

/** Whether a comparison found anything the source changed. */
export function diffHasChanges(diff: ContentDiff): boolean {
  return !!(diff.changed.length || diff.addedEntries.length
    || diff.removedEntries.length || diff.changedEntries.length);
}
