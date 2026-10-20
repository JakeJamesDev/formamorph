import type { ConditionState, GateState, RowState } from './traitGates';

const OR = new Intl.ListFormat('en', { type: 'disjunction' });
const AND = new Intl.ListFormat('en', { type: 'conjunction' });

/** One piece of a gate line: plain text, or the played persona's name, which the player's line marks with
 *  the You pill. */
export type GateLinePart = string | { persona: string };

/** The line as plain text, the persona's name included. */
const plainLine = (parts: readonly GateLinePart[]): string =>
  parts.map((part) => (typeof part === 'string' ? part : part.persona)).join('');

/** A Condition's text, with the persona's name split off when the text opens with it. */
const conditionParts = (c: ConditionState): GateLinePart[] =>
  (c.persona ? [{ persona: c.persona }, c.text.slice(c.persona.length)] : [c.text]);

/** `items` in list order, with the formatter's own joining text between them. */
function listParts(format: Intl.ListFormat, items: readonly GateLinePart[][]): GateLinePart[] {
  let next = 0;
  return format.formatToParts(items.map((_, i) => String(i))).flatMap((part) => (part.type === 'element' ? items[next++] : [part.value]));
}

/** `parts` with neighboring text run together. */
const merged = (parts: readonly GateLinePart[]): GateLinePart[] => parts.reduce<GateLinePart[]>((out, part) => {
  const last = out[out.length - 1];
  if (typeof part === 'string' && typeof last === 'string') out[out.length - 1] = last + part;
  else out.push(part);
  return out;
}, []);

/** One row's Conditions joined by "and". */
const rowParts = (row: readonly GateLinePart[][]): GateLinePart[] => listParts(AND, row);

/** One row's Conditions joined by "and", as plain text. */
export const rowText = (row: readonly string[]): string => plainLine(rowParts(row.map((text) => [text])));

/** Rows joined by "or", Conditions by "and". A comma closes an "and" row before the "or", so
 *  "A and B, or C" never reads as "A and (B or C)". */
export function ruleParts(rows: readonly GateLinePart[][][]): GateLinePart[] {
  const texts = rows.map(rowParts);
  if (texts.length === 1 || rows.every((row) => row.length === 1)) return listParts(OR, texts);
  return [...texts.slice(0, -1).flatMap((row, i) => (i ? [', ', ...row] : row)), ', or ', ...texts[texts.length - 1]];
}

/** Rows joined by "or", Conditions by "and", as plain text. */
export const ruleText = (rows: readonly string[][]): string =>
  plainLine(ruleParts(rows.map((row) => row.map((text) => [text]))));

/** "Shown while A and B, or C" for an image's Visibility rule; null with no rows. Author tools, so nothing is left out. */
export function shownWhileLine(rows: readonly RowState[]): string | null {
  return rows.length ? `Shown while ${ruleText(rows.map((row) => row.conditions.map((c) => c.text)))}` : null;
}

/**
 * "Requires A and B, or C" for a locked trait, "Unlocked by A" for an open one, nothing for an ungated one,
 * in parts so the player's line can mark the persona's name. The player's line leaves out Hidden targets
 * and drops a row left with none; a locked trait with no row left reads "Locked" (Q12). `revealHidden` is
 * for author tools.
 */
export function gateLineParts(gate: GateState | undefined, { revealHidden = false } = {}): GateLinePart[] | null {
  if (!gate?.rows.length) return null;
  const shown = (rows: readonly RowState[]) => rows
    .map((row) => row.conditions.filter((c) => revealHidden || !c.hidden).map(conditionParts))
    .filter((parts) => parts.length > 0);
  if (!gate.unlocked) {
    const rows = shown(gate.rows);
    return rows.length ? merged(['Requires ', ...ruleParts(rows)]) : ['Locked'];
  }
  const holding = shown(gate.rows.filter((row) => row.holds));
  return holding.length ? merged(['Unlocked by ', ...ruleParts(holding)]) : null;
}

/** The gate line as plain text. */
export function gateLine(gate: GateState | undefined, options: { revealHidden?: boolean } = {}): string | null {
  const parts = gateLineParts(gate, options);
  return parts && plainLine(parts);
}
