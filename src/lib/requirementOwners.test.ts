import { describe, it, expect } from 'vitest';
import { soleOwnerRequirement } from '@/lib/requirementOwners';
import type { RequirementOption } from '@/lib/traitGates';

const YOU = { owner: { kind: 'you' as const }, name: 'Persona' };
const ASH = { owner: { kind: 'entity' as const, id: 'ash', name: 'Ash' }, name: 'Ash' };

const option = (owners: RequirementOption['owners']): RequirementOption =>
  ({ requirement: { kind: 'trait', id: 't-tamed' }, label: 'Tamed', breadcrumb: ['World'], owners });

describe('soleOwnerRequirement', () => {
  it('adds a plain requirement for a global target, which offers no owner (Q10)', () => {
    expect(soleOwnerRequirement(option([]))).toEqual({ kind: 'trait', id: 't-tamed' });
  });

  it('keeps the requirement the option holds, group and all', () => {
    const group: RequirementOption = { ...option([]), requirement: { kind: 'group', id: 'g-class' } };
    expect(soleOwnerRequirement(group)).toEqual({ kind: 'group', id: 'g-class' });
  });

  it('asks when an entity owns the target', () => {
    expect(soleOwnerRequirement(option([YOU, ASH]))).toBeNull();
  });

  // Q6: Same Owner on a global trait no longer reads You, so a target only You can hold asks too.
  it('asks when only You can hold the target', () => {
    expect(soleOwnerRequirement(option([YOU]))).toBeNull();
  });
});
