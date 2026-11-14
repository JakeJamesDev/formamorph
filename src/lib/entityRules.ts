// An entity's own Requirement Rows outside its traits: its images' Visibility rules, its Enabled gate and its Routines'
// Requires.

import type { Entity, TraitRequirement } from '@/types';
import { hasImageRules, withImageRules, type ImageBearing } from './entityImages';
import { hasEnabledGate } from './inPlayGates';
import { mapConditions } from './requirementRows';

type RuleBearing = ImageBearing & Pick<Entity, 'enabledWhen' | 'routines'>;

const hasRoutineGate = (entity: RuleBearing): boolean => !!entity.routines?.some((r) => r.requires?.length);

/** Whether the entity carries an image Visibility rule, an Enabled gate or a gated Routine. */
export const hasEntityRules = (entity: RuleBearing): boolean => hasImageRules(entity) || hasEnabledGate(entity) || hasRoutineGate(entity);

/** The entity with `map` over every Condition of its image rules, its Enabled gate and its Routines' Requires; the
 *  same entity when it carries none. */
export function withEntityRules<T extends RuleBearing>(entity: T, map: (req: TraitRequirement) => TraitRequirement): T {
  const imaged = withImageRules(entity, map);
  const enabled = entity.enabledWhen?.length ? { ...imaged, enabledWhen: mapConditions(entity.enabledWhen, map) } : imaged;
  if (!hasRoutineGate(entity)) return enabled;
  const routines = entity.routines?.map((r) => (r.requires?.length ? { ...r, requires: mapConditions(r.requires, map) } : r));
  return { ...enabled, routines };
}
