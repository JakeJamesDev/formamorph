import {
  createContext, startTransition, type MutableRefObject, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  useSyncExternalStore,
} from 'react';
import { useMountedRef } from '@/lib/useMountedRef';
import {
  beginGroup as openGroup, canRedo, canUndo, createHistory, diffSlice, endGroup as closeGroup, jumpTo, markSaved, movedTexts,
  record, recordFieldMove, replaceRecords, settleKey, WORLD_SLICES,
  type EditorHistory, type SliceEdit, type SliceName, type Step, type StepKey, type StepOrigin, type WorldSlices,
} from '@/lib/editorHistory';
import type { CommittedChange } from '@/lib/changeMeter';

/**
 * Records the open world's history after each commit. Every action is a deferred setter, so nothing can be
 * captured around the call: the recorder diffs the committed slices against the last ones it saw, by
 * reference, and so sees every write, also those that bypass the actions object.
 */

/** What the next commit means to the recorder. A writer sets it just before its setter runs. */
export interface WriteIntent {
  /** An undo, redo or jump: never recorded. */
  history?: boolean;
  /** A pass that follows the commit before it: joins that commit's Step, or stays unrecorded with it. */
  follow?: boolean;
  /** The record the write is about. The first key set before a commit wins; the commit settles the field. */
  key?: StepKey;
  /** Save's link stamps: never recorded, and the Steps that hold the stamped records take the stamped copies. */
  stamp?: boolean;
  /** The tick a text field's own undo or redo wrote in: a move or a join on the Step it matches, a plain write otherwise. */
  fieldHistory?: number;
}

export type WorldSetters = { [S in SliceName]: (value: WorldSlices[S]) => void };

interface HistoryStore {
  get(): EditorHistory;
  set(next: EditorHistory): void;
  subscribe(listener: () => void): () => void;
}

