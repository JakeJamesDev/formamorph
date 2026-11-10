import { useCallback, useSyncExternalStore } from 'react';

/** Which Start of an entity is on show in its Routine editor, and which of its rows is selected. */
export interface RoutineSelection {
  /** Null shows the first Start. */
  startId: string | null;
  rowId: string | null;
}

const NONE: RoutineSelection = { startId: null, rowId: null };
const byEntity = new Map<string, RoutineSelection>();
const listeners = new Set<() => void>();

function set(entityId: string, next: RoutineSelection) {
  const was = byEntity.get(entityId) ?? NONE;
  if (was.startId === next.startId && was.rowId === next.rowId) return;
  byEntity.set(entityId, next);
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const routineSelectionOf = (entityId: string): RoutineSelection => byEntity.get(entityId) ?? NONE;

/** Shows another Start of the entity. Its row selection clears. */
export const showRoutineStart = (entityId: string, startId: string | null) => set(entityId, { startId, rowId: null });

/** Selects a row of the Start on show, or clears the selection with null. */
export const selectRoutineRow = (entityId: string, rowId: string | null) =>
  set(entityId, { ...routineSelectionOf(entityId), rowId });

/** The entity's Routine selection, shared by every editor and view of that entity. */
export function useRoutineSelection(entityId: string) {
  const selection = useSyncExternalStore(subscribe, () => routineSelectionOf(entityId));
  const showStart = useCallback((startId: string | null) => showRoutineStart(entityId, startId), [entityId]);
  const selectRow = useCallback((rowId: string | null) => selectRoutineRow(entityId, rowId), [entityId]);
  return { ...selection, showStart, selectRow };
}

/** Forgets every selection, for tests. */
export const resetRoutineSelections = () => { byEntity.clear(); for (const listener of listeners) listener(); };
