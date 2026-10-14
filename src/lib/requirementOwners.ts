import { PLAYER_OWNER, type RequirementOption } from '@/lib/traitGates';
import type { TraitRequirement } from '@/types';

/**
 * The requirement to add with no owner page, or null when the author has a choice to make. Only You can
 * own the target, and a world trait reads You as its own owner, so the plain requirement says it (Q20).
 */
export function soleOwnerRequirement(option: RequirementOption, ownerId: string): TraitRequirement | null {
  return ownerId === PLAYER_OWNER && option.owners.length === 1 ? option.requirement : null;
}
