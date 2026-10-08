import type {
  Connection, Dictionary, Entity, EntityGroup, GameLocation, Placeholder, PlaceholderGroup, Stat, StatUpdate, Trait,
  TraitGroup, WorldOverview,
} from "@/types";

/**
 * The World Editor's undo stack. A Step is one author action: the slices it rewrote, each as the touched
 * records before and after plus the slice's id order on both sides. Undo writes the earlier records back onto
 * the world as it stands now, so an edit to another record made in between survives.
 *
 * Session-only and capped. Nothing here is stored with the world, and saving only places a marker.
 */

/** The twelve slices of an open world that the history records. */
export interface WorldSlices {
  worldOverview: WorldOverview;
  stats: Stat[];
  locations: GameLocation[];
  connections: Connection[];
  entities: Entity[];
  entityGroups: EntityGroup[];
  traits: Trait[];
  traitGroups: TraitGroup[];
  statUpdates: StatUpdate[];
  dictionaries: Dictionary[];
  placeholders: Placeholder[];
  placeholderGroups: PlaceholderGroup[];
}

export type SliceName = keyof WorldSlices;
export type RecordSliceName = Exclude<SliceName, "worldOverview">;

export const WORLD_SLICES: readonly SliceName[] = [
  "worldOverview", "stats", "locations", "connections", "entities", "entityGroups", "traits", "traitGroups",
  "statUpdates", "dictionaries", "placeholders", "placeholderGroups",
];

/** One record slice's change: only the touched records, absent on a side where the record did not exist. */
export type RecordEdit = {
  [S in RecordSliceName]: {
    slice: S;
    before: WorldSlices[S];
    after: WorldSlices[S];
    beforeOrder: string[];
    afterOrder: string[];
  };
}[RecordSliceName];

/** The overview is one object, stored whole on both sides and restored by field. */
export interface OverviewEdit {
  slice: "worldOverview";
  before: WorldOverview;
  after: WorldOverview;
}

export type SliceEdit = RecordEdit | OverviewEdit;

/** What a write is about: a record, and the one field it changed when it changed one. */
export interface StepKey {
  slice: SliceName;
  id?: string;
  field?: string;
}

export interface Step {
  edits: SliceEdit[];
  key?: StepKey;
  /** A group or batch label, which replaces the derived one. */
  label?: string;
  /** When the latest write merged into this Step was recorded. */
  at: number;
  tick?: number;
  /** Edits of Steps the cap dropped. They undo with this Step, so the head still restores the baseline. */
  carry?: SliceEdit[];
}

export interface EditorHistory {
  steps: Step[];
  /** How many Steps are applied. 0 is the World opened head. */
  cursor: number;
  /** The cursor position at the last save, or null when no position matches it. */
  saved: number | null;
  group: { label?: string; started: boolean } | null;
  /** The next write starts a new Step whatever its key or tick. */
  sealed: boolean;
  pauseMs: number;
}

/** How far back the editor remembers. */
export const HISTORY_LIMIT = 100;
export const DEFAULT_PAUSE_MS = 1000;

export function createHistory(options: { pauseMs?: number } = {}): EditorHistory {
  return {
    steps: [], cursor: 0, saved: null, group: null, sealed: false, pauseMs: options.pauseMs ?? DEFAULT_PAUSE_MS,
  };
}

export type HistoryMove = "undo" | "redo";

type IdRecord = { id: string };
type IdRecordEdit = { slice: RecordSliceName; before: IdRecord[]; after: IdRecord[]; beforeOrder: string[]; afterOrder: string[] };

const byId = (records: IdRecord[]) => new Map(records.map((record) => [record.id, record]));

/** The ids a record edit added, removed or rewrote. */
export const touchedIds = (edit: RecordEdit | IdRecordEdit) =>
  new Set([...edit.before, ...edit.after].map((record) => record.id));

// WorldOverview has no index signature, so field-by-field reads and writes go through this view.
const fieldsOf = (overview: WorldOverview) => overview as unknown as Record<string, unknown>;