function createHistoryStore(): HistoryStore {
  let history = createHistory();
  const listeners = new Set<() => void>();
  return {
    get: () => history,
    set(next) {
      if (next === history) return;
      history = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

// Commits in one event-loop task share a tick; a message, queued as the next task, starts the next one.
// Not a timer, so fake timers in tests never freeze it.
let tick = 0;
let tickQueued = false;
const tickChannel = new MessageChannel();
tickChannel.port1.onmessage = () => { tick += 1; tickQueued = false; };
// Node keeps a process alive for a listening port; a browser has no such method.
(tickChannel.port1 as { unref?: () => void }).unref?.();
function currentTick(): number {
  if (!tickQueued) {
    tickQueued = true;
    tickChannel.port2.postMessage(null);
  }
  return tick;
}

const NO_TEXTS: ReadonlySet<string> = new Set();

/** Whether the two versions of a record differ in their link and nothing else. */
function onlyLinkDiffers(was: object, now: object): boolean {
  const a = was as Record<string, unknown>;
  const b = now as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every((key) => key === 'link' || a[key] === b[key]);
}

/** A save's stamps, each against the record it replaced, apart from the edits that came with them. */
function splitStamps(edits: SliceEdit[]): { swaps: Map<object, object>; rest: SliceEdit[] } {
  const swaps = new Map<object, object>();
  const rest: SliceEdit[] = [];
  for (const edit of edits) {
    if (edit.slice === 'worldOverview') { rest.push(edit); continue; }
    const after = new Map(edit.after.map((record) => [record.id, record]));
    const stamped = new Set<string>();
    for (const was of edit.before) {
      const now = after.get(was.id);
      if (now && onlyLinkDiffers(was, now)) { swaps.set(was, now); stamped.add(was.id); }
    }
    const before = edit.before.filter((record) => !stamped.has(record.id));
    const left = edit.after.filter((record) => !stamped.has(record.id));
    const reordered = edit.beforeOrder.some((id, i) => id !== edit.afterOrder[i]);
    if (before.length || left.length || reordered) rest.push({ ...edit, before, after: left } as SliceEdit);
  }
  return { swaps, rest };
}

/** A move that changed the cursor: the Steps it crossed, and the slices as the move left them. */
export interface HistoryMoveEvent {
  steps: Step[];
  world: WorldSlices;
}

export interface WorldHistoryControls {
  store: HistoryStore;
  /** The World Editor's place as of its last commit, which a new Step takes as its Origin. Null with no editor open. */
  place: MutableRefObject<StepOrigin | null>;
  undo(): void;
  redo(): void;
  /** Moves the world to a list position. 0 is the World opened head. */
  jump(position: number): void;
  /** Names the record and field the next write is about, for a write that goes through a whole-slice setter. */
  keyNext(key: StepKey): void;
  /** Says the next write in this tick is a text field's own undo or redo. */
  markFieldHistory(): void;
  /** Whether a field's new text is what the last undo, redo or jump wrote, with no write recorded since. */
  isRestoredText(text: string): boolean;
  /** Starts the stack over, as when the editor closes. */
  clear(): void;
  /** Hears each move as it happens. Returns the call that stops listening. */
  onMove(listener: (move: HistoryMoveEvent) => void): () => void;
  /** Hears each change to the world the recorder sees: recorded writes and moves, never loads or save stamps. */
  onChange(listener: (change: CommittedChange) => void): () => void;
  /** Opens a group: every write until `endGroup` is one Step, labeled when a label is given. */
  beginGroup(label?: string): void;
  /** Closes the group after every write already queued has committed, so the gesture's last one lands inside. */
  endGroup(): Promise<void>;
  /** Runs an operation as one labeled Step, however many ticks it writes across. */
  batch(label: string, run: () => void | Promise<void>): Promise<void>;
}

/**
 * The open world's recorder. `intent` is the side channel writers set before a setter. The stack starts over
 * when another world opens, and when a load runs: `disarm` before its writes, then the next `baseline` re-arms.
 */
export function useWorldRecorder(slices: WorldSlices, worldId: string | null, setters: WorldSetters, baseline: object | null = null) {
  const [store] = useState(createHistoryStore);
  const intent = useRef<WriteIntent>({});
  const seen = useRef(slices);
  const openWorld = useRef(worldId);
  const last = useRef<{ recorded: boolean; tick?: number }>({ recorded: false });
  const armed = useRef(true);
  const place = useRef<StepOrigin | null>(null);
  // A labeled batch spans the world, so its Step has no one place to return to.
  const batching = useRef(false);
  // The tick a close cleared the stack in: what the closing editor still writes in it is not an edit.
  const closedIn = useRef<number | null>(null);
  // The text the last move wrote, until the next recorded write. A field rebuilt to it is restoring, not editing.
  const restored = useRef<ReadonlySet<string>>(NO_TEXTS);
  const reset = useCallback(() => {
    store.set(createHistory());
    last.current = { recorded: false };
    restored.current = NO_TEXTS;
  }, [store]);
  const changeListeners = useRef(new Set<(change: CommittedChange) => void>());
  const emitChange = useCallback((change: CommittedChange) => {
    for (const listener of changeListeners.current) listener(change);
  }, []);
  const onChange = useCallback((listener: (change: CommittedChange) => void) => {
    changeListeners.current.add(listener);
    return () => { changeListeners.current.delete(listener); };
  }, []);

  useLayoutEffect(() => {
    const before = seen.current;
    seen.current = slices;
    const { history: moved, follow, key, stamp, fieldHistory } = intent.current;
    intent.current = {};
    if (worldId !== openWorld.current) {
      openWorld.current = worldId;
      reset();
      return;
    }
    if (!armed.current) return;
    if (closedIn.current !== null && closedIn.current === currentTick()) return;
    if (follow && !last.current.recorded) return;
    // A move already set `seen` to the world it writes, so only a write batched with it shows here.
    if (moved) last.current = { recorded: false };
    let edits = WORLD_SLICES
      .map((slice) => diffSlice(slice, before[slice], slices[slice]))
      .filter((edit): edit is SliceEdit => edit !== null);
    if (stamp) {
      // Only the link changes are stamps; a real edit that commits with them is still recorded.
      const split = splitStamps(edits);
      store.set(replaceRecords(store.get(), split.swaps));
      edits = split.rest;
    }
    if (!edits.length) return;
    restored.current = NO_TEXTS;
    const at = follow ? last.current.tick : currentTick();
    // A key whose record did not change belongs to a write that bailed, so it never keys another one.
    const fits = !follow && key && edits.some((edit) => keyHolders(key).includes(edit.slice));
    const settled = fits ? settleKey(key, edits, keyHolders(key)) : undefined;
    const was = store.get();
    // A mark left by a field write that never reached the world is from an earlier tick.
    const fieldMove = !follow && fieldHistory === at ? recordFieldMove(was, edits, settled) : null;
    if (fieldMove) {
      store.set(fieldMove);
      // A join is a recorded write that a follow pass joins too; a cursor move is not.
      const joined = fieldMove.cursor === was.cursor;
      last.current = joined ? { recorded: true, tick: at } : { recorded: false };
      emitChange({ edits, merged: joined });
      return;
    }
    const origin = batching.current ? undefined : place.current ?? undefined;
    const next = record(was, edits, { tick: at, key: settled, origin });
    store.set(next);
    last.current = { recorded: true, tick: at };
    // A new Step holds the edits as given; a merge combines them into the Step before.
    emitChange({ edits, merged: next.steps[next.cursor - 1]?.edits !== edits });
  }, [slices, worldId, store, reset, emitChange]);

  // After the load's commit: its baseline is set, so the stack starts over and recording resumes.
  useLayoutEffect(() => {
    if (armed.current) return;
    armed.current = true;
    reset();
  }, [baseline, reset]);

  const disarm = useCallback(() => { armed.current = false; }, []);
  const clear = useCallback(() => {
    reset();
    closedIn.current = currentTick();
  }, [reset]);
  /** Starts a save. The returned function places the Saved marker where the saved world stood. */
  const beginSave = useCallback(() => {
    const started = store.get();
    return () => {
      const now = store.get();
      const at = started.cursor;
      // A write that merged into the Step the save read leaves no row for the saved world.
      if (at > 0 && now.steps[at - 1] !== started.steps[at - 1]) store.set({ ...now, saved: null });
      else store.set(at === now.cursor ? markSaved(now) : { ...now, saved: at });
    };
  }, [store]);

  const settersRef = useRef(setters);
  useLayoutEffect(() => { settersRef.current = setters; });

  const moveListeners = useRef(new Set<(move: HistoryMoveEvent) => void>());
  const onMove = useCallback((listener: (move: HistoryMoveEvent) => void) => {
    moveListeners.current.add(listener);
    return () => { moveListeners.current.delete(listener); };
  }, []);

  const jump = useCallback((position: number) => {
    const moved = jumpTo(store.get(), seen.current, position);
    if (!moved) return;
    intent.current = { ...intent.current, history: true };
    restored.current = movedTexts(moved.steps);
    const from = seen.current;
    // A second move before the commit reads the world this one leaves.
    seen.current = { ...seen.current, ...moved.restore };
    const edits = (Object.keys(moved.restore) as SliceName[])
      .map((slice) => diffSlice(slice, from[slice], seen.current[slice]))
      .filter((edit): edit is SliceEdit => edit !== null);
    if (edits.length) emitChange({ edits, merged: false });
    const write = settersRef.current as Record<SliceName, (value: unknown) => void>;
    for (const slice of Object.keys(moved.restore) as SliceName[]) write[slice](moved.restore[slice]);
    store.set(moved.history);
    for (const listener of moveListeners.current) listener({ steps: moved.steps, world: seen.current });
  }, [store, emitChange]);
  const undo = useCallback(() => jump(store.get().cursor - 1), [jump, store]);
  const redo = useCallback(() => jump(store.get().cursor + 1), [jump, store]);

  const keyNext = useCallback((key: StepKey) => { intent.current.key ??= key; }, []);
  const markFieldHistory = useCallback(() => { intent.current.fieldHistory = currentTick(); }, []);
  const isRestoredText = useCallback((text: string) => restored.current.has(text), []);
  const beginGroup = useCallback((label?: string) => store.set(openGroup(store.get(), label)), [store]);
  // A transition commits after the writes queued before it, and this effect runs after the recorder's.
  const endWaiters = useRef<(() => void)[]>([]);
  const settleEndWaiters = useCallback(() => {
    const waiters = endWaiters.current;
    endWaiters.current = [];
    for (const resolve of waiters) resolve();
  }, []);
  const [endRequest, setEndRequest] = useState(0);
  useLayoutEffect(() => {
    if (!endWaiters.current.length) return;
    store.set(closeGroup(store.get()));
    settleEndWaiters();
  }, [endRequest, store, settleEndWaiters]);
  // An unmounted recorder never commits again, so a wait for its commit settles at once.
  const mounted = useMountedRef();
  useEffect(() => settleEndWaiters, [settleEndWaiters]);
  const endGroup = useCallback(() => new Promise<void>((resolve) => {
    if (!mounted.current) { resolve(); return; }
    endWaiters.current.push(resolve);
    startTransition(() => setEndRequest((n) => n + 1));
  }), [mounted]);
  const batch = useCallback(async (label: string, run: () => void | Promise<void>) => {
    beginGroup(label);
    batching.current = true;
    try {
      await run();
    } finally {
      await endGroup();
      batching.current = false;
    }
  }, [beginGroup, endGroup]);

  const controls = useMemo<WorldHistoryControls>(
    () => ({ store, place, undo, redo, jump, keyNext, markFieldHistory, isRestoredText, clear, onMove, onChange, beginGroup, endGroup, batch }),
    [store, undo, redo, jump, keyNext, markFieldHistory, isRestoredText, clear, onMove, onChange, beginGroup, endGroup, batch],
  );
  return { intent, controls, disarm, beginSave };
}

/** The slices a keyed record can live in: a placeholder also sits inside an entity or a book as a Copy. */
const keyHolders = (key: StepKey): SliceName[] =>
  key.slice === 'placeholders' ? ['placeholders', 'entities', 'dictionaries'] : [key.slice];

export const WorldHistoryContext = createContext<WorldHistoryControls | null>(null);

/** The moves, the key, the groups, clear and the move listener, which keep one identity, so a caller does not re-render when the history changes. */
export function useWorldHistoryMoves(): Omit<WorldHistoryControls, 'store'> {
  const controls = useContext(WorldHistoryContext);
  if (!controls) throw new Error('useWorldHistoryMoves must be used within a GameDataProvider');
  return controls;
}

/** The same, or null under a library editor's NoWorld. */
export const useWorldHistoryMovesOptional = (): Omit<WorldHistoryControls, 'store'> | null =>
  useContext(WorldHistoryContext);

/** The open world's history: where the cursor stands, the Steps, and the moves. Throws outside a world. */
export function useWorldHistory() {
  const controls = useContext(WorldHistoryContext);
  if (!controls) throw new Error('useWorldHistory must be used within a GameDataProvider');
  const { store, ...moves } = controls;
  const history = useSyncExternalStore(store.subscribe, store.get);
  return {
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    steps: history.steps,
    cursor: history.cursor,
    saved: history.saved,
    ...moves,
  };
}
