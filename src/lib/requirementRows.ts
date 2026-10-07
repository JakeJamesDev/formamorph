// Requirement Rows: "and" inside a row, "or" between rows.

import type { TraitRequirement, TraitRequirementRow } from '@/types';

/** Every Condition across `rows`, in authored order. */
export const conditionsOf = (rows: readonly TraitRequirementRow[] | undefined): TraitRequirement[] =>
  (rows ?? []).flatMap((row) => row.all);

/** `rows` with `map` applied to every Condition. */
export const mapConditions = (
  rows: readonly TraitRequirementRow[], map: (req: TraitRequirement) => TraitRequirement,
): TraitRequirementRow[] => rows.map((row) => ({ all: row.all.map(map) }));

/** Whether a gate of `rows` holds: it has no rows, or every Condition of some row holds. */
export const rowsHold = (rows: readonly TraitRequirementRow[] | undefined, holds: (req: TraitRequirement) => boolean): boolean =>
  !rows?.length || rows.some((row) => row.all.every(holds));