/** The change between two versions of a slice, compared by reference, or null when nothing changed. */
export function diffSlice<S extends SliceName>(slice: S, prev: WorldSlices[S], next: WorldSlices[S]): SliceEdit | null {
  if (prev === next) return null;
  if (slice === "worldOverview") {
    const before = prev as WorldOverview;
    const after = next as WorldOverview;
    return changedFields(before, after).length ? { slice: "worldOverview", before, after } : null;
  }
  const prevRecords = prev as IdRecord[];
  const nextRecords = next as IdRecord[];
  const prevById = byId(prevRecords);
  const nextById = byId(nextRecords);
  const touched = (record: IdRecord) => prevById.get(record.id) !== nextById.get(record.id);
  const edit: IdRecordEdit = {
    slice: slice as RecordSliceName,
    before: prevRecords.filter(touched),
    after: nextRecords.filter(touched),
    beforeOrder: prevRecords.map((record) => record.id),
    afterOrder: nextRecords.map((record) => record.id),
  };
  if (!edit.before.length && !edit.after.length && sameOrder(edit.beforeOrder, edit.afterOrder)) return null;
  return edit as RecordEdit;
}

/** The fields of a record or the overview whose values differ by reference. */
export function changedFields(before: object, after: object): string[] {
  const [was, now] = [before as Record<string, unknown>, after as Record<string, unknown>];
  const keys = new Set([...Object.keys(was), ...Object.keys(now)]);
  return [...keys].filter((key) => was[key] !== now[key]);
}

/** A write's merge key: the record, and the field when the write changed exactly one. */
export function writeKey(slice: SliceName, id: string | undefined, was: object | undefined, now: object): StepKey {
  const fields = was ? changedFields(was, now) : [];
  return fields.length === 1 ? { slice, id, field: fields[0] } : { slice, id };
}

const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/** Whether the ids both orders share sit in a different sequence. */
function reordered(target: string[], source: string[]): boolean {
  const inSource = new Set(source);
  const inTarget = new Set(target);
  return !sameOrder(target.filter((id) => inSource.has(id)), source.filter((id) => inTarget.has(id)));
}

/** The records the order names, rearranged into its sequence inside the slots they hold now. */
function reorderSlots(records: IdRecord[], order: string[]): IdRecord[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  const ranked = records.filter((record) => rank.has(record.id))
    .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  let next = 0;
  return records.map((record) => (rank.has(record.id) ? ranked[next++] : record));
}

/** A returning record goes after its nearest earlier neighbor in the order, or before its nearest later one. */
function insertAtPlace(records: IdRecord[], record: IdRecord, order: string[]): IdRecord[] {
  const at = order.indexOf(record.id);
  const position = new Map(records.map((r, i) => [r.id, i]));
  for (let i = at - 1; i >= 0; i -= 1) {
    const found = position.get(order[i]);
    if (found !== undefined) return [...records.slice(0, found + 1), record, ...records.slice(found + 1)];
  }
  for (let i = at + 1; i < order.length; i += 1) {
    const found = position.get(order[i]);
    if (found !== undefined) return [...records.slice(0, found), record, ...records.slice(found)];
  }
  return [...records, record];
}

function restoreRecords(current: IdRecord[], edit: IdRecordEdit, toBefore: boolean): IdRecord[] {
  const [target, targetOrder, sourceOrder] = toBefore
    ? [edit.before, edit.beforeOrder, edit.afterOrder]
    : [edit.after, edit.afterOrder, edit.beforeOrder];
  const targetById = byId(target);
  const touched = touchedIds(edit);
  let next = current.flatMap((record) => {
    if (!touched.has(record.id)) return [record];
    const restored = targetById.get(record.id);
    return restored ? [restored] : [];
  });
  if (reordered(targetOrder, sourceOrder)) next = reorderSlots(next, targetOrder);
  const present = new Set(next.map((record) => record.id));
  for (const id of targetOrder) {
    const record = targetById.get(id);
    if (record && !present.has(id)) next = insertAtPlace(next, record, targetOrder);
  }
  return next;
}

function restoreOverview(current: WorldOverview, edit: OverviewEdit, toBefore: boolean): WorldOverview {
  const target = fieldsOf(toBefore ? edit.before : edit.after);
  const next = { ...current };
  for (const field of changedFields(edit.before, edit.after)) {
    if (field in target) fieldsOf(next)[field] = target[field];
    else delete fieldsOf(next)[field];
  }
  return next;
}

