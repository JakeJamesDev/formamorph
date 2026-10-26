/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/drone.json?raw';
import { gateOf, gateStates, settleDefaults, underfills, type SettleResult } from './traitGates';
import { runStatCodeTurn } from './statCodeTurn';
import type { PlayerStat, World } from '@/types';
import { entityIdsAt } from './entityPresence';
import { primeRolls, resolvePlaceholders, type PlaceholderPick } from './placeholders';
import { bundledWorldHarness } from '@/test/bundledWorldHarness';
import { readWorldTools } from './tools/worldTools';
import { openWorldToolTurn } from './tools/worldToolTurn';
import { visibleImages, visibleLocationImages } from './imageVisibility';
import { scoped } from './scope';
import type { GateInput, GateStatSet } from './traitGates';

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

describe('the lock_target World Tool', () => {
  const { tools, dropped } = readWorldTools((JSON.parse(raw) as { tools?: unknown }).tools);
  const lockTarget = tools.find((tool) => tool.name === 'lock_target')!;
  const failIfCalled = () => { throw new Error('lock_target never runs at the call.'); };

  /** One turn's armed output triggers after the AI calls lock_target once for each name. */
  async function lockOn(...names: string[]) {
    const turnTools = openWorldToolTurn(tools, failIfCalled);
    const execute = turnTools.executor(failIfCalled);
    const replies = [];
    for (const name of names) replies.push((await execute(lockTarget, JSON.stringify({ name }), new AbortController().signal)).text);
    return { replies, triggers: turnTools.armed('output') };
  }

  /** `sentence` after the drone's output run with `triggers` armed. */
  const filtered = async (sentence: string, triggers: Awaited<ReturnType<typeof lockOn>>['triggers']) =>
    (await runStatCodeTurn({ ...turn(settleDefaults(gate), { stats: personaStats(settleDefaults(gate)) }), timing: 'output', triggers,
      narration: { sentence, full: sentence, index: 0, sent: [], buffered: [] } })).sentence;

  it('loads from the world as a During AI Output filter offered to narration', () => {
    expect(dropped).toEqual([]);
    expect(lockTarget.handler).toMatchObject({ kind: 'script', timing: 'output' });
    expect(lockTarget.offeredTo).toEqual(['narration']);
  });

  it('answers its Reply and arms the filter', async () => {
    const { replies, triggers } = await lockOn('Rustjaw');
    expect(replies).toEqual(['Target locked. Write the narration.']);
    expect(triggers).toHaveLength(1);
  });

  it('marks every mention of the target in any letter case, once each', async () => {
    const { triggers } = await lockOn('Ser Halden');
    expect(await filtered('Ser Halden raises his shield, and **ser halden** charges.', triggers))
      .toBe('**⌖ Ser Halden** raises his shield, and **⌖ ser halden** charges.');
  });

  it('marks the last word of a described target, as the narration shortens it', async () => {
    const { triggers } = await lockOn('the growling beast');
    expect(await filtered('The growling beast leaps, and the **beast** howls.', triggers))
      .toBe('The **⌖ growling beast** leaps, and the **⌖ beast** howls.');
  });

  it('leaves a sentence without the target as written', async () => {
    const { triggers } = await lockOn('Rustjaw');
    expect(await filtered('The dunes shift under your wheels.', triggers)).toBe('The dunes shift under your wheels.');
  });

  it('moves the lock to the later target, because Stack Calls is off', async () => {
    const { triggers } = await lockOn('Rustjaw', 'Tiamat');
    expect(await filtered('Rustjaw ducks as Tiamat roars.', triggers)).toBe('Rustjaw ducks as **⌖ Tiamat** roars.');
  });

  it('marks a pack target in the singular and the plural', async () => {
    const drakes = await lockOn('Blight Drakes');
    expect(await filtered('A blight drake dives, and both drakes shriek.', drakes.triggers))
      .toBe('A **⌖ blight drake** dives, and both **⌖ drakes** shriek.');
    const burrower = await lockOn('Glassback Burrower');
    expect(await filtered('Two burrowers burst from the sand.', burrower.triggers)).toBe('Two **⌖ burrowers** burst from the sand.');
    const foxes = await lockOn('the marsh foxes');
    expect(await filtered('One fox bolts.', foxes.triggers)).toBe('One **⌖ fox** bolts.');
  });
});

describe('the drone\'s Visibility rules', () => {
  const world = JSON.parse(raw) as World;
  const hill = world.locations.find((location) => location.name === 'Mossback Hill')!;
  // The drone's Charge, as play reads it, at the given percent of its span.
  const chargeAt = (charge: number): GateInput => ({
    ...gate,
    active: settleDefaults(gate).active,
    stats: scoped<GateStatSet>({}, { [drone.id]: { charge: { name: 'Charge', value: charge, min: 0, max: 100 } } }),
  });

  it('swaps the drone to its powered-up image once Overdrive is ready', () => {
    const slots = (charge: number) => visibleImages(drone, chargeAt(charge)).map((image) => image.slot);
    expect(slots(99)).toEqual([0]);
    expect(slots(100)).toEqual([1]);
  });

  it('swaps Mossback Hill to the awake Sentinel once the played persona\'s Overdrive is ready', () => {
    const slots = (charge: number) => visibleLocationImages(hill, chargeAt(charge)).map((image) => image.slot);
    expect(slots(99)).toEqual([0]);
    expect(slots(100)).toEqual([1]);
  });
});

describe('the drone map', () => {
  const world = JSON.parse(raw) as World;
  const locationNamed = (name: string) => world.locations.find((location) => location.name === name)!;
  const castAt = (name: string) =>
    entityIdsAt(locationNamed(name).id, world.entities).map((id) => world.entities.find((entity) => entity.id === id)!.name);

  it.each([
    ['Ashfall Capital', 'Archon Vael'],
    ['Scavenger Wastes', 'Rustjaw'],
    ['Demon Frontier', 'Ser Halden'],
  ])('puts the %s opening character, %s, at that start', (start, character) => {
    expect(castAt(start)).toContain(character);
  });

  it('rolls one frontier pass for both directions of the route and the fort', () => {
    const pass = world.placeholders!.find((placeholder) => placeholder.name === 'Frontier Pass')!;
    const route = world.connections!.find((connection) => (connection.aToB?.hint ?? '').includes(pass.id))!;
    const fort = locationNamed('Fort Graywatch');
    const texts = [route.aToB!.hint!, route.bToA!.hint!, fort.aiDescription!];
    // Each fresh roll draws the next value, so two separate rolls would read differently.
    let draws = 0;
    const nextValue: PlaceholderPick = (values) => values[draws++ % values.length].text;
    const rolls = primeRolls(world.placeholders!, texts, {}, nextValue);
    const resolved = texts.map((text) => resolvePlaceholders(text, { placeholders: world.placeholders!, rolls }));
    const rolledName = pass.values.map((value) => value.text).find((name) => resolved[0].includes(name))!;
    expect(rolledName).toBeDefined();
    for (const text of resolved) expect(text).toContain(rolledName);
  });
});
