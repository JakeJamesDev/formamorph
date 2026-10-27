/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/rampage.json?raw';
import { groupPickStates, settleDefaults, underfills, type SettleResult } from './traitGates';
import { seedNewGameStats } from './traitRuntime';
import { activeStatEnabled } from './traitEffects';
import { activeDescriptor } from './statContext';
import { runStatCodeTurn, runSwitchScripts, type StatCodeTurn, type StatCodeTurnResult } from './statCodeTurn';
import { primeRolls, resolvePlaceholders, type PlaceholderPick } from './placeholders';
import { ownerPins } from './ownedTraitsInPlay';
import { bundledWorldHarness, valueOf, withValues, type StatValues } from '@/test/bundledWorldHarness';
import type { CodePins } from '@/types';
import { readWorldTools } from './tools/worldTools';
import { openWorldToolTurn } from './tools/worldToolTurn';
import { onCallRunner } from './tools/onCallRunner';
import type { SandboxMemory } from './statCodeExecutor';

const {
  world, persona: creature, gate, ownerWorld, none, idOf, activeIds, activeTraits, build, personaStats, turn: harnessTurn, personaStatsOut,
  statAt, entitySlots, locationSlots,
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

describe('the log_landmark World Tool', () => {
  const { tools, dropped } = readWorldTools(world.tools);
  const logLandmark = tools.find((tool) => tool.name === 'log_landmark')!;
  const topStories = placeholderNamed('Top Stories');
  const failIfFallback = () => { throw new Error('log_landmark is a World Tool.'); };

  /** A pinned Custom memory from an earlier turn. */
  const pinnedMemory = (text: string): SandboxMemory => ({
    id: text, turn: 1, timestamp: 1, day: 1, daypart: 'morning', text, custom: true, kept: false, inContext: true, pinned: true, forgotten: false,
  });

  /** One On Call run of log_landmark at `at`, over the pins and memories earlier calls and turns left. */
  async function log(landmark: string, { at = 'Downtown Core', codePins = {} as CodePins, memories = [] as SandboxMemory[], destruction = 20 } = {}) {
    let landed: StatCodeTurnResult | undefined;
    const runner = onCallRunner(() => {
      const base = playTurn({ at, codePins, global: { Destruction: destruction } });
      return { turn: { ...base, state: { ...base.state, memories } }, land: (result) => { landed = result; } };
    });
    const execute = openWorldToolTurn(tools, runner).executor(failIfFallback);
    const reply = await execute(logLandmark, JSON.stringify({ landmark }), new AbortController().signal);
    const stories = landed?.pinWrites[topStories.id];
    return {
      reply: reply.text,
      destruction: landed && valueOf(landed.stats, 'Destruction'),
      pins: landed?.worldWrites?.pins ?? [],
      stories,
      // The Tool only pins Top Stories, never unpins it.
      codePins: stories == null ? codePins : { ...codePins, [topStories.id]: stories },
    };
  }

  it('loads as an On Call Tool offered to the stat pass, its landmarks all places on the map', () => {
    expect(dropped).toEqual([]);
    expect(logLandmark.handler).toMatchObject({ kind: 'script', timing: 'call' });
    expect(logLandmark.offeredTo).toEqual(['statUpdates']);
    const landmarks = logLandmark.params[0].options;
    expect(landmarks.length).toBeGreaterThan(0);
    for (const landmark of landmarks) expect(locationNamed(landmark)).toBeDefined();
  });

  it('pins the loss where the creature stood, adds 5 Destruction and leads the news with it', async () => {
    const { pins, destruction, stories, reply } = await log('Spire Tower');
    expect(pins).toEqual(['The creature destroyed Spire Tower in Downtown Core.']);
    expect(destruction).toBe(25);
    // The authored stories are not falls, so the first fall stands alone.
    expect(stories).toEqual(['the fall of Spire Tower']);
    expect(reply).toContain('Destruction is now 25');
  });

  it('logs a landmark once in a turn, by the news pin that lands at once', async () => {
    const first = await log('Harborgate Bridge');
    const second = await log('Harborgate Bridge', { codePins: first.codePins, destruction: first.destruction });
    expect(second.pins).toEqual([]);
    expect(second.destruction).toBe(25);
    expect(second.reply).toContain('already logged');
  });

  it('logs a landmark once across turns, by its pinned memory', async () => {
    // The memory the first call pinned, as the Memory panel holds it on a later turn.
    const first = await log('Bayline Refinery', { at: 'Industrial Yards' });
    const again = await log('Bayline Refinery', { at: 'Industrial Yards', memories: first.pins.map(pinnedMemory) });
    expect(again.pins).toEqual([]);
    expect(again.destruction).toBe(20);
  });

  it('keeps the three latest falls in the news, newest first', async () => {
    let codePins: CodePins = {};
    for (const landmark of ['Ferry Terminal', 'Spire Tower', 'Metro Underground', 'Neonspire Stadium']) {
      ({ codePins } = await log(landmark, { codePins }));
    }
    expect(codePins[topStories.id]).toEqual(['the fall of Neonspire Stadium', 'the fall of Metro Underground', 'the fall of Spire Tower']);
  });

  it("puts the news in Channel 8's description", () => {
    const chopper = world.entities.find((entity) => entity.name === 'Channel 8 News Chopper')!;
    const pins = pinsInForce({ [topStories.id]: ['the fall of Spire Tower'] });
    const text = resolvePlaceholders(chopper.aiDescription!, { placeholders: world.placeholders!, rolls: {}, pins });
    expect(text).toContain('the fall of Spire Tower');
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

describe('the Visibility rules', () => {
  it('swaps Downtown Core to its ruined skyline once Destruction reaches 40', () => {
    const slots = (destruction: number) => locationSlots(locationNamed('Downtown Core'), statAt('Destruction', destruction));
    expect(slots(39)).toEqual([0]);
    expect(slots(40)).toEqual([1]);
  });

  it('swaps Aegis-One from its hangar to the streets once Alert Level reaches 75', () => {
    const aegis = world.entities.find((entity) => entity.name === 'Aegis-One')!;
    const slots = (alert: number) => entitySlots(aegis, statAt('Alert Level', alert));
    expect(slots(74)).toEqual([0]);
    expect(slots(75)).toEqual([1]);
  });

  it.each([
    ['Reptile', 'Masculine', 0], ['Insect', 'Masculine', 1], ['Arachnid', 'Feminine', 2],
    ['Giant', 'Masculine', 3], ['Giant', 'Feminine', 4],
  ])('shows The Creature as the %s it was built as (%s)', (type, presentation, slot) => {
    const state = build(type, presentation);
    expect(entitySlots(creature, { ...gate, active: state.active })).toEqual([slot]);
  });
});

describe('The Creature\'s pick groups', () => {
  const groupNamed = (name: string) => creature.traitGroups!.find((group) => group.name === name)!;

  it.each([['Type', 'Reptile'], ['Presentation', 'Masculine']])('requires one %s pick', (name, defaultPick) => {
    const state = settleDefaults(gate);
    const picks = groupPickStates({ ...gate, active: state.active }).owners[creature.id]!.get(groupNamed(name).id)!;
    expect(picks).toMatchObject({ count: 1, short: false });
    // The default pick cannot be switched off, so no build reaches play with the group empty.
    expect(underfills({ ...gate, active: state.active }, creature.id, idOf(defaultPick))).toBe(true);
  });
});
