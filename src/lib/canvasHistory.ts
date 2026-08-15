import type { Connection, GameLocation } from "@/types";

/**
 * The canvas's own undo stack. An edit made on the map is a whole-slice rewrite — the locations array or the
 * connections array as it was, and as it became — so undoing one is writing the earlier array back through the
 * same editor path the edit itself took. That is what makes a multi-drag and an Auto Arrange one step each,
 * however many records they moved, and what keeps the list view agreeing afterwards: both surfaces are reading
 * the array that was just restored.
 *
 * A step carries the whole slice but is applied as the records it changed, so an edit made in the list panel
 * between an edit and its undo is still there afterwards.
 *
 * Session-only and capped: this is a working aid for the map, not a document history, and nothing here is
 * stored with the world. Saving does not touch it, so undoing past a save simply makes the world dirty again.
 */

/** How far back the map remembers. Older steps fall off the bottom rather than growing without end. */
export const CANVAS_HISTORY_LIMIT = 100;

/** One edit, as the two versions of the slice it rewrote. */
export type CanvasEdit =
  | { slice: "locations"; before: GameLocation[]; after: GameLocation[]; mergeKey?: string }
  | { slice: "connections"; before: Connection[]; after: Connection[]; mergeKey?: string };

/** What undoing or redoing asks the editor to write back. */
export type CanvasRestore =
  | { slice: "locations"; locations: GameLocation[] }
  | { slice: "connections"; connections: Connection[] };

export interface CanvasHistory {
  past: CanvasEdit[];
  future: CanvasEdit[];
}

export const EMPTY_CANVAS_HISTORY: CanvasHistory = { past: [], future: [] };

/** The two arrays a step is undone against — the world as it stands now, not as the edit left it. */
export interface CanvasWorld {
  locations: GameLocation[];
  connections: Connection[];
}

/**
 * One step's records put back onto the world as it stands, rather than the whole array as it stood. Only the
 * ids the step itself changed are touched — one it added is dropped, one it removed comes back, one it
 * rewrote is written back — so an edit made in the list panel in the meantime is still there afterwards.
 */
function patched<T extends { id: string }>(current: T[], from: T[], to: T[]): T[] {
  const fromById = new Map(from.map((record) => [record.id, record]));
  const toById = new Map(to.map((record) => [record.id, record]));
  const touched = (id: string) => fromById.get(id) !== toById.get(id);
  const kept = current
    .filter((record) => !touched(record.id) || fromById.has(record.id))
    .map((record) => (touched(record.id) ? fromById.get(record.id)! : record));
  const present = new Set(kept.map((record) => record.id));
  // What the step had removed comes back at the end: only Connections are ever added or removed here, and
  // their order says nothing.
  const returning = from.filter((record) => touched(record.id) && !present.has(record.id));
  return returning.length ? [...kept, ...returning] : kept;
}

const restore = (edit: CanvasEdit, world: CanvasWorld, back: boolean): CanvasRestore => {
  if (edit.slice === "locations") {
    const [from, to] = back ? [edit.before, edit.after] : [edit.after, edit.before];
    return { slice: "locations", locations: patched(world.locations, from, to) };
  }
  const [from, to] = back ? [edit.before, edit.after] : [edit.after, edit.before];
  return { slice: "connections", connections: patched(world.connections, from, to) };
};

/**
 * Remembers an edit, and drops whatever had been undone — the map has taken a new turn, so there is no longer
 * a forward to return to.
 *
 * A `mergeKey` folds an edit into the one before it when both carry the same key: typing a travel hint is one
 * edit an author would expect back in one press, not one per letter. Only consecutive edits merge, so a keyed
 * edit with anything in between starts its own step.
 */
export function recordCanvasEdit(history: CanvasHistory, edit: CanvasEdit): CanvasHistory {
  const last = history.past[history.past.length - 1];
  if (edit.mergeKey && last?.mergeKey === edit.mergeKey && last.slice === edit.slice) {
    // The merged step still undoes to where the run began, so its own `before` is the one that is kept.
    const merged = { ...last, after: edit.after } as CanvasEdit;
    return { past: [...history.past.slice(0, -1), merged], future: [] };
  }
  const past = [...history.past, edit];
  return { past: past.slice(-CANVAS_HISTORY_LIMIT), future: [] };
}

/** The last edit, undone: what to write back, and the stack with that step moved forward. */
export function undoCanvasEdit(
  history: CanvasHistory,
  world: CanvasWorld,
): { history: CanvasHistory; restore: CanvasRestore } | null {
  const edit = history.past[history.past.length - 1];
  if (!edit) return null;
  return {
    history: { past: history.past.slice(0, -1), future: [...history.future, edit] },
    restore: restore(edit, world, true),
  };
}

/** The last undone edit, put back. */
export function redoCanvasEdit(
  history: CanvasHistory,
  world: CanvasWorld,
): { history: CanvasHistory; restore: CanvasRestore } | null {
  const edit = history.future[history.future.length - 1];
  if (!edit) return null;
  return {
    history: { past: [...history.past, edit], future: history.future.slice(0, -1) },
    restore: restore(edit, world, false),
  };
}

// The stack the canvas picks up when it is mounted. Leaving the map for the list panel and coming back is not
// the end of the author's session, and the canvas is unmounted on the way, so the stack is held out here
// instead of in it. One world at a time: another world's arrays are not a shape these steps could restore, so
// opening one starts the session over.
let openWorld: string | null | undefined;
let openStack = { current: EMPTY_CANVAS_HISTORY };

/** The open world's stack, as the mutable handle a component can hold onto across its own remounts. */
export function canvasHistoryFor(worldId: string | null): { current: CanvasHistory } {
  if (worldId !== openWorld) {
    openWorld = worldId;
    openStack = { current: EMPTY_CANVAS_HISTORY };
  }
  return openStack;
}

/**
 * Which of the two the keyboard just asked for. Ctrl+Y and Ctrl+Shift+Z both redo, since authors arrive from
 * editors that use one or the other. Whether the canvas is the surface being worked on is the caller's
 * question — this only reads the chord.
 */
export function historyShortcut(
  event: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "key">,
): "undo" | "redo" | null {
  if (!event.ctrlKey && !event.metaKey) return null;
  const key = event.key.toLowerCase();
  if (key === "y") return "redo";
  if (key !== "z") return null;
  return event.shiftKey ? "redo" : "undo";
}