/** One slice edit put back (undo) or forward (redo) onto the slice as it stands now. */
export function restoreSlice<S extends SliceName>(
  edit: SliceEdit & { slice: S }, current: WorldSlices[S], direction: HistoryMove,
): WorldSlices[S] {
  const toBefore = direction === "undo";
  if (edit.slice === "worldOverview") {
    return restoreOverview(current as WorldOverview, edit as OverviewEdit, toBefore) as WorldSlices[S];
  }
  return restoreRecords(current as IdRecord[], edit as IdRecordEdit, toBefore) as WorldSlices[S];
}

function combineRecordEdits(first: IdRecordEdit, second: IdRecordEdit): IdRecordEdit {
  const firstTouched = touchedIds(first);
  const secondTouched = touchedIds(second);
  const [firstBefore, firstAfter] = [byId(first.before), byId(first.after)];
  const [secondBefore, secondAfter] = [byId(second.before), byId(second.after)];
  const before: IdRecord[] = [];
  const after: IdRecord[] = [];
  for (const id of new Set([...firstTouched, ...secondTouched])) {
    const was = firstTouched.has(id) ? firstBefore.get(id) : secondBefore.get(id);
    const became = secondTouched.has(id) ? secondAfter.get(id) : firstAfter.get(id);
    if (was === became) continue;
    if (was) before.push(was);
    if (became) after.push(became);
  }
  return { slice: first.slice, before, after, beforeOrder: first.beforeOrder, afterOrder: second.afterOrder };
}

/** Two runs of edits as one: each slice from its first state to its last. */
export function combineEdits(first: SliceEdit[], second: SliceEdit[]): SliceEdit[] {
  const combined = [...first];
  for (const edit of second) {
    const at = combined.findIndex((existing) => existing.slice === edit.slice);
    if (at < 0) combined.push(edit);
    else if (edit.slice === "worldOverview") combined[at] = { ...(combined[at] as OverviewEdit), after: edit.after };
    else combined[at] = combineRecordEdits(combined[at] as IdRecordEdit, edit as IdRecordEdit) as RecordEdit;
  }
  return combined;
}

const sameKey = (a?: StepKey, b?: StepKey) => !!a && !!b && a.slice === b.slice && a.id === b.id && a.field === b.field;

export interface RecordOptions {
  key?: StepKey;
  /** The event-loop tick the write landed in; writes that share one fold into one Step. */
  tick?: number;
  now?: number;
}

/**
 * Remembers a write and drops the undone future. Merge precedence, highest first: an open group swallows every
 * write; a keyed write joins the previous Step when the key matches within the pause; a write in the previous
 * Step's tick folds into it.
 */
export function record(history: EditorHistory, edits: SliceEdit[], options: RecordOptions = {}): EditorHistory {
  if (!edits.length) return history;
  const now = options.now ?? Date.now();
  const steps = history.steps.slice(0, history.cursor);
  const top = steps[steps.length - 1];
  const saved = history.saved !== null && history.saved > steps.length ? null : history.saved;
  const merge = (step: Step): EditorHistory => {
    steps[steps.length - 1] = { ...step, edits: combineEdits(step.edits, edits), at: now, tick: options.tick };
    // A group that swallows a write past the marker leaves no row that matches the save.
    return { ...history, steps, saved: saved === steps.length ? null : saved, sealed: false };
  };

  if (history.group?.started && top) return merge(top);
  if (!history.group && !history.sealed && top) {
    if (sameKey(options.key, top.key) && now - top.at < history.pauseMs) return merge(top);
    if (options.tick !== undefined && top.tick === options.tick) return merge(top);
  }

  const step: Step = { edits, at: now, tick: options.tick };
  if (history.group) step.label = history.group.label;
  else if (options.key) step.key = options.key;
  steps.push(step);
  return capped({
    ...history, steps, cursor: steps.length, saved, sealed: false,
    group: history.group ? { ...history.group, started: true } : null,
  });
}

function capped(history: EditorHistory): EditorHistory {
  if (history.steps.length <= HISTORY_LIMIT) return history;
  const [dropped, next, ...rest] = history.steps;
  const carry = combineEdits(dropped.carry ?? [], dropped.edits);
  // The head still means the baseline, so a marker there stays; one on the dropped Step has no row left.
  const saved = history.saved === null || history.saved === 0 ? history.saved
    : history.saved === 1 ? null : history.saved - 1;
  return { ...history, steps: [{ ...next, carry: combineEdits(carry, next.carry ?? []) }, ...rest], cursor: history.cursor - 1, saved };
}

