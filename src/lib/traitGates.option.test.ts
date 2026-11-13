import { describe, it, expect } from 'vitest';
import type { OptionRequirement, StatComparison, Trait, WorldOption, WorldOptionValues } from '@/types';
import {
  NO_ACTIVE, complementary, deadRows, flipped, gateStates, gateOf, neverUnlockable, optionRequirement, requirementOptions, ruleStates, sameRequirement,
  type GateInput,
} from './traitGates';
import { gateLine } from './traitGateLine';
import { buildEntityCardData, parseEntityCardData } from './entityFile';
import { conditionsOf } from './requirementRows';
import { activeTraits, settleTraits, type TraitRuntimeState, type TraitWorld } from './traitRuntime';
import type { Entity } from '@/types';

const LENGTH: WorldOption = {
  id: 'len', name: 'Reply Length', type: 'choice', shownToPlayer: true, midGame: false,
  values: [{ id: 'short', name: 'Short' }, { id: 'long', name: 'Long' }], default: 'short',
};
const LIT: WorldOption = { id: 'lit', name: 'Lanterns Lit', type: 'boolean', shownToPlayer: true, midGame: false, default: false };
const HEAT: WorldOption = { id: 'heat', name: 'Heat', type: 'number', shownToPlayer: true, midGame: false, min: 0, max: 10, default: 3 };
const SECRET: WorldOption = { id: 'secret', name: 'Secret Flag', type: 'boolean', shownToPlayer: false, midGame: false, default: false };
const OPTIONS = [LENGTH, LIT, HEAT, SECRET];

const choice = (valueId: string, not?: true): OptionRequirement => ({ kind: 'option', id: 'len', valueId, ...(not && { not }) });
const lit = (not?: true): OptionRequirement => ({ kind: 'option', id: 'lit', ...(not && { not }) });
const heat = (operator: StatComparison, value: number): OptionRequirement => ({ kind: 'option', id: 'heat', operator, value });
const T = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });

const input = (traits: Trait[], values?: WorldOptionValues, options: readonly WorldOption[] = OPTIONS): GateInput => ({
  global: { traits, groups: [] },
  owners: [],
  active: NO_ACTIVE,
  entities: [],
  persona: { source: 'none' },
  worldOptions: options,
  ...(values ? { optionValues: values } : {}),
});
const gateFor = (req: OptionRequirement, values?: WorldOptionValues, options?: readonly WorldOption[]) =>
  gateOf(gateStates(input([T('a', { requires: [{ all: [req] }] })], values, options)), null, 'a')!;
const unlocked = (req: OptionRequirement, values?: WorldOptionValues) => gateFor(req, values).unlocked;

