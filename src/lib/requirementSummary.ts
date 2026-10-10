// The Requires field's summary: Conditions every row shares, then what each row adds.

import { sameRequirement } from '@/lib/traitGates';
import type { TraitRequirement, TraitRequirementRow } from '@/types';

export interface RequirementOptionSummary {
  needs: TraitRequirement[];
  blocked: TraitRequirement[];
}

/** A Requirement as Needs, one-of options and Blocked By; Not Conditions are the blocked ones. */
export interface RequirementSummary {
  needs: TraitRequirement[];
  options: RequirementOptionSummary[];
  blocked: TraitRequirement[];
}

const split = (conditions: readonly TraitRequirement[]): RequirementOptionSummary => ({
  needs: conditions.filter((c) => !c.not),
  blocked: conditions.filter((c) => c.not),
});

/**
 * `rows` with the Conditions every row shares factored out, which keeps the rule exact. A row with nothing
 * left after factoring holds whenever the shared part does, so the options drop out. Null for no rows.
 */
export function summarizeRequirement(rows: readonly TraitRequirementRow[]): RequirementSummary | null {
  if (!rows.length) return null;
  const has = (row: TraitRequirementRow, c: TraitRequirement) => row.all.some((other) => sameRequirement(other, c));
  const shared = rows[0].all.filter((c, i) =>
    rows.every((row) => has(row, c)) && rows[0].all.findIndex((other) => sameRequirement(other, c)) === i);
  const rest = rows.map((row) => row.all.filter((c) => !shared.some((s) => sameRequirement(s, c))));
  const options = rest.some((r) => !r.length) ? [] : rest.map(split);
  return { ...split(shared), options };
}

/** `names` joined as "A", "A and B", or "A, B, and C". */
export function joinAnd(names: readonly string[]): string {
  if (names.length < 3) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}
