import { describe, it, expect } from 'vitest';
import { soleOwnerRequirement } from '@/lib/requirementOwners';
import { PLAYER_OWNER, type RequirementOption } from '@/lib/traitGates';

const YOU = { owner: { kind: 'you' as const }, name: 'You' };
const ASH = { owner: { kind: 'entity' as const, id: 'ash', name: 'Ash' }, name: 'Ash' };

const option = (owners: RequirementOption['owners']): RequirementOption =>
  ({ requirement: { kind: 'trait', id: 't-tamed' }, label: 'Tamed', breadcrumb: ['World'], owners });

describe('soleOwnerRequirement', () => {
  it('adds a plain requirement when a world trait asks about a target only You can hold', () => {
    expect(soleOwnerRequirement(option([YOU]), PLAYER_OWNER)).toEqual({ kind: 'trait', id: 't-tamed' });
  });

  it('keeps the requirement the option holds, group and all', () => {
    const group: RequirementOption = { ...option([YOU]), requirement: { kind: 'group', id: 'g-class' } };
    expect(soleOwnerRequirement(group, PLAYER_OWNER)).toEqual({ kind: 'group', id: 'g-class' });
  });

  it('asks when an entity also owns the target', () => {
    expect(soleOwnerRequirement(option([YOU, ASH]), PLAYER_OWNER)).toBeNull();
  });

  it('asks when an entity\'s own trait does, since the same owner is then the entity and not You', () => {
    expect(soleOwnerRequirement(option([YOU]), 'ash')).toBeNull();
  });
});
