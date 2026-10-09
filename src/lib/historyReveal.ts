import {
  touchedIds, type RecordSliceName, type SliceEdit, type SliceName, type Step, type StepOrigin, type WorldSlices,
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
  /** The records an Origin restores when it holds more than one, `id` first. */
  ids?: string[];
  /** The panel sub-tab to show, from the Origin. */
  subTab?: string;
  /** The Locations view to show, from the Origin. */
  view?: string;
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

/** What the editor shows after the move's commit. */
export interface RevealPlace {
  /** Whether the editor mode shows the tab. */
  shows(tab: string): boolean;
  /** Whether the tab's list holds the record. */
  holds(tab: RevealTab, id: string): boolean;
}

const REVEAL_TABS = new Set<string>(Object.values(SLICE_TABS));
const isRevealTab = (tab: string): tab is RevealTab => REVEAL_TABS.has(tab);

/** The Origin's sub-view, which belongs to whichever target sits on the Origin's tab. */
const subView = ({ subTab, view }: StepOrigin): Pick<RevealTarget, 'subTab' | 'view'> => ({
  ...(subTab !== undefined ? { subTab } : {}),
  ...(view !== undefined ? { view } : {}),
});

/**
 * Where one Step returns the author. A Step made through a mirror returns to its Origin tab and the records
 * of its selection that still stand; one made on the touched record's own tab, or whose Origin the editor
 * can't show, reveals the touched record. The Origin's sub-view applies on either kind of tab, and only
 * where the Origin tab is the one shown.
 */
function revealStep(step: Step, world: WorldSlices, place: RevealPlace): RevealTarget | null {
  const target = revealTarget(step, world);
  const fallback = target && place.shows(target.tab) ? target : null;
  const { origin } = step;
  if (!origin || !isRevealTab(origin.tab) || !place.shows(origin.tab)) return fallback;
  if (origin.tab === target?.tab) {
    // Only the canvas selects a connection, so one edited in the list view reveals the open location there.
    if (fallback?.connection && origin.view === 'list') {
      const open = origin.ids?.find((id) => place.holds(origin.tab as RevealTab, id));
      return { tab: origin.tab, ...(open !== undefined ? { id: open } : {}), ...subView(origin) };
    }
    return fallback && { ...fallback, ...subView(origin) };
  }
  if (!origin.ids?.length) return { tab: origin.tab, ...subView(origin) };
  const { tab } = origin;
  const standing = origin.ids.filter((id) => place.holds(tab, id));
  if (!standing.length) return fallback;
  return { tab, id: standing[0], ...(standing.length > 1 ? { ids: standing } : {}), ...subView(origin) };
}

/** Where a move over one or more Steps returns the author: the Step nearest where the cursor lands, else the next one in. */
export function revealForMove(moved: Step[], world: WorldSlices, place: RevealPlace): RevealTarget | null {
  for (let i = moved.length - 1; i >= 0; i -= 1) {
    const target = revealStep(moved[i], world, place);
    if (target) return target;
  }
  return null;
}
