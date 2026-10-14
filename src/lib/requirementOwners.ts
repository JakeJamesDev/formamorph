import type { RequirementOption } from '@/lib/traitGates';
import type { TraitRequirement } from '@/types';

/**
 * The requirement to add with no owner page, or null when the author has a choice to make. A global target
 * offers no owner, so the plain requirement says it (Q10).
 */
export function soleOwnerRequirement(option: RequirementOption): TraitRequirement | null {
  return option.owners.length === 0 ? option.requirement : null;
}
