// An entity's own Requirement Rows outside its traits: its images' Visibility rules and its Enabled gate.

import type { Entity, TraitRequirement } from '@/types';
import { hasImageRules, withImageRules, type ImageBearing } from './entityImages';
import { hasEnabledGate } from './inPlayGates';
import { mapConditions } from './requirementRows';

type RuleBearing = ImageBearing & Pick<Entity, 'enabledWhen'>;

/** Whether the entity carries an image Visibility rule or an Enabled gate. */
export const hasEntityRules = (entity: RuleBearing): boolean => hasImageRules(entity) || hasEnabledGate(entity);

/** The entity with `map` over every Condition of its image rules and its Enabled gate; the same entity when it
 *  carries neither. */
export function withEntityRules<T extends RuleBearing>(entity: T, map: (req: TraitRequirement) => TraitRequirement): T {
  const imaged = withImageRules(entity, map);
  return entity.enabledWhen?.length ? { ...imaged, enabledWhen: mapConditions(entity.enabledWhen, map) } : imaged;
}
