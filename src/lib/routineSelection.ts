import { useCallback, useSyncExternalStore } from 'react';
import { startToShowFor } from '@/lib/hereMarks';
import type { ShownRoutineAt } from '@/lib/routineList';
import type { Entity } from '@/types';

/** Which Routine and Start of an entity are on show in its Routine editor, and which of its rows is selected. */
export interface RoutineSelection extends ShownRoutineAt {
  rowId: string | null;
}

/** Marks a surface whose presses keep the row selection, like the canvas showing the routine. */
export const KEEPS_ROUTINE_SELECTION = 'data-keeps-routine-selection';

/** Marks a panel inside such a surface whose presses clear the row selection again, like the editor over the canvas. */
export const CLEARS_ROUTINE_SELECTION = 'data-clears-routine-selection';

const NONE: RoutineSelection = { routineId: null, startId: null, rowId: null };
const byEntity = new Map<string, RoutineSelection>();
const listeners = new Set<() => void>();

function set(entityId: string, next: RoutineSelection) {
  const was = byEntity.get(entityId) ?? NONE;
  if (was.routineId === next.routineId && was.startId === next.startId && was.rowId === next.rowId) return;
  byEntity.set(entityId, next);
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const routineSelectionOf = (entityId: string): RoutineSelection => byEntity.get(entityId) ?? NONE;

/** Shows another Start of the entity, in whichever Routine holds it. Its row selection clears. */
export const showRoutineStart = (entityId: string, startId: string | null) =>
  set(entityId, { routineId: routineSelectionOf(entityId).routineId, startId, rowId: null });

/** Shows another Routine of the entity, on its first Start. The row selection clears. */
export const showRoutine = (entityId: string, routineId: string | null) => set(entityId, { routineId, startId: null, rowId: null });

/** Shows the entity's Start for the location (see `startToShowFor`). */
export function showStartFor(entity: Entity, locationId: string) {
  const at = routineSelectionOf(entity.id);
  const startId = startToShowFor(entity, locationId, at);
  if (startId !== at.startId) showRoutineStart(entity.id, startId);
}

/** Selects a row of the Start on show, or clears the selection with null. */
export const selectRoutineRow = (entityId: string, rowId: string | null) =>
  set(entityId, { ...routineSelectionOf(entityId), rowId });

/** The entity's Routine selection, shared by every editor and view of that entity. */
export function useRoutineSelection(entityId: string) {
  const selection = useSyncExternalStore(subscribe, () => routineSelectionOf(entityId));
  const showStart = useCallback((startId: string | null) => showRoutineStart(entityId, startId), [entityId]);
  const selectRow = useCallback((rowId: string | null) => selectRoutineRow(entityId, rowId), [entityId]);
  const showRoutineOf = useCallback((routineId: string | null) => showRoutine(entityId, routineId), [entityId]);
  return { ...selection, showStart, showRoutine: showRoutineOf, selectRow };
}

/** Forgets every selection, for tests. */
export const resetRoutineSelections = () => { byEntity.clear(); for (const listener of listeners) listener(); };
