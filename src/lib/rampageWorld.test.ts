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
import { runStatCodeTurn, runSwitchScripts, type StatCodeTurn } from './statCodeTurn';
import { bundledWorldHarness, valueOf, withValues, type StatValues } from '@/test/bundledWorldHarness';

const { world, persona: creature, gate, idOf, activeIds, activeTraits, build, personaStats, turn: harnessTurn, personaStatsOut } = bundledWorldHarness(raw);

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
