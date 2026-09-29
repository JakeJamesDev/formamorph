import type { GateState } from './traitGates';

const OR = new Intl.ListFormat('en', { type: 'disjunction' });

/**
 * "Requires A or B" for a locked trait, "Unlocked by A" for an open one, nothing for an ungated one. The player's
 * line leaves out Hidden targets, and a locked trait with only Hidden ones reads "Locked" (Q14). `revealHidden`
 * is for author tools.
 */
export function gateLine(gate: GateState | undefined, { revealHidden = false } = {}): string | null {
  if (!gate?.requirements.length) return null;
  const shown = revealHidden ? gate.requirements : gate.requirements.filter((r) => !r.hidden);
  if (!gate.unlocked) return shown.length ? `Requires ${OR.format(shown.map((r) => r.text))}` : 'Locked';
  const holding = shown.filter((r) => r.holds);
  return holding.length ? `Unlocked by ${OR.format(holding.map((r) => r.text))}` : null;
}
