import { describe, expect, it } from 'vitest';
import { shownWhileLine } from './traitGateLine';
import { NO_ACTIVE, ruleStates, type GateInput, type GateStat, type GateStatSet } from './traitGates';
import { scoped } from './scope';
import type { Trait, TraitRequirementRow } from '@/types';

const S = (name: string, value: number, extra: Partial<GateStat> = {}): GateStat => ({ name, value, min: 0, max: 100, ...extra });
const trait = (id: string, name: string): Trait => ({ id, name, statChanges: [] });

const input = (extra: Partial<GateInput> = {}): GateInput => ({
  global: { traits: [trait('knight', 'Knight'), trait('healed', 'Healed')], groups: [] },
  owners: [],
  active: NO_ACTIVE,
  entities: [{ id: 'wren', name: 'Wren' }],
  persona: { source: 'none' },
  stats: scoped<GateStatSet>({}, { wren: { health: S('Health', 10) } }),
  ...extra,
});

const row = (...all: TraitRequirementRow['all']): TraitRequirementRow => ({ all });
const lowHealth = { kind: 'stat', id: 'health', operator: '<', value: 20, unit: 'percent' } as const;

describe('ruleStates', () => {
  it('reads a stat Condition from an entity that owns no traits', () => {
    const [state] = ruleStates(input(), 'wren', [row(lowHealth)]);
    expect(state.holds).toBe(true);
    expect(state.conditions[0]).toMatchObject({ text: 'Health < 20%', unresolved: false });
  });

  it('does not hold while the stat is above the threshold', () => {
    const [state] = ruleStates(input({ stats: scoped<GateStatSet>({}, { wren: { health: S('Health', 80) } }) }), 'wren', [row(lowHealth)]);
    expect(state.holds).toBe(false);
  });

  it('leaves a stat the owner does not have unresolved', () => {
    const [state] = ruleStates(input({ stats: scoped<GateStatSet>({}) }), 'wren', [row(lowHealth)]);
    expect(state.conditions[0].unresolved).toBe(true);
    expect(state.holds).toBe(false);
  });

  it('reads a trait Condition from the input’s active sets, and Not flips it', () => {
    const active = scoped(['knight']);
    const rows = [row({ kind: 'trait', id: 'knight', owner: { kind: 'you' } }), row({ kind: 'trait', id: 'healed', owner: { kind: 'you' }, not: true })];
    expect(ruleStates(input({ active }), 'wren', rows).map((r) => r.holds)).toEqual([true, true]);
    expect(ruleStates(input(), 'wren', rows).map((r) => r.holds)).toEqual([false, true]);
  });

  it('reads each row on its own, and a row holds only when every Condition does', () => {
    const rows = [row(lowHealth, { kind: 'trait', id: 'knight', owner: { kind: 'you' } })];
    expect(ruleStates(input(), 'wren', rows)[0].holds).toBe(false);
    expect(ruleStates(input({ active: scoped(['knight']) }), 'wren', rows)[0].holds).toBe(true);
  });
});

describe('shownWhileLine', () => {
  it('reads nothing for a rule with no rows', () => {
    expect(shownWhileLine([])).toBeNull();
  });

  it('reads a stat Condition and a Not trait Condition with the "Shown while" lead', () => {
    const states = ruleStates(input(), 'wren', [row(lowHealth, { kind: 'trait', id: 'healed', owner: { kind: 'you' }, not: true })]);
    expect(shownWhileLine(states)).toBe('Shown while Health < 20% and Persona: not Healed');
  });

  it('closes an "and" row with a comma before "or"', () => {
    const states = ruleStates(input(), 'wren', [
      row(lowHealth, { kind: 'trait', id: 'knight', owner: { kind: 'you' } }),
      row({ kind: 'trait', id: 'healed', owner: { kind: 'you' } }),
    ]);
    expect(shownWhileLine(states)).toBe('Shown while Health < 20% and Persona: Knight, or Persona: Healed');
  });
});
