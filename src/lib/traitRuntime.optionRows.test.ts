import { describe, it, expect } from 'vitest';
import {
  deriveEffectiveStats, settleTraits, startingStatsWith, statTraitsInForce, type TraitRuntimeState, type TraitWorld,
} from './traitRuntime';
import { activeStatEnabled } from './traitEffects';
import { openingStateOf } from './openingState';
import { buildLens } from './testBench/lens';
import { settledOpeningStats } from './testBench/opening';
import { newBlankWorld } from './blankWorld';
import type { BooleanWorldOption, ChoiceWorldOption, Entity, PlayerStat, Stat, Trait, World, WorldOptionValues } from '@/types';

/** Option stat rows: starting rows at game start, live bounds, regen and toggles after (Q1–Q5, Q7). */

const gold: Stat = { id: 'gold', name: 'Gold', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 1, descriptors: [] };
const hunger: Stat = { id: 'hunger', name: 'Hunger', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], enabled: false };

const difficulty = (over: Partial<ChoiceWorldOption> = {}): ChoiceWorldOption => ({
  id: 'diff', name: 'Difficulty', type: 'choice', shownToPlayer: true, midGame: true, default: 'easy',
  values: [
    {
      id: 'easy', name: 'Easy',
      statChanges: [{ statId: 'gold', type: 'starting', value: 50 }, { statId: 'gold', type: 'max', value: 100 }, { statId: 'gold', type: 'regen', value: 2 }],
    },
    {
      id: 'hard', name: 'Hard',
      statChanges: [{ statId: 'gold', type: 'max', value: -50 }, { statId: 'gold', type: 'regen', value: -1 }],
      statToggles: [{ statId: 'hunger', enabled: true }],
    },
  ],
  ...over,
});

const worldOf = (options: TraitWorld['options'], optionValues?: WorldOptionValues, traits: Trait[] = []): TraitWorld => ({
  traits, groups: [], options, ...(optionValues && { optionValues }),
});

const playerStat = (s: Stat, over: Partial<PlayerStat> = {}): PlayerStat => ({
  ...s, value: s.value ?? 0, baseMin: s.min, baseMax: s.max, baseRegen: s.regen ?? 0, aiMaxDelta: 0, ...over,
});

const stateOf = (stats: PlayerStat[], traits: Trait[] = []): TraitRuntimeState => ({ stats, traits, disabledTraitIds: [], appliedValues: {} });
const goldOf = (stats: readonly PlayerStat[]) => stats.find((s) => s.id === 'gold')!;

describe('Option starting rows at game start', () => {
  it('starts Gold at its authored start plus the picked value’s starting row', () => {
    const world = { stats: [gold], options: [difficulty()] } satisfies Partial<World>;
    expect(goldOf(openingStateOf(world, { traits: [], owned: {}, options: { diff: 'easy' } }).stats)).toMatchObject({ value: 60, max: 200, regen: 3 });
    expect(goldOf(openingStateOf(world, { traits: [], owned: {}, options: { diff: 'hard' } }).stats)).toMatchObject({ value: 10, max: 50, regen: 0 });
  });

  it('applies before the starting traits, so a trait’s start lands inside the Option’s raised max', () => {
    const rich: Trait = { id: 'rich', name: 'Rich', statChanges: [{ statId: 'gold', type: 'starting', value: 120 }] };
    const world = { stats: [gold], traits: [rich], options: [difficulty()] } satisfies Partial<World>;
    expect(goldOf(openingStateOf(world, { traits: ['rich'], owned: {}, options: { diff: 'easy' } }).stats).value).toBe(180);
  });

  it('keeps the Option’s raised max while an entity’s global row applies, so the start is not clamped', () => {
    const boast: Trait = { id: 'boast', name: 'Boast', statChanges: [{ statId: 'gold', type: 'starting', value: 1 }], playerToggle: true };
    const bram = { id: 'bram', name: 'Bram', description: '', locations: [], stats: [{ ...hunger, id: 'vigor', name: 'Vigor' }], traits: [boast] } as Entity;
    const rich = difficulty({ values: [{ id: 'easy', name: 'Easy', statChanges: [{ statId: 'gold', type: 'max', value: 100 }, { statId: 'gold', type: 'starting', value: 80 }] }] });
    const world = { stats: [{ ...gold, value: 50 }], entities: [bram], options: [rich] } satisfies Partial<World>;
    expect(goldOf(openingStateOf(world, { traits: [], owned: { bram: ['boast'] }, options: { diff: 'easy' } }).stats)).toMatchObject({ value: 131, max: 200 });
  });

  it('feeds the Enter World preview the same numbers', () => {
    const stats = startingStatsWith([gold], [], worldOf([difficulty()], { diff: 'easy' }));
    expect(goldOf(stats)).toMatchObject({ value: 60, max: 200 });
  });

  it('applies the lens’s picked values in the Test Bench opening', () => {
    const world: World = { ...newBlankWorld(), stats: [gold], options: [difficulty()] };
    const lens = buildLens(world, { personaId: null, pickedTraitId: null, locationId: null, optionValues: { diff: 'easy' } });
    expect(goldOf(settledOpeningStats(world, lens)).value).toBe(60);
    const hard = buildLens(world, { personaId: null, pickedTraitId: null, locationId: null, optionValues: { diff: 'hard' } });
    expect(goldOf(settledOpeningStats(world, hard)).value).toBe(10);
  });
});

