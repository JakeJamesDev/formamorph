import { WORLD_OWNER, type RequirementOption } from '@/lib/traitGates';
import type { TraitRequirement } from '@/types';

/**
 * The requirement to add with no bearer page, or null when the author has a choice to make. Only You can
 * hold the target, and a world trait reads You as its own bearer, so the plain requirement says it (Q20).
 */
export function soleBearerRequirement(option: RequirementOption, holderId: string): TraitRequirement | null {
  return holderId === WORLD_OWNER && option.bearers.length === 1 ? option.requirement : null;
}
