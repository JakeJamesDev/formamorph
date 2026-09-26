import type { GateState } from './traitGates';

const OR = new Intl.ListFormat('en', { type: 'disjunction' });

/** "Requires A or B" for a locked trait, "Unlocked by A" for an open one, nothing for an ungated one. */
export function gateLine(gate: GateState | undefined): string | null {
  if (!gate?.requirements.length) return null;
  if (!gate.unlocked) return `Requires ${OR.format(gate.requirements.map((r) => r.text))}`;
  return `Unlocked by ${OR.format(gate.requirements.filter((r) => r.holds).map((r) => r.text))}`;
}
