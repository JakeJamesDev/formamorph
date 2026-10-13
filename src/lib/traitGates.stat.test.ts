import { describe, it, expect } from 'vitest';
import type { PersonaRef, StatComparison, StatRequirement, Trait, TraitRequirement } from '@/types';
import {
  WORLD_OWNER, deadRows, gateOf, gateStates, neverUnlockable, sameRequirement, settle, settleDefaults, unstableCycles,
  type GateInput, type GateOwner, type GateStat,
} from './traitGates';
import { gateLine } from './traitGateLine';
import { summarizeRequirement } from './requirementSummary';

const T = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const trait = (id: string, extra: Partial<TraitRequirement> = {}): TraitRequirement => ({ kind: 'trait', id, ...extra } as TraitRequirement);
const stat = (id: string, operator: StatComparison, value: number, extra: Partial<StatRequirement> = {}): StatRequirement =>
  ({ kind: 'stat', id, operator, value, unit: 'raw', ...extra });
const S = (name: string, value: number, extra: Partial<GateStat> = {}): GateStat => ({ name, value, min: 0, max: 100, ...extra });
const gated = (...all: TraitRequirement[]) => T('Berserk', { requires: [{ all }] });

const input = (
  traits: Trait[], stats: GateInput['stats'], active: string[] = [], extra: Partial<GateInput> = {},
): GateInput => ({
  owners: [{ id: WORLD_OWNER, name: '', traits, groups: [] }],
  active: { [WORLD_OWNER]: active },
  entities: [],
  persona: { source: 'none' } as PersonaRef,
  stats,
  ...extra,
});

const rage = (value: number, extra: Partial<GateStat> = {}) => ({ [WORLD_OWNER]: { rage: S('Rage', value, extra) } });
const gate = (i: GateInput, id = 'Berserk', owner = WORLD_OWNER) => gateOf(gateStates(i), owner, id);
const unlocked = (req: TraitRequirement, stats: GateInput['stats']) => gate(input([gated(req)], stats))?.unlocked;

