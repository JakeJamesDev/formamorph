// Visibility rules in play: which of an entity's gallery images the story shows right now.

import type { Base64Data, Entity } from '@/types';
import { entityImages } from './entityImages';
import { ruleStates, type GateInput } from './traitGates';

/** One image visible in play, with its slot in the authored gallery. */
export interface VisibleImage {
  slot: number;
  data: Base64Data;
}

/**
 * The entity's images visible in play, in author order, so the first is the primary. An image with no rule is
 * visible; one with a rule is visible while any row holds, and an unresolved Condition never holds (Q12).
 */
export function visibleImages(entity: Pick<Entity, 'id' | 'images'>, input: GateInput): VisibleImage[] {
  return entityImages(entity).flatMap((img, slot) =>
    (!img.requires?.length || ruleStates(input, entity.id, img.requires).some((row) => row.holds) ? [{ slot, data: img.data }] : []));
}
