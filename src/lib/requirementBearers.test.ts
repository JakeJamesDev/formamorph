import { describe, it, expect } from 'vitest';
import { soleBearerRequirement } from '@/lib/requirementBearers';
import { WORLD_OWNER, type RequirementOption } from '@/lib/traitGates';

const YOU = { bearer: { kind: 'you' as const }, name: 'You' };
const ASH = { bearer: { kind: 'entity' as const, id: 'ash', name: 'Ash' }, name: 'Ash' };

const option = (bearers: RequirementOption['bearers']): RequirementOption =>
  ({ requirement: { kind: 'trait', id: 't-tamed' }, label: 'Tamed', breadcrumb: ['World'], bearers });

describe('soleBearerRequirement', () => {
  it('adds a plain requirement when a world trait asks about a target only You can hold', () => {
    expect(soleBearerRequirement(option([YOU]), WORLD_OWNER)).toEqual({ kind: 'trait', id: 't-tamed' });
  });

  it('keeps the requirement the option holds, group and all', () => {
    const group: RequirementOption = { ...option([YOU]), requirement: { kind: 'group', id: 'g-class' } };
    expect(soleBearerRequirement(group, WORLD_OWNER)).toEqual({ kind: 'group', id: 'g-class' });
  });

  it('asks when an entity also bears the target', () => {
    expect(soleBearerRequirement(option([YOU, ASH]), WORLD_OWNER)).toBeNull();
  });

  it('asks when an entity\'s own trait does, since Same Bearer is then the entity and not You', () => {
    expect(soleBearerRequirement(option([YOU]), 'ash')).toBeNull();
  });
});