describe('stat Conditions', () => {
  // Each operator just below, at and just above 80.
  const cases: [StatComparison, [boolean, boolean, boolean]][] = [
    ['>', [false, false, true]],
    ['<', [true, false, false]],
    ['>=', [false, true, true]],
    ['<=', [true, true, false]],
    ['=', [false, true, false]],
    ['≠', [true, false, true]],
  ];

  it.each(cases)('compares raw %s at the boundary', (op, expected) => {
    expect([79, 80, 81].map((v) => unlocked(stat('rage', op, 80), rage(v)))).toEqual(expected);
  });

  it.each(cases)('compares percent %s at the boundary of the min→max span', (op, expected) => {
    // Span 50→250: 20% sits at 90.
    const at = (v: number) => ({ [WORLD_OWNER]: { rage: S('Rage', v, { min: 50, max: 250 }) } });
    expect([88, 90, 92].map((v) => unlocked(stat('rage', op, 20, { unit: 'percent' }), at(v)))).toEqual(expected);
  });

  it('compares = and ≠ on the rounded number the stat bar shows', () => {
    expect(unlocked(stat('rage', '=', 20), rage(20.4))).toBe(true);
    expect(unlocked(stat('rage', '=', 20), rage(20.6))).toBe(false);
    expect(unlocked(stat('rage', '≠', 20), rage(19.6))).toBe(false);
    expect(unlocked(stat('rage', '=', 20, { unit: 'percent' }), rage(19.7))).toBe(true);
    // The ordered operators read the exact value.
    expect(unlocked(stat('rage', '>', 20), rage(20.4))).toBe(true);
  });

  it('flips under Not', () => {
    expect(unlocked(stat('rage', '>=', 80, { not: true }), rage(85))).toBe(false);
    expect(unlocked(stat('rage', '>=', 80, { not: true }), rage(60))).toBe(true);
  });

  it('reads a zero span as 0% (Q22)', () => {
    const flat = { [WORLD_OWNER]: { rage: S('Rage', 50, { min: 50, max: 50 }) } };
    expect(unlocked(stat('rage', '=', 0, { unit: 'percent' }), flat)).toBe(true);
    expect(unlocked(stat('rage', '>', 0, { unit: 'percent' }), flat)).toBe(false);
  });

  it('never holds a missing stat, an inert stat or a missing bearer, even under Not', () => {
    for (const not of [undefined, true] as const) {
      const req = stat('rage', '<', 1000, not ? { not } : {});
      expect(unlocked(req, {})).toBe(false);
      expect(unlocked(req, undefined)).toBe(false);
      expect(unlocked(req, rage(10, { inert: true }))).toBe(false);
      expect(unlocked({ ...req, owner: { kind: 'entity', id: 'gone', name: 'Ash' } }, { gone: { rage: S('Rage', 10) } })).toBe(false);
    }
  });

  it('reports an unresolved stat Condition by its stored name', () => {
    const state = gate(input([gated(stat('rage', '>=', 80, { name: 'Rage' }))], rage(90, { inert: true })));
    expect(state?.rows[0].conditions[0]).toMatchObject({ text: 'Rage >= 80', unresolved: true });
    expect(gate(input([gated(stat('fury', '>', 5, { name: 'Fury' }))], {}))?.rows[0].conditions[0])
      .toMatchObject({ text: 'Fury > 5', unresolved: true });
  });

  describe('bearers', () => {
    const ash: GateOwner = { id: 'ash', name: 'Ash', traits: [], groups: [] };
    const hero: GateOwner = { id: 'hero', name: 'Hero', traits: [], groups: [] };
    const entities = [{ id: 'ash', name: 'Ash' }, { id: 'hero', name: 'Hero', persona: true }];
    const stats = { ash: { hunger: S('Hunger', 75) }, hero: { grit: S('Grit', 30) } };
    const owners = (traits: Trait[]) => [{ id: WORLD_OWNER, name: '', traits, groups: [] }, ash, hero];

    it('reads a named entity bearer’s stat', () => {
      const req = stat('hunger', '>', 70, { owner: { kind: 'entity', id: 'ash' } });
      const i = input([gated(req)], stats, [], { owners: owners([gated(req)]), entities });
      expect(gate(i)?.unlocked).toBe(true);
      expect(gate(i)?.rows[0].conditions[0].text).toBe('Ash: Hunger > 70');
    });

    it('reads the played persona’s own stats through You', () => {
      const req = stat('grit', '>=', 30, { owner: { kind: 'you' } });
      const withPersona = (persona: PersonaRef) => input([gated(req)], stats, [], { owners: owners([gated(req)]), entities, persona });
      expect(gate(withPersona({ source: 'world', entityId: 'hero' }))?.unlocked).toBe(true);
      expect(gate(withPersona({ source: 'none' }))?.unlocked).toBe(false);
    });

    it('reads its own entity’s stats with no bearer, never another owner’s', () => {
      const own = T('Fed', { requires: [{ all: [stat('hunger', '<', 80)] }] });
      const i = input([], stats, [], { owners: [{ id: WORLD_OWNER, name: '', traits: [own], groups: [] }, { ...ash, traits: [own] }], entities });
      expect(gate(i, 'Fed', 'ash')?.unlocked).toBe(true);
      expect(gate(i, 'Fed', WORLD_OWNER)?.unlocked).toBe(false);
    });
  });

  describe('the player’s line', () => {
    it('renders a stat Condition with % under percent', () => {
      const i = input([gated(stat('rage', '>=', 80), stat('rage', '<', 20, { unit: 'percent', not: true }))], rage(10));
      expect(gateLine(gate(i))).toBe('Requires Rage >= 80 and not Rage < 20%');
    });

    it('leaves out a hidden or inert stat and drops a row left empty', () => {
      const traits = [T('Berserk', { requires: [{ all: [stat('rage', '>=', 80)] }, { all: [stat('calm', '<', 5), trait('Knight')] }] }), T('Knight')];
      const stats = { [WORLD_OWNER]: { rage: S('Rage', 10, { hidden: true }), calm: S('Calm', 50, { inert: true }) } };
      expect(gateLine(gate(input(traits, stats)))).toBe('Requires Knight');
      expect(gateLine(gate(input(traits, stats)), { revealHidden: true })).toBe('Requires Rage >= 80, or Calm < 5 and Knight');
    });
  });
});

