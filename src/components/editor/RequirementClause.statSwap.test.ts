import { describe, expect, it } from 'vitest';
import type { RequirementOption } from '@/lib/traitGates';
import type { StatRequirement } from '@/types';
import { statSwapped } from './RequirementClause';

const owner = { kind: 'entity' as const, id: 'mira', name: 'Mira' };
const stat = (id: string, extra: Partial<StatRequirement> = {}): StatRequirement => ({ kind: 'stat', id, operator: '>=', value: 50, unit: 'raw', ...extra });
const target = (req: StatRequirement): RequirementOption => ({ requirement: req, label: req.id, breadcrumb: [], owners: [] });

describe('a stat target swap (Q34)', () => {
  it('keeps a % value, with the owner, comparison and Not', () => {
    const from = stat('rage', { operator: '<', value: 30, unit: 'percent', not: true, owner });
    expect(statSwapped(from, target(stat('nerve', { value: 42 })))).toEqual(
      stat('nerve', { operator: '<', value: 30, unit: 'percent', not: true, owner }),
    );
  });

  it('resets a Raw value to the new stat’s default, and keeps the comparison', () => {
    const from = stat('rage', { operator: '<', value: 70, owner });
    expect(statSwapped(from, target(stat('nerve', { value: 42 })))).toEqual(stat('nerve', { operator: '<', value: 42, unit: 'raw', owner }));
  });
});
