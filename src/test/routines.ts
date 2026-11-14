import type { Entity, EntityRoutine, EntityStart, Traversable } from '@/types';
import { firstRoutine, withFirstRoutine } from '@/lib/entityKind';

/** An entity's Routines as the migration writes them: one ungated Routine with `starts` and `traversable`. */
export const oneRoutine = (starts: EntityStart[] = [], traversable?: Traversable): EntityRoutine[] =>
  [firstRoutine(starts, traversable)];

/** `entity` with no Traversable field on its first Routine. */
export const withoutTraversable = <E extends Pick<Entity, 'routines'>>(entity: E): E =>
  withFirstRoutine(entity, ({ traversable: _absent, ...routine }) => routine);