/** Opens a group: every write until `endGroup` is one Step, labeled when a label is given. A group already
 *  open stays as it is. */
export function beginGroup(history: EditorHistory, label?: string): EditorHistory {
  return history.group ? history : { ...history, group: { label, started: false } };
}

/** Closes the group, so the next write starts a new Step. */
export function endGroup(history: EditorHistory): EditorHistory {
  return history.group ? { ...history, group: null, sealed: history.group.started || history.sealed } : history;
}

/** Places the Saved marker at the cursor. The next write starts a new Step after it. */
export function markSaved(history: EditorHistory): EditorHistory {
  return { ...history, saved: history.cursor, sealed: true };
}

/** Every record the map names swapped for its replacement, in every Step. The order and the cursor stay. */
export function replaceRecords(history: EditorHistory, replacements: ReadonlyMap<object, object>): EditorHistory {
  if (!replacements.size) return history;
  const swap = (edits: SliceEdit[] | undefined) => edits?.map((edit): SliceEdit => {
    if (edit.slice === "worldOverview") return edit;
    const records = (list: IdRecord[]) => list.map((record) => (replacements.get(record) as IdRecord | undefined) ?? record);
    return { ...edit, before: records(edit.before as IdRecord[]), after: records(edit.after as IdRecord[]) } as RecordEdit;
  });
  return {
    ...history,
    steps: history.steps.map((step) => ({
      ...step, edits: swap(step.edits)!, ...(step.carry ? { carry: swap(step.carry) } : {}),
    })),
  };
}

export const canUndo = (history: EditorHistory) => history.cursor > 0;
export const canRedo = (history: EditorHistory) => history.cursor < history.steps.length;

/** What a move writes back: the slices it changed, as they now read. */
export type WorldRestore = Partial<WorldSlices>;

function applyStep(world: WorldSlices, step: Step, direction: HistoryMove, restore: WorldRestore) {
  const own = direction === "undo" ? [...step.edits].reverse() : step.edits;
  const carry = step.carry ?? [];
  const edits = direction === "undo" ? [...own, ...[...carry].reverse()] : [...carry, ...own];
  for (const edit of edits) {
    const next = restoreSlice(edit, world[edit.slice], direction);
    // The slice name is a union here, so TS cannot pair it with its value type.
    (world as unknown as Record<SliceName, unknown>)[edit.slice] = next;
    (restore as Record<SliceName, unknown>)[edit.slice] = next;
  }
}

/**
 * Moves the cursor to any position, undoing or redoing the Steps between, against the world as it stands.
 * Position 0 is the World opened head, which restores the loaded baseline.
 */
export function jumpTo(
  history: EditorHistory, world: WorldSlices, target: number,
): { history: EditorHistory; restore: WorldRestore; steps: Step[] } | null {
  const to = Math.max(0, Math.min(target, history.steps.length));
  if (to === history.cursor) return null;
  const working = { ...world };
  const restore: WorldRestore = {};
  const moved: Step[] = [];
  if (to < history.cursor) {
    for (let i = history.cursor - 1; i >= to; i -= 1) {
      applyStep(working, history.steps[i], "undo", restore);
      moved.push(history.steps[i]);
    }
  } else {
    for (let i = history.cursor; i < to; i += 1) {
      applyStep(working, history.steps[i], "redo", restore);
      moved.push(history.steps[i]);
    }
  }
  return { history: { ...history, cursor: to, group: null, sealed: true }, restore, steps: moved };
}

export function undo(history: EditorHistory, world: WorldSlices) {
  return jumpTo(history, world, history.cursor - 1);
}

export function redo(history: EditorHistory, world: WorldSlices) {
  return canRedo(history) ? jumpTo(history, world, history.cursor + 1) : null;
}

/** Which of the two the keyboard asked for. Ctrl+Y and Ctrl+Shift+Z both redo. */
export function historyShortcut(
  event: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "key">,
): HistoryMove | null {
  if (!event.ctrlKey && !event.metaKey) return null;
  const key = event.key.toLowerCase();
  if (key === "y") return "redo";
  if (key !== "z") return null;
  return event.shiftKey ? "redo" : "undo";
}
