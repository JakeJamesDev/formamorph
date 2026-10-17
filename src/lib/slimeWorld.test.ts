/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/slime.json?raw';
import { resolveOwners } from './owners';
import { settleDefaults, type SettleResult } from './traitGates';
import { runStatCodeTurn } from './statCodeTurn';
import { resolvePlaceholders } from './placeholders';
import { openingPool } from './openings';
import { bundledWorldHarness, withValues } from '@/test/bundledWorldHarness';

const { world, persona: resident, gate, ownerWorld, none: NONE, traitNamed, activeNames, build, personaStats, turn, personaStatsOut } = bundledWorldHarness(raw);
const allPlaceholders = [...world.placeholders!, ...world.entities.flatMap((e) => e.placeholders ?? []), ...world.dictionaries!.flatMap((d) => d.placeholders ?? [])];

interface Turn {
  /** Assimilation at the start of the turn. */
  from: number;
  /** The AI's change this turn: slime contact, or a remedy. */
  aiChange?: number;
  hours: number;
  panic?: number;
}

/** Assimilation after one After the AI run of the Resident's scripts. */
async function spread(state: SettleResult, { from, aiChange = 0, hours, panic = 0 }: Turn): Promise<number | undefined> {
  const previous = withValues(personaStats(state), { Assimilation: from, Panic: panic });
  const stats = withValues(previous, { Assimilation: from + aiChange });
  const out = await runStatCodeTurn(turn(state, { stats, previous, clock: { deltaHours: hours } }));
  return personaStatsOut(out).find((s) => s.name === 'Assimilation')?.value;
}

// The default picks: Night-Shift Nurse, Steady Hands, and the Hidden strain.
const DEFAULT = settleDefaults(gate);
const DOCK_WORKER = build('Dock Worker');

describe('the infection spread script', () => {
  it('spreads two points for each story hour', async () => {
    expect(await spread(DOCK_WORKER, { from: 10, hours: 1 })).toBe(12);
    expect(await spread(DOCK_WORKER, { from: 10, hours: 3 })).toBe(16);
  });

  it('spreads nothing on a turn that takes no time', async () => {
    expect(await spread(DOCK_WORKER, { from: 10, hours: 0 })).toBe(10);
  });

  it("keeps the AI's change for the turn and spreads on top of it", async () => {
    expect(await spread(DOCK_WORKER, { from: 10, aiChange: 15, hours: 1 })).toBe(27);
    expect(await spread(DOCK_WORKER, { from: 30, aiChange: -10, hours: 1 })).toBe(22);
  });

  it('spreads faster once the skin is translucent at the start of the turn', async () => {
    expect(await spread(DOCK_WORKER, { from: 40, hours: 1 })).toBe(43);
    // A splash that crosses 40 this turn does not also speed up this turn.
    expect(await spread(DOCK_WORKER, { from: 30, aiChange: 15, hours: 1 })).toBe(47);
  });

  it('spreads faster at half of max Panic or more', async () => {
    expect(await spread(DOCK_WORKER, { from: 10, hours: 1, panic: 50 })).toBe(13);
    expect(await spread(DOCK_WORKER, { from: 10, hours: 1, panic: 49 })).toBe(12);
  });

  it('reads Panic against its max, which Morbid Curiosity raises', async () => {
    // Morbid Curiosity takes Panic's max to 125, so 60 is under half.
    expect(await spread(build('Dock Worker', 'Morbid Curiosity'), { from: 10, hours: 1, panic: 60 })).toBe(12);
    expect(await spread(build('Dock Worker', 'Morbid Curiosity'), { from: 10, hours: 1, panic: 63 })).toBe(13);
  });

  it("slows a point an hour for the Night-Shift Nurse", async () => {
    expect(activeNames(DEFAULT)).toContain('Night-Shift Nurse');
    expect(await spread(DEFAULT, { from: 10, hours: 2 })).toBe(12);
  });

  it('slows two points an hour while Fight It is on', async () => {
    expect(await spread(build('Dock Worker', 'Fight It'), { from: 40, hours: 1 })).toBe(41);
  });

  it('stops the spread, never reverses it, for a nurse who fights it', async () => {
    expect(await spread(build('Fight It'), { from: 20, hours: 4 })).toBe(20);
  });
});

describe('the hidden strain', () => {
  const strain = traitNamed('Strain');

  it('is a Hidden trait the Resident always carries', () => {
    expect(strain.mode).toBe('hidden');
    expect(activeNames(DEFAULT)).toContain('Strain');
    expect(activeNames(build('Dock Worker', 'Runner\'s Instinct', 'Fight It'))).toContain('Strain');
  });

  it('rolls one strain from its placeholder into the text the AI reads', () => {
    const values = resident.placeholders!.find((p) => p.name === 'Strain')!.values;
    expect(values.length).toBeGreaterThan(1);
    for (const value of values) {
      const text = resolvePlaceholders(strain.aiDescription ?? '', { placeholders: allPlaceholders, rolls: {}, pick: () => value.text });
      expect(text).toContain(value.text);
      expect(text).not.toContain('{{');
    }
  });
});

describe('the rolled neighbor', () => {
  const neighbor = world.entities.find((e) => e.aliases?.includes('neighbor'))!;
  const variants = allPlaceholders.find((p) => p.name === 'Neighbor')!.values;

  it.each(variants.map((_, i) => i))('names neighbor %i and their habit through the renamed slots', (index) => {
    // Pick this variant from the Neighbor list, and the first value of any other list.
    const pick = (values: { id: string; text: string }[]) => (values[0].id === variants[0].id ? values[index] : values[0]).text;
    const resolve = (text: string) => resolvePlaceholders(text, { placeholders: allPlaceholders, rolls: {}, pick });
    const name = resolve(neighbor.name);
    expect(name).toMatch(/^(Mr\.|Mrs\.|Ms\.|Old) [A-Z]\w+$/);
    // Each variant owns one Habit; its slot chips must land that text.
    const variantId = variants[index].text.match(/\{\{ph:([^:]+):/)![1];
    const habit = allPlaceholders.find((p) => p.name === 'Habit' && p.ownerId === variantId)!.values[0].text;
    for (const text of [neighbor.aiDescription ?? '', neighbor.playerDescription ?? '']) {
      const resolved = resolve(text);
      expect(resolved).not.toContain('{{');
      expect(resolved).toContain(habit);
    }
    expect(resolve(neighbor.aiDescription ?? '')).toContain(name);
  });
});

describe('openings on Slime Outbreak', () => {
  it('draws from several world openings at the start', () => {
    const pool = openingPool({
      overview: world.worldOverview,
      entities: resolveOwners(ownerWorld, NONE).cast,
      locations: world.locations,
      startingLocationId: world.locations.find((l) => l.isStarting)!.id,
      persona: null,
      customPersona: resident,
    });
    expect(pool.length).toBeGreaterThan(1);
    expect(pool.every((e) => e.ownerId === null)).toBe(true);
  });
});