describe('stat Conditions as settle reads them', () => {
  it('starts a stat-gated default only when the stat holds at the start', () => {
    const traits = [T('Berserk', { isDefault: true, requires: [{ all: [stat('rage', '>=', 80)] }] }), T('Knight', { isDefault: true })];
    expect(settleDefaults(input(traits, rage(85))).active[WORLD_OWNER]).toEqual(['Berserk', 'Knight']);
    expect(settleDefaults(input(traits, rage(70))).active[WORLD_OWNER]).toEqual(['Knight']);
  });

  it('settles a stat Condition beside trait Conditions in one row, growth and drop', () => {
    const traits = [T('Knight'), T('Cursed'), gated(trait('Knight'), stat('rage', '>=', 80), trait('Cursed', { not: true }))];
    const active = (stats: GateInput['stats'], picks: string[]) => settle(input(traits, stats, picks)).active[WORLD_OWNER];
    expect(active(rage(90), ['Knight', 'Berserk'])).toEqual(['Knight', 'Berserk']);
    expect(active(rage(70), ['Knight', 'Berserk'])).toEqual(['Knight']);
    expect(active(rage(90), ['Berserk'])).toEqual([]);
    expect(active(rage(90), ['Knight', 'Cursed', 'Berserk'])).toEqual(['Knight', 'Cursed']);
  });

  it('turns off a pick a Not stat Condition fails without blaming an unrelated returner', () => {
    // Berserk holds while Rage is not above 50; Rage is 60. Watch waits on the cascade-off list with an open gate.
    const traits = [gated(stat('rage', '>', 50, { not: true })), T('Watch')];
    const result = settle(input(traits, rage(60), ['Berserk']), { [WORLD_OWNER]: ['Watch'] });
    expect(result.active[WORLD_OWNER]).toEqual(['Watch']);
    expect(result.returned).toEqual([{ ownerId: WORLD_OWNER, traitId: 'Watch' }]);
    expect(result.turnedOff).toEqual([{ ownerId: WORLD_OWNER, traitId: 'Berserk' }]);
  });

  it('returns a stat-gated trait from the cascade-off list once the stat holds again', () => {
    const traits = [gated(stat('rage', '>=', 80))];
    const off = settle(input(traits, rage(70), ['Berserk']));
    expect(off.cascadeOff[WORLD_OWNER]).toEqual(['Berserk']);
    expect(settle(input(traits, rage(85), []), off.cascadeOff).active[WORLD_OWNER]).toEqual(['Berserk']);
  });
});

describe('stat Conditions in the static analyses (Q20)', () => {
  const analyzed = (traits: Trait[]): Omit<GateInput, 'active'> =>
    ({ owners: [{ id: WORLD_OWNER, name: '', traits, groups: [] }], entities: [], persona: { source: 'none' } });

  it('never reports a stat-gated trait never-unlockable, plain or Not, with or without stat values', () => {
    const traits = [gated(stat('rage', '>=', 80)), T('Calm', { requires: [{ all: [stat('rage', '>=', 80, { not: true })] }] })];
    expect(neverUnlockable(analyzed(traits))).toEqual([]);
  });

  it('still reports a row whose trait Conditions conflict, beside a stat Condition', () => {
    const traits = [T('Knight'), gated(stat('rage', '>=', 80), trait('Knight'), trait('Knight', { not: true }))];
    expect(deadRows(analyzed(traits))).toEqual([{ ownerId: WORLD_OWNER, traitId: 'Berserk', row: 0 }]);
    const loop = [T('A', { requires: [{ all: [stat('rage', '>', 1), trait('B')] }] }), T('B', { requires: [{ all: [trait('A')] }] })];
    expect(neverUnlockable(analyzed(loop))).toEqual([[{ ownerId: WORLD_OWNER, traitId: 'A' }, { ownerId: WORLD_OWNER, traitId: 'B' }]]);
  });

  it('never reads two stat Conditions on one stat as a dead row or a loop', () => {
    const traits = [gated(stat('rage', '>', 20), stat('rage', '>', 20, { not: true }), stat('rage', '<', 80))];
    expect(deadRows(analyzed(traits))).toEqual([]);
    expect(unstableCycles(analyzed(traits))).toEqual([]);
  });
});

describe('stat Condition equality', () => {
  const between = [stat('rage', '>', 20), stat('rage', '<', 80)];

  it('keeps "Rage > 20 and Rage < 80" as two Conditions', () => {
    expect(sameRequirement(between[0], between[1])).toBe(false);
    expect(sameRequirement(between[0], stat('rage', '>', 30))).toBe(false);
    expect(sameRequirement(between[0], stat('rage', '>', 20, { unit: 'percent' }))).toBe(false);
    expect(sameRequirement(between[0], stat('rage', '>', 20, { name: 'Rage' }))).toBe(true);
  });

  it('factors only the exact same comparison into the summary', () => {
    const summary = summarizeRequirement([{ all: [...between] }, { all: [stat('rage', '>', 20), stat('rage', '<', 50)] }]);
    expect(summary?.needs).toEqual([between[0]]);
    expect(summary?.options.map((o) => o.needs)).toEqual([[between[1]], [stat('rage', '<', 50)]]);
  });
});
