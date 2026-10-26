/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/rampage.json?raw';
import { settleDefaults, type SettleResult } from './traitGates';
import { seedNewGameStats } from './traitRuntime';
import { activeStatEnabled } from './traitEffects';
import { activeDescriptor } from './statContext';
import { runStatCodeTurn, runSwitchScripts, type StatCodeTurn, type StatCodeTurnResult } from './statCodeTurn';
import { primeRolls, resolvePlaceholders, type PlaceholderPick } from './placeholders';
import { ownerPins } from './ownedTraitsInPlay';
import { bundledWorldHarness, valueOf, withValues, type StatValues } from '@/test/bundledWorldHarness';
import type { CodePins } from '@/types';

const {
  world, persona: creature, gate, ownerWorld, none, idOf, activeIds, activeTraits, build, personaStats, turn: harnessTurn, personaStatsOut,
} = bundledWorldHarness(raw);

/** Where the AI left the creature's and the world's stats, and the values the turn started from. */
interface TurnValues { creature?: StatValues; global?: StatValues; previous?: StatValues }

/** One turn over the creature's build. A stat absent from `previous` started where it stands. */
function turn(state: SettleResult, { creature: own = {}, global = {}, previous = {} }: TurnValues): StatCodeTurn {
  const stats = withValues(personaStats(state), own);
  const globals = withValues(seedNewGameStats(world.stats), global);
  return harnessTurn(state, {
    stats, previous: withValues(stats, previous), globals, globalPrevious: withValues(globals, previous),
    enabled: activeStatEnabled(stats, activeTraits(state)),
  });
}

/** One After the AI run. */
async function after(state: SettleResult, values: TurnValues) {
  const out = await runStatCodeTurn(turn(state, values));
  return { global: out.stats, creature: personaStatsOut(out) };
}

describe('Alert Level', () => {
  const alert = world.stats.find((s) => s.name === 'Alert Level')!;
  const alertAfter = async (destruction: number, rampage: number, previous = 0) =>
    valueOf((await after(settleDefaults(gate), { creature: { Rampage: rampage }, global: { Destruction: destruction }, previous: { 'Alert Level': previous } })).global, 'Alert Level');

  it('weighs the damage done over the fury shown', async () => {
    expect(await alertAfter(50, 0)).toBe(35);
    expect(await alertAfter(0, 50)).toBe(15);
  });

  it('never stands down when the creature calms', async () => {
    expect(await alertAfter(10, 10, 60)).toBe(60);
  });

  it('starts at the police cordons and reaches the last resort only once the city is mostly down', async () => {
    const tier = (value: number | undefined) => activeDescriptor(alert, value ?? -1)?.id;
    expect(tier(await alertAfter(0, 10))).toBe('alert_cordons');
    expect(tier(await alertAfter(60, 100))).toBe('alert_full');
    expect(tier(await alertAfter(80, 70))).toBe('alert_lastresort');
  });
});

describe('Berserk State', () => {
  const berserkOn = (state: SettleResult) => activeStatEnabled(creature.stats!, activeTraits(state)).berserk;

  it('starts off, and the player switches it in play', () => {
    expect(activeIds(settleDefaults(gate))).not.toContain(idOf('Berserk State'));
    expect(creature.traits!.find((t) => t.name === 'Berserk State')?.playerToggle).toBe(true);
  });

  it('switches the Berserk stat on only while it is active', () => {
    expect(berserkOn(settleDefaults(gate))).toBe(false);
    expect(berserkOn(build('Berserk State'))).toBe(true);
  });

  it('clears Berserk when a frenzy starts', async () => {
    const state = build('Berserk State');
    const out = await runSwitchScripts(
      turn(state, { creature: { Berserk: 75 } }),
      [{ traitId: idOf('Berserk State'), ownerId: creature.id, enabled: true }],
    );
    expect(valueOf(out?.owners?.[creature.id]?.stats, 'Berserk')).toBe(0);
  });
});

describe('the Berserk script', () => {
  const frenzy = build('Berserk State');

  it('sinks a quarter deeper each turn, feeding Rampage and opening wounds', async () => {
    const out = await after(frenzy, { creature: { Berserk: 0, Rampage: 10, Health: 100 } });
    expect(valueOf(out.creature, 'Berserk')).toBe(25);
    expect(valueOf(out.creature, 'Rampage')).toBe(18);
    expect(valueOf(out.creature, 'Health')).toBe(94);
  });

  it('costs the most at the bottom of the frenzy', async () => {
    const out = await after(frenzy, { creature: { Berserk: 75, Rampage: 10, Health: 100 } });
    expect(valueOf(out.creature, 'Berserk')).toBe(100);
    expect(valueOf(out.creature, 'Rampage')).toBe(25);
    expect(valueOf(out.creature, 'Health')).toBe(90);
  });

  it('takes Health as a share of its max, so Armored Hide pays more', async () => {
    const out = await after(build('Berserk State', 'Armored Hide'), { creature: { Berserk: 0, Rampage: 10, Health: 120 } });
    expect(valueOf(out.creature, 'Health')).toBe(113);
  });

  it('holds Rampage and Health inside their range', async () => {
    const out = await after(frenzy, { creature: { Berserk: 75, Rampage: 95, Health: 5 } });
    expect(valueOf(out.creature, 'Rampage')).toBe(100);
    expect(valueOf(out.creature, 'Health')).toBe(0);
  });

  it('does nothing while Berserk State is off', async () => {
    const out = await after(settleDefaults(gate), { creature: { Berserk: 0, Rampage: 10, Health: 100 } });
    expect(valueOf(out.creature, 'Rampage')).toBe(10);
    expect(valueOf(out.creature, 'Health')).toBe(100);
  });
});

