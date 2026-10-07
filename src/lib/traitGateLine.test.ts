import { describe, it, expect } from 'vitest';
import { gateLine } from './traitGateLine';
import type { ConditionState, GateState } from './traitGates';

const c = (text: string, holds = false, hidden = false): ConditionState => ({ text, holds, unresolved: false, hidden });
/** A gate of `rows`, each row holding when every Condition in it holds. */
const gate = (...rows: ConditionState[][]): GateState => {
  const states = rows.map((conditions) => ({ holds: conditions.every((x) => x.holds), conditions }));
  return { unlocked: states.length === 0 || states.some((r) => r.holds), rows: states };
};

describe('gateLine', () => {
  it('reads nothing for a trait with no rows', () => {
    expect(gateLine(gate())).toBeNull();
    expect(gateLine(undefined)).toBeNull();
  });

  it('reads one-chip rows joined by "or"', () => {
    expect(gateLine(gate([c('Paladin')]))).toBe('Requires Paladin');
    expect(gateLine(gate([c('Paladin')], [c('Knight')]))).toBe('Requires Paladin or Knight');
    expect(gateLine(gate([c('Paladin')], [c('Knight')], [c('Mage')]))).toBe('Requires Paladin, Knight, or Mage');
  });

  it('joins Conditions in a row with "and", and closes the row with a comma before "or"', () => {
    expect(gateLine(gate([c('Knight'), c('Heavy Build')]))).toBe('Requires Knight and Heavy Build');
    expect(gateLine(gate([c('Knight'), c('Heavy Build')], [c('Mercenary')]))).toBe('Requires Knight and Heavy Build, or Mercenary');
    expect(gateLine(gate([c('Mercenary')], [c('Knight'), c('Heavy Build')]))).toBe('Requires Mercenary, or Knight and Heavy Build');
  });

  it('names only the rows that hold on an open trait', () => {
    expect(gateLine(gate([c('Knight', true), c('Heavy Build', true)], [c('Mercenary')]))).toBe('Unlocked by Knight and Heavy Build');
    expect(gateLine(gate([c('Knight', true), c('Heavy Build')], [c('Mercenary', true)]))).toBe('Unlocked by Mercenary');
  });

  it('leaves a Hidden Condition out of its row, and drops a row with none left (Q12)', () => {
    expect(gateLine(gate([c('Knight'), c('Secret Bond', false, true)], [c('Mercenary')]))).toBe('Requires Knight or Mercenary');
    expect(gateLine(gate([c('Secret Bond', false, true)], [c('Mercenary')]))).toBe('Requires Mercenary');
    expect(gateLine(gate([c('Secret Bond', true, true)], [c('Mercenary', true)]))).toBe('Unlocked by Mercenary');
  });

  it('reads "Locked" when every row is Hidden, and nothing when only a Hidden row opened it', () => {
    expect(gateLine(gate([c('Secret Bond', false, true)], [c('Omen', false, true)]))).toBe('Locked');
    expect(gateLine(gate([c('Secret Bond', true, true)]))).toBeNull();
  });

  it('shows Hidden Conditions to author tools', () => {
    expect(gateLine(gate([c('Knight'), c('Secret Bond', false, true)]), { revealHidden: true })).toBe('Requires Knight and Secret Bond');
  });
});