describe('a World Option Condition', () => {
  it('on a choice holds while the Option holds its value, and Not flips it', () => {
    expect(unlocked(choice('long'), { len: 'long' })).toBe(true);
    expect(unlocked(choice('long'), { len: 'short' })).toBe(false);
    expect(unlocked(choice('long', true), { len: 'short' })).toBe(true);
    expect(unlocked(choice('long', true), { len: 'long' })).toBe(false);
  });

  it('on a boolean holds while it is on, and Not holds while it is off', () => {
    expect(unlocked(lit(), { lit: true })).toBe(true);
    expect(unlocked(lit(), { lit: false })).toBe(false);
    expect(unlocked(lit(true), { lit: false })).toBe(true);
    expect(unlocked(lit(true), { lit: true })).toBe(false);
  });

  it('on a number compares with every stat operator', () => {
    const at = (operator: StatComparison, value: number, held: number) => unlocked(heat(operator, value), { heat: held });
    expect([at('>', 4, 5), at('>', 5, 5)]).toEqual([true, false]);
    expect([at('<', 6, 5), at('<', 5, 5)]).toEqual([true, false]);
    expect([at('>=', 5, 5), at('>=', 6, 5)]).toEqual([true, false]);
    expect([at('<=', 5, 5), at('<=', 4, 5)]).toEqual([true, false]);
    expect([at('=', 5, 5), at('=', 4, 5)]).toEqual([true, false]);
    expect([at('≠', 4, 5), at('≠', 5, 5)]).toEqual([true, false]);
  });

  it('reads each Option’s default when the input holds no value for it (Q25)', () => {
    expect(unlocked(choice('short'))).toBe(true);
    expect(unlocked(lit(true))).toBe(true);
    expect(unlocked(heat('=', 3))).toBe(true);
    // A stored value the Option no longer accepts reads the default too.
    expect(unlocked(choice('short'), { len: 'gone' })).toBe(true);
    expect(unlocked(heat('=', 3), { heat: 99 })).toBe(true);
  });

  it('never holds and reads unresolved when its Option, its value or its type is gone', () => {
    const missing = gateFor({ kind: 'option', id: 'nope', name: 'Old Switch' });
    expect(missing.unlocked).toBe(false);
    expect(missing.rows[0].conditions[0]).toMatchObject({ unresolved: true, text: 'Old Switch is on' });
    const value = gateFor({ kind: 'option', id: 'len', valueId: 'gone', valueName: 'Medium', not: true });
    expect(value.unlocked).toBe(false);
    expect(value.rows[0].conditions[0]).toMatchObject({ unresolved: true, text: 'Reply Length is not Medium' });
    // A choice Condition on an Option the author turned into a number.
    const retyped = gateFor(choice('short'), undefined, [{ ...HEAT, id: 'len' }]);
    expect(retyped.unlocked).toBe(false);
    expect(retyped.rows[0].conditions[0].unresolved).toBe(true);
  });

  it('reads as words', () => {
    const text = (req: OptionRequirement) => gateFor(req).rows[0].conditions[0].text;
    expect(text(choice('short'))).toBe('Reply Length is Short');
    expect(text(choice('long', true))).toBe('Reply Length is not Long');
    expect(text(lit())).toBe('Lanterns Lit is on');
    expect(text(lit(true))).toBe('Lanterns Lit is off');
    expect(text(heat('>=', 3))).toBe('Heat >= 3');
  });

  it('compares by Option, value and comparison, and pairs with its complement', () => {
    expect(sameRequirement(choice('short'), choice('short'))).toBe(true);
    expect(sameRequirement(choice('short'), choice('long'))).toBe(false);
    expect(sameRequirement(heat('>', 3), heat('>', 4))).toBe(false);
    expect(complementary(choice('short'), choice('short', true))).toBe(true);
    expect(complementary(lit(), lit(true))).toBe(true);
    expect(complementary(heat('>', 3), heat('<=', 3))).toBe(true);
    expect(flipped(heat('>', 3))).toEqual(heat('<=', 3));
  });

  it('marks a row dead when no value of one Option meets it', () => {
    const dead = (...all: OptionRequirement[]) => deadRows(input([T('a', { requires: [{ all }] })])).length > 0;
    expect(dead(choice('short'), choice('long'))).toBe(true);
    expect(dead(choice('short'), choice('short', true))).toBe(true);
    expect(dead(lit(), lit(true))).toBe(true);
    expect(dead(choice('short', true), choice('long', true))).toBe(false);
    expect(dead(heat('>', 3), heat('<', 6))).toBe(false);
  });

  it('counts as reachable, since a script can write any Option (Q17)', () => {
    expect(neverUnlockable(input([T('a', { requires: [{ all: [choice('long')] }] })]))).toEqual([]);
  });

  it('is offered once per Option in the picker, starting on its default', () => {
    const offered = requirementOptions(input([T('a')]), 'a').worldOptions!.map((o) => o.requirement);
    expect(offered).toEqual([
      { kind: 'option', id: 'len', name: 'Reply Length', valueId: 'short', valueName: 'Short' },
      { kind: 'option', id: 'lit', name: 'Lanterns Lit' },
      { kind: 'option', id: 'heat', name: 'Heat', operator: '>=', value: 3 },
      { kind: 'option', id: 'secret', name: 'Secret Flag' },
    ]);
    expect(optionRequirement(LIT)).toEqual(offered[1]);
  });
});

describe('the hidden-Option filter', () => {
  const locked = (rows: OptionRequirement[][]) =>
    gateOf(gateStates(input([T('a', { requires: rows.map((all) => ({ all })) })])), null, 'a');

  it('leaves a hidden Option’s Condition out of the player’s line and keeps a shown one', () => {
    const gate = locked([[{ kind: 'option', id: 'secret' }, lit()]]);
    expect(gateLine(gate)).toBe('Requires Lanterns Lit is on');
    expect(gateLine(gate, { revealHidden: true })).toBe('Requires Secret Flag is on and Lanterns Lit is on');
  });

  it('reads "Locked" when only hidden Options remain', () => {
    expect(gateLine(locked([[{ kind: 'option', id: 'secret' }]]))).toBe('Locked');
  });

  it('marks only the hidden Option’s Condition hidden', () => {
    const states = ruleStates(input([]), null, [{ all: [{ kind: 'option', id: 'secret' }, lit()] }]);
    expect(states[0].conditions.map((c) => c.hidden)).toEqual([true, false]);
  });
});

describe('a settle after an Option changes (Q41)', () => {
  const glow = T('glow', { mode: 'alwaysOn', requires: [{ all: [lit()] }] });
  const state: TraitRuntimeState = { stats: [], traits: [], disabledTraitIds: [], appliedValues: {} };
  const world = (values: WorldOptionValues): TraitWorld => ({ traits: [glow], groups: [], options: OPTIONS, optionValues: values });

  it('turns a gated trait on when the Option moves to its value, and off when it moves away', () => {
    const on = settleTraits(state, world({ lit: true }));
    expect(activeTraits(on.state.traits, on.state.disabledTraitIds).map((t) => t.id)).toEqual(['glow']);
    const off = settleTraits(on.state, world({ lit: false }));
    expect(activeTraits(off.state.traits, off.state.disabledTraitIds)).toEqual([]);
  });
});

describe('an Option Condition on a character card', () => {
  it('travels with its stored names and comparison', () => {
    const conditions: OptionRequirement[] = [
      { kind: 'option', id: 'len', name: 'Reply Length', valueId: 'long', valueName: 'Long', not: true },
      { kind: 'option', id: 'heat', name: 'Heat', operator: '<', value: 4 },
    ];
    const entity: Entity = { id: 'e', name: 'Ash', traits: [T('t', { requires: [{ all: conditions }] })] } as Entity;
    const parsed = parseEntityCardData(buildEntityCardData(entity));
    expect(conditionsOf(parsed.traits?.[0].requires)).toEqual(conditions);
  });
});