const placeholderNamed = (name: string) => world.placeholders!.find((p) => p.name === name)!;
const locationNamed = (name: string) => world.locations.find((l) => l.name === name)!;

/** Each chip resolves to its placeholder's first value: the Subway Line reads "Red Line". */
const firstValue: PlaceholderPick = (values) => values[0].text;

/** Where the play turn stands, and what code pinned on earlier turns. */
interface PlayInput extends TurnValues { at: string; codePins?: CodePins }

/** The world-level pins in force over `codePins`, through the play pin walk. */
const pinsInForce = (codePins: CodePins) => ownerPins(
  { world: ownerWorld, persona: none, globalTraits: [], owned: {}, sharedPlaceholders: world.placeholders! },
  { placeholders: world.placeholders!, rolls: {}, codePins },
).world;

/** One turn at the named location, with the world's places and placeholders in play. */
function playTurn({ at, codePins = {}, ...values }: PlayInput): StatCodeTurn {
  const base = turn(settleDefaults(gate), values);
  const here = locationNamed(at);
  return {
    ...base,
    state: {
      ...base.state,
      places: { locations: world.locations, location: { id: here.id, name: here.name }, connections: world.connections },
      placeholders: {
        placeholders: world.placeholders!, rolls: {}, codePins, pins: pinsInForce(codePins), pick: firstValue,
        pinsAfter: (after) => pinsInForce(after.codePins),
      },
      resolveText: (text) => resolvePlaceholders(text, { placeholders: world.placeholders!, rolls: {}, pick: firstValue }),
    },
  };
}

const pinOf = (out: StatCodeTurnResult, name: string) => out.pinWrites[placeholderNamed(name).id];

describe('the Pursuit script', () => {
  const sighting = (place: string): CodePins => ({ [placeholderNamed('Last Sighting').id]: place });
  const before = (input: PlayInput) => runStatCodeTurn({ ...playTurn(input), timing: 'before' });

  it('climbs 3 for each road into a place the creature holds, so a hub fills fast', async () => {
    // Harbor District: four sibling districts and the Ferry Terminal. The city itself is not a road in.
    const out = await before({ at: 'Harbor District', codePins: sighting('Harbor District'), global: { Pursuit: 10 } });
    expect(valueOf(out.stats, 'Pursuit')).toBe(25);
  });

  it('fills a dead end slowly', async () => {
    const out = await before({ at: 'Ferry Terminal', codePins: sighting('Ferry Terminal'), global: { Pursuit: 10 } });
    expect(valueOf(out.stats, 'Pursuit')).toBe(13);
  });

  it('follows the map to the suburb past the base: two roads, by the back gate and the highway', async () => {
    const out = await before({ at: 'Cedar Hollow', codePins: sighting('Cedar Hollow'), global: { Pursuit: 10 } });
    expect(valueOf(out.stats, 'Pursuit')).toBe(16);
    expect(pinOf(out, 'Pursuit Roads')).toBe("out along the evacuation highway from Old Town and out the base's back gate from Fort Bastion");
  });

  it('halves when the creature moves on, and fixes the new place', async () => {
    const out = await before({ at: 'Downtown Core', codePins: sighting('Harbor District'), global: { Pursuit: 40 } });
    expect(valueOf(out.stats, 'Pursuit')).toBe(20);
    expect(pinOf(out, 'Last Sighting')).toBe('Downtown Core');
  });

  it('counts the landing from the bay as a move', async () => {
    const out = await before({ at: 'Harbor District', global: { Pursuit: 0 } });
    expect(valueOf(out.stats, 'Pursuit')).toBe(0);
    expect(pinOf(out, 'Last Sighting')).toBe('Harbor District');
  });

  it('names the roads in by the hint on the leg that points back, and a road with no hint by its place', async () => {
    // Neonspire, the city as a whole, is not a road in.
    expect(pinOf(await before({ at: 'Harbor District', global: { Pursuit: 0 } }), 'Pursuit Roads')).toBe(
      'from Ferry Terminal, from Old Town, from Fort Bastion, down the waterfront boulevard from Downtown Core'
      + ' and along the dockside rail line from Industrial Yards',
    );
  });

  it('names the rolled subway line on the tunnel road', async () => {
    const roads = pinOf(await before({ at: 'Metro Underground', global: { Pursuit: 0 } }), 'Pursuit Roads') as string;
    expect(roads).toContain('down into the Red Line tunnels from Old Town');
  });

  it('keeps the AI from moving Pursuit, so the map alone paces it', () => {
    expect(world.stats.find((s) => s.name === 'Pursuit')).toMatchObject({ noIncrease: true, noDecrease: true, hidden: true });
  });
});

describe('the Subway Line chip', () => {
  it('rolls one line for both legs of the tunnels, the Metro and its lore entry', () => {
    const line = placeholderNamed('Subway Line');
    const tunnels = world.connections!.find((c) => (c.aToB?.hint ?? '').includes(line.id))!;
    const lore = world.dictionaries![0].entries.find((e) => e.name === 'Metro Underground')!;
    const texts = [tunnels.aToB!.hint!, tunnels.bToA!.hint!, locationNamed('Metro Underground').aiDescription!, lore.value];
    // Each fresh roll draws the next value, so two separate rolls would read differently.
    let draws = 0;
    const nextValue: PlaceholderPick = (values) => values[draws++ % values.length].text;
    const rolls = primeRolls(world.placeholders!, texts, {}, nextValue);
    const resolved = texts.map((text) => resolvePlaceholders(text, { placeholders: world.placeholders!, rolls }));
    const rolledLine = line.values.map((value) => value.text).find((name) => resolved[0].includes(name))!;
    expect(rolledLine).toBeDefined();
    for (const text of resolved) expect(text).toContain(rolledLine);
  });
});
