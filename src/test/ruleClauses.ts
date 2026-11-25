import type { RowState } from '@/lib/traitGates';

/** Each row's Condition clauses, as the "Shown while" line joins them. */
export const rowClauses = (rows: readonly RowState[]): string[][] => rows.map((row) => row.conditions.map((c) => c.clause));
