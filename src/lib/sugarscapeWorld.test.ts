/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/sugarscape.json?raw';
import { settleDefaults, underfills, type SettleResult } from './traitGates';
import { runStatCodeTurn } from './statCodeTurn';
import { bundledWorldHarness, withValues, type StatValues } from '@/test/bundledWorldHarness';

const { persona: cursed, gate, idOf, activeNames: activeOf, build, personaStats, turn, personaStatsOut } = bundledWorldHarness(raw);

describe('the cursed build', () => {
  it('starts as a Nimble Grazer with no Pantry Tricks', () => {
    expect(activeOf(settleDefaults(gate))).toEqual(['Grazer', 'Nimble']);
  });

  it('always holds exactly one Appetite and one Build', () => {
    const start = settleDefaults(gate);
    expect(activeOf(build('Glutton', 'Sturdy'))).toEqual(['Glutton', 'Sturdy']);
    expect(underfills({ ...gate, active: start.active }, cursed.id, idOf('Grazer'))).toBe(true);
    expect(underfills({ ...gate, active: start.active }, cursed.id, idOf('Nimble'))).toBe(true);
  });

  it('takes at most two Pantry Tricks', () => {
    expect(activeOf(build('Iron Stomach', 'Sugar Rush'))).toEqual(['Grazer', 'Iron Stomach', 'Nimble', 'Sugar Rush']);
    expect(() => build('Iron Stomach', 'Sugar Rush', 'Hearty Appetite')).toThrow('would not switch on');
  });
});

/** The cursed's stats after its build's stat changes, with each named stat set to a raw value. */
const cursedStats = (state: SettleResult, values: StatValues) => withValues(personaStats(state), values);

/** Craving after one After the AI run of the hunger script. */
async function cravingAfter(state: SettleResult, values: StatValues) {
  const out = await runStatCodeTurn(turn(state, { stats: cursedStats(state, values) }));
  return personaStatsOut(out).find((s) => s.name === 'Craving')?.value;
}

/** Craving 30 on a comfortable stomach: neither empty nor full. */
const FED = { Craving: 30, Fullness: 40 };

describe('the hunger tick', () => {
  it('climbs a Grazer two steps a turn on a comfortable stomach', async () => {
    expect(await cravingAfter(settleDefaults(gate), FED)).toBe(32);
  });

  it('sets the step by Appetite', async () => {
    expect(await cravingAfter(build('Glutton'), FED)).toBe(35);
    expect(await cravingAfter(build('Iron Will'), FED)).toBe(31);
  });

  it('tilts the step by Pantry Tricks', async () => {
    expect(await cravingAfter(build('Hearty Appetite'), FED)).toBe(31);
    expect(await cravingAfter(build('Sugar Rush'), FED)).toBe(33);
  });

  it('climbs faster on an empty stomach and slower on a full one', async () => {
    expect(await cravingAfter(settleDefaults(gate), { ...FED, Fullness: 5 })).toBe(34);
    expect(await cravingAfter(settleDefaults(gate), { ...FED, Fullness: 80 })).toBe(31);
  });

  it('reads fullness as a share of the Glutton\'s bigger stomach', async () => {
    // Glutton's Fullness tops out at 125, so 80 is 64%: not yet full.
    expect(await cravingAfter(build('Glutton'), { ...FED, Fullness: 80 })).toBe(35);
  });

  it('turns the step downward while Gritted Teeth holds', async () => {
    expect(await cravingAfter(build('Gritted Teeth'), FED)).toBe(28);
  });

  it('lowers Craving under Gritted Teeth even for a hungry Glutton', async () => {
    expect(await cravingAfter(build('Glutton', 'Sugar Rush', 'Gritted Teeth'), { Craving: 30, Fullness: 0 })).toBe(29);
  });

  it('stays inside the stat range', async () => {
    expect(await cravingAfter(build('Glutton', 'Sugar Rush'), { Craving: 98, Fullness: 0 })).toBe(100);
    expect(await cravingAfter(build('Iron Will', 'Gritted Teeth'), { Craving: 2, Fullness: 80 })).toBe(0);
  });

  it('is the only thing that climbs Craving: no build gives it regen', () => {
    for (const state of [settleDefaults(gate), build('Glutton', 'Sugar Rush', 'Gritted Teeth'), build('Iron Will', 'Hearty Appetite')]) {
      expect(cursedStats(state, {}).find((s) => s.name === 'Craving')?.regen).toBe(0);
    }
  });
});
