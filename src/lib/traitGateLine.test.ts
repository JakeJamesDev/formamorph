import { describe, it, expect } from 'vitest';
import { gateLine } from './traitGateLine';
import { WORLD_OWNER, gateOf, gateStates, type ConditionState, type GateInput, type GateOwner, type GateState } from './traitGates';
import type { Trait, TraitRequirement } from '@/types';

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

describe('gateLine with Not Conditions', () => {
  const T = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
  const not = (req: TraitRequirement): TraitRequirement => ({ ...req, not: true });
  const trait = (id: string, extra: Partial<TraitRequirement> = {}) => ({ kind: 'trait', id, ...extra }) as TraitRequirement;
  const wolf: GateOwner = { id: 'wolf', name: 'Ash', groups: [], traits: [T('Tamed')] };
  const lineOf = (gated: Trait, active: string[] = [], extra: Partial<GateInput> = {}) => {
    const traits = [T('Knight', { groupId: 'Class' }), T('Paladin'), T('Mercenary'), T('Bond', { mode: 'hidden' }), gated];
    const input: GateInput = {
      owners: [{ id: WORLD_OWNER, name: '', traits, groups: [{ id: 'Class', name: 'Class', parentId: null }] }, wolf],
      active: { [WORLD_OWNER]: active },
      entities: [{ id: 'wolf', name: 'Ash' }, { id: 'aldric', name: 'Sir Aldric', persona: true }],
      persona: { source: 'none' },
      ...extra,
    };
    return gateLine(gateOf(gateStates(input), WORLD_OWNER, gated.id));
  };

  it('reads "not X" inside the rule', () => {
    const smarts = T('Smarts', { requires: [{ all: [trait('Knight'), not(trait('Paladin'))] }, { all: [trait('Mercenary')] }] });
    expect(lineOf(smarts)).toBe('Requires Knight and not Paladin, or Mercenary');
    expect(lineOf(smarts, ['Knight'])).toBe('Unlocked by Knight and not Paladin');
  });

  it('reads Not on a group, a persona, and a bearer (Q11)', () => {
    const many = T('Drifter', {
      requires: [
        { all: [not({ kind: 'playingAs', id: 'aldric' }), not(trait('Tamed', { bearer: { kind: 'entity', id: 'wolf' } }))] },
        { all: [not(trait('Paladin', { bearer: { kind: 'you' } })), not({ kind: 'group', id: 'Class' })] },
      ],
    });
    expect(lineOf(many)).toBe('Unlocked by not playing as Sir Aldric and Ash: not Tamed, or You: not Paladin and not any Class');
    expect(lineOf(many, ['Paladin', 'Knight'], { persona: { source: 'world', entityId: 'aldric' } }))
      .toBe('Requires not playing as Sir Aldric and Ash: not Tamed, or You: not Paladin and not any Class');
  });

  it('leaves a Not Condition on a Hidden target out, like a plain one (Q12)', () => {
    expect(lineOf(T('Wild', { requires: [{ all: [trait('Knight'), not(trait('Bond'))] }] }))).toBe('Requires Knight');
    expect(lineOf(T('Wild', { requires: [{ all: [not(trait('Bond'))] }] }), ['Bond'])).toBe('Locked');
  });
});
