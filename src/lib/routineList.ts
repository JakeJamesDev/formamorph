import { firstRoutine, routineName } from '@/lib/entityKind';
import type { Entity, EntityRoutine, EntityStart, TraitRequirementRow, Traversable } from '@/types';

// The Routine tab's view of an entity's Routines and its writes to them. Each write returns the whole entity.

type WithRoutines = Pick<Entity, 'routines'>;

/** Which Routine and Start are on show. A Start id wins over a Routine id; neither shows the first Routine. */
export interface ShownRoutineAt {
  routineId: string | null;
  startId: string | null;
}

/** `entity`'s Routines, or one blank Routine when it has none. */
export const routinesOf = (entity: WithRoutines): EntityRoutine[] => (entity.routines?.length ? entity.routines : [firstRoutine()]);

/** The Routine that holds the Start. */
export const routineOfStart = (entity: WithRoutines, startId: string | null): EntityRoutine | undefined =>
  (startId === null ? undefined : routinesOf(entity).find((r) => r.starts.some((s) => s.id === startId)));

/** The Routine on show: the one holding the shown Start, else the shown Routine, else the first. */
export function shownRoutine(entity: WithRoutines, at: ShownRoutineAt): EntityRoutine {
  const routines = routinesOf(entity);
  return routineOfStart(entity, at.startId) ?? routines.find((r) => r.id === at.routineId) ?? routines[0];
}

/** The Start on show: the shown Start of the shown Routine, else its first. */
export function shownStart(entity: WithRoutines, at: ShownRoutineAt): EntityStart | undefined {
  const { starts } = shownRoutine(entity, at);
  return starts.find((s) => s.id === at.startId) ?? starts[0];
}

/** Whether the Routine tab shows the Routine level: two or more Routines, or a lone gated one (Q16, Q30). */
export function showsRoutineLevel(entity: WithRoutines): boolean {
  const routines = routinesOf(entity);
  return routines.length > 1 || !!routines[0].requires?.length;
}

/** Whether `routine` warns that it never applies: no Starts while the entity has two or more Routines (Q19, Q28). */
export const warnsEmpty = (entity: WithRoutines, routine: EntityRoutine): boolean =>
  routinesOf(entity).length > 1 && routine.starts.length === 0;

/** What the strip calls the Routine at `index`: its name, or its default name when blank. */
export const routineLabel = (routine: EntityRoutine, index: number): string => routine.name.trim() || routineName(index + 1);

/** `entity` with the Routine `routineId` replaced by `edit` of it. */
export const withRoutineEdit = <E extends WithRoutines>(entity: E, routineId: string, edit: (routine: EntityRoutine) => EntityRoutine): E =>
  ({ ...entity, routines: routinesOf(entity).map((r) => (r.id === routineId ? edit(r) : r)) });

export const withRoutineStarts = <E extends WithRoutines>(entity: E, routineId: string, starts: EntityStart[]): E =>
  withRoutineEdit(entity, routineId, (r) => ({ ...r, starts }));

export const withRoutineTraversable = <E extends WithRoutines>(entity: E, routineId: string, traversable: Traversable): E =>
  withRoutineEdit(entity, routineId, (r) => ({ ...r, traversable }));

export const withRoutineName = <E extends WithRoutines>(entity: E, routineId: string, name: string): E =>
  withRoutineEdit(entity, routineId, (r) => ({ ...r, name }));

/** `entity` with the Routine's Requires set; no rows drops the field. */
export const withRoutineRequires = <E extends WithRoutines>(entity: E, routineId: string, rows: TraitRequirementRow[]): E =>
  withRoutineEdit(entity, routineId, ({ requires: _old, ...rest }) => (rows.length ? { ...rest, requires: rows } : rest));

/** "Routine N" for the next Routine, N past the count and every name in use. */
function newRoutineName(routines: readonly EntityRoutine[]): string {
  const names = new Set(routines.map((r) => r.name));
  let n = routines.length + 1;
  while (names.has(routineName(n))) n += 1;
  return routineName(n);
}

