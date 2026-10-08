import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  canRedo, canUndo, createHistory, diffSlice, jumpTo, record, WORLD_SLICES,
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

export interface WorldHistoryControls {
  store: HistoryStore;
  undo(): void;
  redo(): void;
  /** Moves the world to a list position. 0 is the World opened head. */
  jump(position: number): void;
  /** Keys the next write, which must follow in the same event. */
  keyNext(key: StepKey): void;
}

/**
 * The open world's recorder. `intent` is the side channel writers set before a setter; the stack starts over
 * when another world opens.
 */
export function useWorldRecorder(slices: WorldSlices, worldId: string | null, setters: WorldSetters) {
  const [store] = useState(createHistoryStore);
  const intent = useRef<WriteIntent>({});
  const seen = useRef(slices);
  const openWorld = useRef(worldId);
  const last = useRef<{ recorded: boolean; tick?: number }>({ recorded: false });

  useLayoutEffect(() => {
    const before = seen.current;
    seen.current = slices;
    const { history: moved, follow, key } = intent.current;
    intent.current = {};
    if (worldId !== openWorld.current) {
      openWorld.current = worldId;
      store.set(createHistory());
      last.current = { recorded: false };
      return;
    }
    if (follow && !last.current.recorded) return;
    // A move already set `seen` to the world it writes, so only a write batched with it shows here.
    if (moved) last.current = { recorded: false };
    const edits = WORLD_SLICES
      .map((slice) => diffSlice(slice, before[slice], slices[slice]))
      .filter((edit): edit is SliceEdit => edit !== null);
    if (!edits.length) return;
    const at = follow ? last.current.tick : currentTick();
    // A key whose slice did not change belongs to a write that bailed, so it never keys another one.
    const keyed = !follow && key && edits.some((edit) => edit.slice === key.slice) ? key : undefined;
    store.set(record(store.get(), edits, { tick: at, key: keyed }));
    last.current = { recorded: true, tick: at };
  }, [slices, worldId, store]);

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
    () => ({ store, undo, redo, jump, keyNext }),
    [store, undo, redo, jump, keyNext],
  );
  return { intent, controls };
}

export const WorldHistoryContext = createContext<WorldHistoryControls | null>(null);

/** Only the moves and the key channel, which keep one identity, so a caller does not re-render when the history changes. */
export function useWorldHistoryMoves(): Pick<WorldHistoryControls, 'undo' | 'redo' | 'jump' | 'keyNext'> {
  const controls = useContext(WorldHistoryContext);
  if (!controls) throw new Error('useWorldHistoryMoves must be used within a GameDataProvider');
  return controls;
}

/** The open world's history: where the cursor stands, the Steps, and the moves. Throws outside a world. */
export function useWorldHistory() {
  const controls = useContext(WorldHistoryContext);
  if (!controls) throw new Error('useWorldHistory must be used within a GameDataProvider');
  const { store, undo, redo, jump, keyNext } = controls;
  const history = useSyncExternalStore(store.subscribe, store.get);
  return {
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    steps: history.steps,
    cursor: history.cursor,
    saved: history.saved,
    undo, redo, jump, keyNext,
  };
}
