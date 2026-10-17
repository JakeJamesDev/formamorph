/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/drone.json?raw';
import { gateOf, gateStates, settleDefaults, underfills, type SettleResult } from './traitGates';
import { runStatCodeTurn } from './statCodeTurn';
import type { PlayerStat } from '@/types';
import { bundledWorldHarness } from '@/test/bundledWorldHarness';

const { persona: drone, gate, idOf, activeNames: activeOf, build, personaStats, turn, personaStatsOut } = bundledWorldHarness(raw);

describe('the drone build', () => {
  it('starts as an Assault Frame with no modules', () => {
    expect(activeOf(settleDefaults(gate))).toEqual(['Assault Frame']);
  });

  it('always holds exactly one chassis', () => {
    const start = settleDefaults(gate);
    expect(activeOf(build('Scout Frame'))).toEqual(['Scout Frame']);
    expect(underfills({ ...gate, active: start.active }, drone.id, idOf('Assault Frame'))).toBe(true);
  });

  const MODULES: Record<string, string[]> = {
    'Assault Frame': ['Rapid-Fire Actuators', 'Overcharged Rounds', 'Ram Plate'],
    'Scout Frame': ['Recon Optics', 'Evasion Thrusters', 'Solar Skin'],
    'Siege Frame': ['Bulwark Plating', 'Siege Cannon', 'Repair Nanites'],
  };

  it.each(Object.keys(MODULES))('unlocks only its own modules on the %s', (frame) => {
    const states = gateStates({ ...gate, active: build(frame).active });
    for (const [owner, modules] of Object.entries(MODULES)) {
      for (const name of modules) expect(gateOf(states, drone.id, idOf(name))?.unlocked, name).toBe(owner === frame);
    }
  });

  it('refuses a module of another chassis', () => {
    expect(() => build('Recon Optics')).toThrow('would not switch on');
  });

  it('drops the old modules when the chassis changes', () => {
    expect(activeOf(build('Overcharged Rounds', 'Siege Frame'))).toEqual(['Siege Frame']);
  });

  it('installs at most two modules', () => {
    expect(activeOf(build('Rapid-Fire Actuators', 'Ram Plate'))).toEqual(['Assault Frame', 'Ram Plate', 'Rapid-Fire Actuators']);
    expect(() => build('Rapid-Fire Actuators', 'Ram Plate', 'Overcharged Rounds')).toThrow('would not switch on');
  });
});

/** The drone's stats after its build's stat changes, with each named stat set to a share of its max. */
const droneStats = (state: SettleResult, shares: Record<string, number>): PlayerStat[] =>
  personaStats(state).map((s) => (s.name in shares ? { ...s, value: Math.round(s.max * shares[s.name]) } : s));

/** Mobility and Firepower after one After the AI run of the drone's scripts. */
async function readouts(state: SettleResult, shares: Record<string, number>) {
  const after = personaStatsOut(await runStatCodeTurn(turn(state, { stats: droneStats(state, shares) })));
  const value = (name: string) => after.find((s) => s.name === name)?.value;
  return { mobility: value('Mobility'), firepower: value('Firepower') };
}

const FULL = { Power: 1, Health: 1, Charge: 0 };

describe('the drone readout scripts', () => {
  it('read a full-Power Assault Frame as quick and hard-hitting', async () => {
    expect(await readouts(settleDefaults(gate), FULL)).toEqual({ mobility: 85, firepower: 85 });
  });

  it('scale both readouts with the share of Power left', async () => {
    expect(await readouts(settleDefaults(gate), { ...FULL, Power: 0.5 })).toEqual({ mobility: 50, firepower: 50 });
  });

  it('move Mobility with the chassis and the thrusters', async () => {
    expect((await readouts(build('Scout Frame'), FULL)).mobility).toBe(95);
    expect((await readouts(build('Scout Frame', 'Evasion Thrusters'), { ...FULL, Power: 0.5 })).mobility).toBe(75);
    expect((await readouts(build('Siege Frame'), FULL)).mobility).toBe(70);
  });

  it('add each weapon module to Firepower', async () => {
    expect((await readouts(build('Overcharged Rounds'), { ...FULL, Power: 0.5 })).firepower).toBe(60);
    expect((await readouts(build('Scout Frame', 'Recon Optics'), { ...FULL, Power: 0.5 })).firepower).toBe(50);
    expect((await readouts(build('Siege Frame', 'Siege Cannon'), { ...FULL, Power: 0.5 })).firepower).toBe(60);
  });

  it('cripple both when Health falls below 30% of its max', async () => {
    expect(await readouts(settleDefaults(gate), { ...FULL, Health: 0.2 })).toEqual({ mobility: 35, firepower: 43 });
  });

  it('read the 30% line against the chassis max, not a fixed number', async () => {
    // Scout Health tops out at 80, so 25 is still above the line.
    expect((await readouts(build('Scout Frame'), { ...FULL, Health: 25 / 80 })).mobility).toBe(95);
  });

  it('prime Overdrive in Firepower at full Charge', async () => {
    expect((await readouts(settleDefaults(gate), { ...FULL, Power: 0.5, Charge: 1 })).firepower).toBe(80);
  });
});
