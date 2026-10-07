import type { GateState, RowState } from './traitGates';

const OR = new Intl.ListFormat('en', { type: 'disjunction' });
const AND = new Intl.ListFormat('en', { type: 'conjunction' });

/** Rows joined by "or", Conditions by "and". A comma closes an "and" row before the "or", so
 *  "A and B, or C" never reads as "A and (B or C)". */
function ruleText(rows: readonly string[][]): string {
  const texts = rows.map((row) => AND.format(row));
  if (texts.length === 1 || rows.every((row) => row.length === 1)) return OR.format(texts);
  return `${texts.slice(0, -1).join(', ')}, or ${texts[texts.length - 1]}`;
}

/**
 * "Requires A and B, or C" for a locked trait, "Unlocked by A" for an open one, nothing for an ungated one.
 * The player's line leaves out Hidden targets and drops a row left with none; a locked trait with no row
 * left reads "Locked" (Q12). `revealHidden` is for author tools.
 */
export function gateLine(gate: GateState | undefined, { revealHidden = false } = {}): string | null {
  if (!gate?.rows.length) return null;
  const shown = (rows: readonly RowState[]) => rows
    .map((row) => row.conditions.filter((c) => revealHidden || !c.hidden).map((c) => c.text))
    .filter((texts) => texts.length > 0);
  if (!gate.unlocked) {
    const rows = shown(gate.rows);
    return rows.length ? `Requires ${ruleText(rows)}` : 'Locked';
  }
  const holding = shown(gate.rows.filter((row) => row.holds));
  return holding.length ? `Unlocked by ${ruleText(holding)}` : null;
}
