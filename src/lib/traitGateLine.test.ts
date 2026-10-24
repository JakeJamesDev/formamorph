import { describe, it, expect } from 'vitest';
import { gateLine, gateLineParts } from './traitGateLine';
import { gateOf, gateStates, type ConditionState, type GateInput, type GateOwner, type GateState } from './traitGates';
import { scoped } from './scope';
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

describe('gateLineParts', () => {
  const kate = (text: string, holds = false): ConditionState => ({ ...c(`Kate: ${text}`, holds), persona: 'Kate' });

  it("splits the played persona's name off its Condition, and runs the text around it together", () => {
    expect(gateLineParts(gate([c('Knight'), kate('Paladin')], [c('Mercenary')])))
      .toEqual(['Requires Knight and ', { persona: 'Kate' }, ': Paladin, or Mercenary']);
    expect(gateLineParts(gate([kate('not Paladin', true)]))).toEqual(['Unlocked by ', { persona: 'Kate' }, ': not Paladin']);
    expect(gateLineParts(gate([kate('Paladin')], [kate('Knight')]))).toEqual(['Requires ', { persona: 'Kate' }, ': Paladin or ', { persona: 'Kate' }, ': Knight']);
  });

  it('reads one text part for a line with no persona, and the same text as gateLine', () => {
    expect(gateLineParts(gate([c('Knight'), c('Heavy Build')], [c('Mercenary')]))).toEqual(['Requires Knight and Heavy Build, or Mercenary']);
    expect(gateLine(gate([c('Knight'), kate('Paladin')], [c('Mercenary')]))).toBe('Requires Knight and Kate: Paladin, or Mercenary');
    expect(gateLineParts(gate([c('Secret Bond', false, true)]))).toEqual(['Locked']);
    expect(gateLineParts(gate())).toBeNull();
  });
});

describe('gateLine with Not Conditions', () => {
  const T = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
  const not = (req: TraitRequirement): TraitRequirement => ({ ...req, not: true }) as TraitRequirement;
  const trait = (id: string, extra: Partial<TraitRequirement> = {}) => ({ kind: 'trait', id, ...extra }) as TraitRequirement;
  const wolf: GateOwner = { id: 'wolf', name: 'Ash', groups: [], traits: [T('Tamed')] };
  const lineOf = (gated: Trait, active: string[] = [], extra: Partial<GateInput> = {}) => {
    const traits = [T('Knight', { groupId: 'Class' }), T('Paladin'), T('Mercenary'), T('Bond', { mode: 'hidden' }), gated];
    const input: GateInput = {
      global: { traits, groups: [{ id: 'Class', name: 'Class', parentId: null }] },
      owners: [wolf],
      active: scoped(active),
      entities: [{ id: 'wolf', name: 'Ash' }, { id: 'aldric', name: 'Sir Aldric', persona: true }],
      persona: { source: 'none' },
      ...extra,
    };
    return gateLine(gateOf(gateStates(input), null, gated.id));
  };

  it('reads "not X" inside the rule', () => {
    const smarts = T('Smarts', { requires: [{ all: [trait('Knight'), not(trait('Paladin'))] }, { all: [trait('Mercenary')] }] });
    expect(lineOf(smarts)).toBe('Requires Knight and not Paladin, or Mercenary');
    expect(lineOf(smarts, ['Knight'])).toBe('Unlocked by Knight and not Paladin');
  });

  it('reads Not on a group, a persona, and an owner (Q11)', () => {
    const many = T('Drifter', {
      requires: [
        { all: [not({ kind: 'playingAs', id: 'aldric' }), not(trait('Tamed', { owner: { kind: 'entity', id: 'wolf' } }))] },
        { all: [not(trait('Paladin', { owner: { kind: 'you' } })), not({ kind: 'group', id: 'Class' })] },
      ],
    });
    expect(lineOf(many)).toBe('Unlocked by not playing as Sir Aldric and Ash: not Tamed, or Persona: not Paladin and not any Class');
    expect(lineOf(many, ['Paladin', 'Knight'], { persona: { source: 'world', entityId: 'aldric' } }))
      .toBe('Requires not playing as Sir Aldric and Ash: not Tamed, or Persona: not Paladin and not any Class');
  });

  it("reads the played persona's name to the player (Q7)", () => {
    const squire = T('Squire', { requires: [{ all: [not(trait('Paladin', { owner: { kind: 'you' } })), not(trait('Tamed', { owner: { kind: 'entity', id: 'wolf' } }))] }] });
    expect(lineOf(squire, [], { persona: { source: 'world', entityId: 'aldric' }, reader: 'player' }))
      .toBe('Unlocked by Sir Aldric: not Paladin and Ash: not Tamed');
    expect(lineOf(squire, [], { reader: 'player' })).toBe('Unlocked by Persona: not Paladin and Ash: not Tamed');
  });

  it('leaves a Not Condition on a Hidden target out, like a plain one (Q12)', () => {
    expect(lineOf(T('Wild', { requires: [{ all: [trait('Knight'), not(trait('Bond'))] }] }))).toBe('Requires Knight');
    expect(lineOf(T('Wild', { requires: [{ all: [not(trait('Bond'))] }] }), ['Bond'])).toBe('Locked');
  });
});
