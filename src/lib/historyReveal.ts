import {
  touchedIds, type RecordSliceName, type SliceEdit, type SliceName, type Step, type WorldSlices,
} from '@/lib/editorHistory';
import type { FindingSection } from '@/lib/testBench/rules';
import type { Dictionary, DictionaryEntry } from '@/types';

/** The World Editor tabs a Step can reveal. */
export type RevealTab = FindingSection;

/** Where the editor goes after an undo or redo. */
export interface RevealTarget {
  tab: RevealTab;
  /** The record to select. Absent when the tab only opens. */
  id?: string;
  /** The world no longer holds the record. The tab opens and its list drops the stale selection. */
  gone?: boolean;
  /** The id names a connection, which the Locations Canvas selects. */
  connection?: boolean;
}

// Stat updates have no tab, so a Step that only touches them reveals nothing.
const SLICE_TABS: Partial<Record<SliceName, RevealTab>> = {
  worldOverview: 'overview',
  stats: 'stats',
  locations: 'locations',
  connections: 'locations',
  entities: 'entities',
  entityGroups: 'entities',
  traits: 'traits',
  traitGroups: 'traits',
  dictionaries: 'dictionary',
  placeholders: 'placeholders',
  placeholderGroups: 'placeholders',
};

const entriesById = (book: Dictionary | undefined) =>
  new Map((book?.entries ?? []).map((entry): [string, DictionaryEntry] => [entry.id, entry]));

/** A book's entries are part of its record, so an entry edit names the entry that still stands, else the book. */
function dictionaryRecordId(bookId: string, before: Dictionary[], after: Dictionary[], world: WorldSlices): string {
  const was = entriesById(before.find((book) => book.id === bookId));
  const became = entriesById(after.find((book) => book.id === bookId));
  const standing = entriesById(world.dictionaries.find((book) => book.id === bookId));
  const changed = [...became.keys(), ...was.keys()].filter((id) => was.get(id) !== became.get(id));
  return changed.find((id) => standing.has(id)) ?? bookId;
}

const addsOrRemoves = (edit: SliceEdit) => edit.slice !== 'worldOverview'
  && (edit.beforeOrder.some((id) => !edit.afterOrder.includes(id)) || edit.afterOrder.some((id) => !edit.beforeOrder.includes(id)));

/** The edits that led the author's action first: the keyed slice, then the ones that add or remove records,
 *  which a cascade (a trait removal rewriting entities) rides behind. Slice order breaks the tie. */
function leadingEdits(step: Step): SliceEdit[] {
  const rank = (edit: SliceEdit) => (edit.slice === step.key?.slice ? 0 : addsOrRemoves(edit) ? 1 : 2);
  return [...step.edits].sort((a, b) => rank(a) - rank(b));
}

/**
 * The tab and record a Step touched, read against the world as the move left it. The edit that led the
 * action decides, and its first touched record. A reorder touches no record, so its tab only opens.
 */
export function revealTarget(step: Step, world: WorldSlices): RevealTarget | null {
  for (const edit of leadingEdits(step)) {
    const tab = SLICE_TABS[edit.slice];
    if (!tab) continue;
    if (edit.slice === 'worldOverview') return { tab };
    const [touched] = touchedIds(edit);
    if (touched === undefined) return { tab };
    const present = (world[edit.slice as RecordSliceName] as { id: string }[]).some((record) => record.id === touched);
    const id = edit.slice === 'dictionaries' && present
      ? dictionaryRecordId(touched, edit.before, edit.after, world)
      : touched;
    return {
      tab, id,
      ...(present ? {} : { gone: true }),
      ...(edit.slice === 'connections' ? { connection: true } : {}),
    };
  }
  return null;
}

/** The target of a move over one or more Steps: the Step nearest where the cursor lands, else the next one in. */
export function revealTargetForMove(moved: Step[], world: WorldSlices): RevealTarget | null {
  for (let i = moved.length - 1; i >= 0; i -= 1) {
    const target = revealTarget(moved[i], world);
    if (target) return target;
  }
  return null;
}
