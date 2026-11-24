import { describe, it, expect } from 'vitest';
import { gateLine } from './traitGateLine';
import { gateOf, gateStates, type ConditionState, type GateInput, type GateOwner, type GateState } from './traitGates';
import { scoped } from './scope';
import type { Trait, TraitRequirement } from '@/types';

const c = (clause: string, holds = false, hidden = false): ConditionState => ({ text: clause, clause, holds, unresolved: false, hidden });
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

  it('reads one-clause rows joined by "or", with a colon and a final period', () => {
    expect(gateLine(gate([c('you have Paladin')]))).toBe('Requires: you have Paladin.');
    expect(gateLine(gate([c('you have Paladin')], [c('you have Knight')]))).toBe('Requires: you have Paladin or you have Knight.');
    expect(gateLine(gate([c('A')], [c('B')], [c('C')]))).toBe('Requires: A, B, or C.');
  });

  it('joins clauses in a row with "and", and closes the row with a comma before "or"', () => {
    expect(gateLine(gate([c('A'), c('B')]))).toBe('Requires: A and B.');
    expect(gateLine(gate([c('A'), c('B')], [c('C')]))).toBe('Requires: A and B, or C.');
    expect(gateLine(gate([c('C')], [c('A'), c('B')]))).toBe('Requires: C, or A and B.');
  });

  it('names only the rows that hold on an open trait', () => {
    expect(gateLine(gate([c('A', true), c('B', true)], [c('C')]))).toBe('Unlocked by: A and B.');
    expect(gateLine(gate([c('A', true), c('B')], [c('C', true)]))).toBe('Unlocked by: C.');
  });

  it('leaves a Hidden Condition out of its row, and drops a row with none left (Q12)', () => {
    expect(gateLine(gate([c('A'), c('S', false, true)], [c('C')]))).toBe('Requires: A or C.');
    expect(gateLine(gate([c('S', false, true)], [c('C')]))).toBe('Requires: C.');
    expect(gateLine(gate([c('S', true, true)], [c('C', true)]))).toBe('Unlocked by: C.');
  });

  it('reads a bare "Locked" when every row is Hidden, and nothing when only a Hidden row opened it', () => {
    expect(gateLine(gate([c('S', false, true)], [c('O', false, true)]))).toBe('Locked');
    expect(gateLine(gate([c('S', true, true)]))).toBeNull();
  });

  it('shows Hidden Conditions to author tools', () => {
    expect(gateLine(gate([c('A'), c('S', false, true)]), { revealHidden: true })).toBe('Requires: A and S.');
  });
});

describe('gateLine from real Conditions', () => {
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

  it('reads each world trait Condition with no subject, and "not X" inside the rule', () => {
    const smarts = T('Smarts', { requires: [{ all: [trait('Knight'), not(trait('Paladin'))] }, { all: [trait('Mercenary')] }] });
    expect(lineOf(smarts)).toBe('Requires: Knight is active and Paladin is not active, or Mercenary is active.');
    expect(lineOf(smarts, ['Knight'])).toBe('Unlocked by: Knight is active and Paladin is not active.');
  });

  it('gives a world trait or group no subject on the player\'s line (Q25)', () => {
    const smarts = T('Smarts', { requires: [{ all: [trait('Knight'), not({ kind: 'group', id: 'Class' })] }, { all: [trait('Mercenary')] }] });
    expect(lineOf(smarts, [], { reader: 'player', persona: { source: 'world', entityId: 'aldric' } }))
      .toBe('Requires: Knight is active and no trait in Class is active, or Mercenary is active.');
  });

  it('reads Not on a group, a persona and an owner (Q11)', () => {
    const many = T('Drifter', {
      requires: [
        { all: [not({ kind: 'playingAs', id: 'aldric' }), not(trait('Tamed', { owner: { kind: 'entity', id: 'wolf' } }))] },
        { all: [not(trait('Paladin', { owner: { kind: 'you' } })), not({ kind: 'group', id: 'Class' })] },
      ],
    });
    expect(lineOf(many)).toBe("Unlocked by: the player is not Sir Aldric and Ash doesn't have Tamed, or the player doesn't have Paladin and no trait in Class is active.");
    expect(lineOf(many, ['Paladin', 'Knight'], { persona: { source: 'world', entityId: 'aldric' } }))
      .toBe("Requires: the player is not Sir Aldric and Ash doesn't have Tamed, or the player doesn't have Paladin and no trait in Class is active.");
  });

  it('reads the played persona as "you" to the player, never by name (Q18)', () => {
    const squire = T('Squire', { requires: [{ all: [not(trait('Paladin', { owner: { kind: 'you' } })), not(trait('Tamed', { owner: { kind: 'entity', id: 'wolf' } }))] }] });
    const line = "Unlocked by: you don't have Paladin and Ash doesn't have Tamed.";
    expect(lineOf(squire, [], { persona: { source: 'world', entityId: 'aldric' }, reader: 'player' })).toBe(line);
    expect(lineOf(squire, [], { reader: 'player' })).toBe(line);
  });

  it('reads a persona Condition as "you are" / "you are not" to the player', () => {
    const duelist = T('Duelist', { requires: [{ all: [{ kind: 'playingAs', id: 'aldric' }] }] });
    expect(lineOf(duelist, [], { reader: 'player' })).toBe('Requires: you are Sir Aldric.');
    expect(lineOf(T('Squire', { requires: [{ all: [not({ kind: 'playingAs', id: 'aldric' })] }] }), [], { reader: 'player', persona: { source: 'none' } }))
      .toBe('Unlocked by: you are not Sir Aldric.');
  });

  it('reads an owner who is the played entity as "you" to the player', () => {
    const duelist = T('Duelist', { requires: [{ all: [trait('Tamed', { owner: { kind: 'entity', id: 'wolf' } })] }] });
    expect(lineOf(duelist, [], { reader: 'player', persona: { source: 'world', entityId: 'wolf' }, entities: [{ id: 'wolf', name: 'Ash', persona: true }] }))
      .toBe('Requires: you have Tamed.');
  });

  it('leaves a Not Condition on a Hidden target out, like a plain one (Q12)', () => {
    expect(lineOf(T('Wild', { requires: [{ all: [trait('Knight'), not(trait('Bond'))] }] }))).toBe('Requires: Knight is active.');
    expect(lineOf(T('Wild', { requires: [{ all: [not(trait('Bond'))] }] }), ['Bond'])).toBe('Locked');
  });
});