describe('Option rows on bounds and regen', () => {
  it('sum with a trait’s regen row on the same stat', () => {
    const thrifty: Trait = { id: 'thrifty', name: 'Thrifty', statChanges: [{ statId: 'gold', type: 'regen', value: 4 }] };
    const state = stateOf([playerStat(gold)], [thrifty]);
    const [derived] = deriveEffectiveStats(state.stats, statTraitsInForce(state, worldOf([difficulty()], { diff: 'easy' }, [thrifty])));
    expect(derived.regen).toBe(1 + 2 + 4);
  });

  it('still apply while the Option is hidden from the player', () => {
    const state = stateOf([playerStat(gold)]);
    const [derived] = deriveEffectiveStats(state.stats, statTraitsInForce(state, worldOf([difficulty({ shownToPlayer: false })], { diff: 'easy' })));
    expect(derived).toMatchObject({ max: 200, regen: 3 });
  });

  it('follow a boolean Option’s On and Off lists', () => {
    const hardcore: BooleanWorldOption = {
      id: 'hc', name: 'Hardcore', type: 'boolean', shownToPlayer: true, midGame: true, default: false,
      onStatChanges: [{ statId: 'gold', type: 'regen', value: -1 }], offStatChanges: [{ statId: 'gold', type: 'max', value: 20 }],
    };
    const state = stateOf([playerStat(gold)]);
    const regenUnder = (on: boolean) => deriveEffectiveStats(state.stats, statTraitsInForce(state, worldOf([hardcore], { hc: on })))[0];
    expect(regenUnder(false)).toMatchObject({ max: 120, regen: 1 });
    expect(regenUnder(true)).toMatchObject({ max: 100, regen: 0 });
  });

  it('leave the global stat alone for a row that names an owner', () => {
    const owned = difficulty({ values: [{ id: 'easy', name: 'Easy', statChanges: [{ statId: 'gold', type: 'max', value: 5, ownerId: 'wolf' }] }] });
    const state = stateOf([playerStat(gold)]);
    expect(deriveEffectiveStats(state.stats, statTraitsInForce(state, worldOf([owned])))[0].max).toBe(100);
  });

  it('ignore a row whose stat no longer exists', () => {
    const lost = difficulty({ values: [{ id: 'easy', name: 'Easy', statChanges: [{ statId: 'gone', type: 'max', value: 5 }] }] });
    const state = stateOf([playerStat(gold)]);
    expect(() => deriveEffectiveStats(state.stats, statTraitsInForce(state, worldOf([lost])))).not.toThrow();
    expect(deriveEffectiveStats(state.stats, statTraitsInForce(state, worldOf([lost])))[0]).toBe(state.stats[0]);
  });
});

describe('a mid-game Option change', () => {
  const easyGold = (value: number) => playerStat(gold, { value, max: 200, regen: 3 });

  it('moves max and regen at once and leaves the value alone', () => {
    const settled = settleTraits(stateOf([easyGold(40)]), worldOf([difficulty()], { diff: 'hard' }));
    expect(goldOf(settled.state.stats)).toMatchObject({ value: 40, max: 50, regen: 0 });
  });

  it('clamps a value above the new max', () => {
    const settled = settleTraits(stateOf([easyGold(150)]), worldOf([difficulty()], { diff: 'hard' }));
    expect(goldOf(settled.state.stats)).toMatchObject({ value: 50, max: 50 });
  });

  it('leaves a stat at its cap there when the cap rises', () => {
    const hardGold = playerStat(gold, { value: 50, max: 50, regen: 0 });
    const settled = settleTraits(stateOf([hardGold]), worldOf([difficulty()], { diff: 'easy' }));
    expect(goldOf(settled.state.stats)).toMatchObject({ value: 50, max: 200, regen: 3 });
  });

  it('gives a loaded save the bounds of a world whose author removed every row', () => {
    const bare = difficulty({ values: [{ id: 'easy', name: 'Easy' }, { id: 'hard', name: 'Hard' }] });
    const settled = settleTraits(stateOf([easyGold(150)]), worldOf([bare], { diff: 'easy' }));
    expect(goldOf(settled.state.stats)).toMatchObject({ value: 100, max: 100, regen: 1 });
  });

  it('never applies a starting row again', () => {
    const settled = settleTraits(stateOf([playerStat(gold, { value: 10, max: 50, regen: 0 })]), worldOf([difficulty()], { diff: 'easy' }));
    expect(goldOf(settled.state.stats).value).toBe(10);
  });
});

describe('Option stat toggles', () => {
  it('turn a stat on', () => {
    const state = stateOf([playerStat(hunger)]);
    expect(activeStatEnabled([hunger], statTraitsInForce(state, worldOf([difficulty()], { diff: 'hard' })))).toEqual({ hunger: true });
    expect(activeStatEnabled([hunger], statTraitsInForce(state, worldOf([difficulty()], { diff: 'easy' })))).toEqual({ hunger: false });
  });

  it('lose to a trait’s toggle on the same stat', () => {
    const sated: Trait = { id: 'sated', name: 'Sated', statChanges: [], statToggles: [{ statId: 'hunger', enabled: false }] };
    const state = stateOf([playerStat(hunger)], [sated]);
    expect(activeStatEnabled([hunger], statTraitsInForce(state, worldOf([difficulty()], { diff: 'hard' }, [sated])))).toEqual({ hunger: false });
  });
});
