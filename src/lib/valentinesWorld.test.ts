/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/valentines.json?raw';
import { runStatCodeTurn } from './statCodeTurn';
import type { SettleResult } from './traitGates';
import type { PlayerStat } from '@/types';
import { bundledWorldHarness, withValues, type StatValues } from '@/test/bundledWorldHarness';

const { build, personaStats, turn, personaStatsOut } = bundledWorldHarness(raw);

/** The student's stats after its build's stat changes, with each named stat set to a raw value. */
const studentStats = (state: SettleResult, values: StatValues) => withValues(personaStats(state), values);

const statOf = (stats: readonly PlayerStat[], name: string) => stats.find((s) => s.name === name)!;

/** Agility after one After the AI run of its script. */
async function agilityAfter(state: SettleResult, values: StatValues) {
  const out = await runStatCodeTurn(turn(state, { stats: studentStats(state, values) }));
  return statOf(personaStatsOut(out), 'Agility').value;
}

// Iron Stomach is the default Constitution, so Sugar tops out at 100. The other builds change one max each.
const PLAIN = () => build('Class Idol');

describe('the Agility script', () => {
  it('reads full Stamina and an empty stomach as full speed', async () => {
    expect(await agilityAfter(PLAIN(), { Stamina: 100, Sugar: 0 })).toBe(100);
  });

  it('starts an exhausted student at a base of 30', async () => {
    expect(await agilityAfter(PLAIN(), { Stamina: 0, Sugar: 0 })).toBe(30);
  });

  it('slows the student as Sugar climbs', async () => {
    expect(await agilityAfter(PLAIN(), { Stamina: 50, Sugar: 50 })).toBe(45);
  });

  it("reads Stamina as a share of the Star Athlete's bigger tank", async () => {
    // Star Athlete's Stamina tops out at 120, so 60 is half: the same speed as 50 for everyone else.
    expect(statOf(studentStats(build('Star Athlete'), {}), 'Stamina').max).toBe(120);
    expect(await agilityAfter(build('Star Athlete'), { Stamina: 60, Sugar: 0 })).toBe(65);
  });

  it('reads Sugar as a share of the stomach each Constitution gives', async () => {
    // Sweet Tooth holds 125, so 100 is 80% full; Dainty Appetite holds 80, so 80 is completely full.
    expect(await agilityAfter(build('Class Idol', 'Sweet Tooth'), { Stamina: 100, Sugar: 100 })).toBe(68);
    expect(await agilityAfter(build('Class Idol', 'Dainty Appetite'), { Stamina: 100, Sugar: 80 })).toBe(60);
  });

  it('adds a burst while All-Out Sprint is on', async () => {
    expect(await agilityAfter(build('Class Idol', 'All-Out Sprint'), { Stamina: 50, Sugar: 0 })).toBe(85);
  });

  it('stays inside the stat range', async () => {
    expect(await agilityAfter(build('Class Idol', 'All-Out Sprint'), { Stamina: 100, Sugar: 0 })).toBe(100);
    expect(await agilityAfter(build('Class Idol', 'Dainty Appetite'), { Stamina: 0, Sugar: 80 })).toBe(0);
  });

  it("replaces whatever the AI wrote, since Agility is a readout of the body", async () => {
    expect(await agilityAfter(PLAIN(), { Stamina: 100, Sugar: 0, Agility: 12 })).toBe(100);
  });
});

describe('All-Out Sprint', () => {
  it('drains Stamina each turn, even for the fastest-recovering build', () => {
    const regenOf = (state: SettleResult) => statOf(studentStats(state, {}), 'Stamina').regen;
    expect(regenOf(build('Star Athlete', 'Running Shoes'))).toBeGreaterThan(0);
    expect(regenOf(build('Star Athlete', 'Running Shoes', 'All-Out Sprint'))).toBeLessThan(0);
  });
});
