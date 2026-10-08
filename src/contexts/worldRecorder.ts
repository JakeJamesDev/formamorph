import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  canRedo, canUndo, createHistory, diffSlice, jumpTo, markSaved, record, replaceRecords, WORLD_SLICES,
  type EditorHistory, type SliceEdit, type SliceName, type StepKey, type WorldSlices,
} from '@/lib/editorHistory';

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
  /** What the write is about, so a run of writes to one record and field merges into one Step. */
  key?: StepKey;
  /** Save's link stamps: never recorded, and the Steps that hold the stamped records take the stamped copies. */
  stamp?: boolean;
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

export interface WorldHistoryControls {
  store: HistoryStore;
  undo(): void;
  redo(): void;
  /** Moves the world to a list position. 0 is the World opened head. */
  jump(position: number): void;
  /** Keys the next write, which must follow in the same event. */
  keyNext(key: StepKey): void;
  /** Starts the stack over, as when the editor closes. */
  clear(): void;
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
  // The tick a close cleared the stack in: what the closing editor still writes in it is not an edit.
  const closedIn = useRef<number | null>(null);
  const reset = useCallback(() => {
    store.set(createHistory());
    last.current = { recorded: false };
  }, [store]);

  useLayoutEffect(() => {
    const before = seen.current;
    seen.current = slices;
    const { history: moved, follow, key, stamp } = intent.current;
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
    const at = follow ? last.current.tick : currentTick();
    // A key whose slice did not change belongs to a write that bailed, so it never keys another one.
    const keyed = !follow && key && edits.some((edit) => edit.slice === key.slice) ? key : undefined;
    store.set(record(store.get(), edits, { tick: at, key: keyed }));
    last.current = { recorded: true, tick: at };
  }, [slices, worldId, store, reset]);

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

  const jump = useCallback((position: number) => {
    const moved = jumpTo(store.get(), seen.current, position);
    if (!moved) return;
    intent.current = { ...intent.current, history: true };
    // A second move before the commit reads the world this one leaves.
    seen.current = { ...seen.current, ...moved.restore };
    const write = settersRef.current as Record<SliceName, (value: unknown) => void>;
    for (const slice of Object.keys(moved.restore) as SliceName[]) write[slice](moved.restore[slice]);
    store.set(moved.history);
  }, [store]);
  const undo = useCallback(() => jump(store.get().cursor - 1), [jump, store]);
  const redo = useCallback(() => jump(store.get().cursor + 1), [jump, store]);

  const keyNext = useCallback((key: StepKey) => { intent.current = { ...intent.current, key }; }, []);

  const controls = useMemo<WorldHistoryControls>(
    () => ({ store, undo, redo, jump, keyNext, clear }),
    [store, undo, redo, jump, keyNext, clear],
  );
  return { intent, controls, disarm, beginSave };
}

export const WorldHistoryContext = createContext<WorldHistoryControls | null>(null);

/** Only the moves and the key channel, which keep one identity, so a caller does not re-render when the history changes. */
export function useWorldHistoryMoves(): Pick<WorldHistoryControls, 'undo' | 'redo' | 'jump' | 'keyNext' | 'clear'> {
  const controls = useContext(WorldHistoryContext);
  if (!controls) throw new Error('useWorldHistoryMoves must be used within a GameDataProvider');
  return controls;
}

/** The open world's history: where the cursor stands, the Steps, and the moves. Throws outside a world. */
export function useWorldHistory() {
  const controls = useContext(WorldHistoryContext);
  if (!controls) throw new Error('useWorldHistory must be used within a GameDataProvider');
  const { store, undo, redo, jump, keyNext, clear } = controls;
  const history = useSyncExternalStore(store.subscribe, store.get);
  return {
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    steps: history.steps,
    cursor: history.cursor,
    saved: history.saved,
    undo, redo, jump, keyNext, clear,
  };
}