/** `entity` with a new last Routine with no Starts and no gate, and its id. A Unique entity's can go anywhere. */
export function withNewRoutine<E extends Pick<Entity, 'routines' | 'kind'>>(entity: E, newId: () => string): { entity: E; routineId: string } {
  const routines = routinesOf(entity);
  const routineId = newId();
  const routine: EntityRoutine = {
    id: routineId, name: newRoutineName(routines), starts: [], ...(entity.kind === 'unique' && { traversable: 'anywhere' as const }),
  };
  return { entity: { ...entity, routines: [...routines, routine] }, routineId };
}

/** `entity` with the Routine moved `by` places in author order. The same entity at either end. */
export function withRoutineMoved<E extends WithRoutines>(entity: E, routineId: string, by: -1 | 1): E {
  const routines = [...routinesOf(entity)];
  const from = routines.findIndex((r) => r.id === routineId);
  const to = from + by;
  if (from < 0 || to < 0 || to >= routines.length) return entity;
  [routines[from], routines[to]] = [routines[to], routines[from]];
  return { ...entity, routines };
}

/** `entity` without the Routine. The last Routine stays (Q28). */
export function withoutRoutine<E extends WithRoutines>(entity: E, routineId: string): E {
  const routines = routinesOf(entity);
  return routines.length > 1 ? { ...entity, routines: routines.filter((r) => r.id !== routineId) } : entity;
}

const blankStart = (place: string, newId: () => string): EntityStart => ({ id: newId(), place, weight: 1, schedule: [] });

/** `entity` with a new Start with no rows at `place` in the Routine. */
export const withRoutineStartAdded = <E extends WithRoutines>(entity: E, routineId: string, place: string, newId: () => string): E =>
  withRoutineEdit(entity, routineId, (r) => ({ ...r, starts: [...r.starts, blankStart(place, newId)] }));

/** `entity` without the Start, from whichever Routine holds it. The last Start of a Routine stays. */
export function withoutRoutineStart<E extends WithRoutines>(entity: E, startId: string): E {
  const routine = routineOfStart(entity, startId);
  if (!routine || routine.starts.length < 2) return entity;
  return withRoutineStarts(entity, routine.id, routine.starts.filter((s) => s.id !== startId));
}

/** A Generic entity with a Start added at `place` in the Routine, or that Routine's Starts there removed when it has
 *  any. Removing never takes its last Start. */
export function withGenericStartToggled<E extends WithRoutines>(entity: E, routineId: string, place: string, newId: () => string): E {
  const routine = routinesOf(entity).find((r) => r.id === routineId);
  if (!routine) return entity;
  if (!routine.starts.some((s) => s.place === place)) return withRoutineStartAdded(entity, routineId, place, newId);
  const kept = routine.starts.filter((s) => s.place !== place);
  return kept.length ? withRoutineStarts(entity, routineId, kept) : entity;
}

const startsHere = (routine: EntityRoutine, place: string) => routine.starts.some((s) => s.place === place);

/** Whether a Start of any Routine begins at `place`. */
export const beginsAt = (entity: WithRoutines, place: string): boolean => routinesOf(entity).some((r) => startsHere(r, place));

/** Whether removing the Starts that begin at `place` leaves each Routine that has one at least one Start. */
export const canRemoveStartsAt = (entity: WithRoutines, place: string): boolean =>
  routinesOf(entity).every((r) => !startsHere(r, place) || r.starts.some((s) => s.place !== place));

/** `entity` without the Starts that begin at `place`, rows and all, in every Routine. The same entity when none begins
 *  there, or when that would leave a Routine with no Start. */
export function withoutStartsAt<E extends WithRoutines>(entity: E, place: string): E {
  if (!beginsAt(entity, place) || !canRemoveStartsAt(entity, place)) return entity;
  return { ...entity, routines: routinesOf(entity).map((r) => ({ ...r, starts: r.starts.filter((s) => s.place !== place) })) };
}
