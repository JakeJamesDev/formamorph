/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/sugarscape.json?raw';
import { settleDefaults, underfills, type SettleResult } from './traitGates';
import { runStatCodeTurn } from './statCodeTurn';
import { primeRolls, resolvePlaceholders, type PlaceholderPick } from './placeholders';
import { DAYPARTS } from './gameClock';
import { canvasRects } from './locationCanvas';
import { isDescendantLocation } from './locationTree';
import { bundledWorldHarness, withValues, type StatValues } from '@/test/bundledWorldHarness';
import type { Daypart } from '@/types';

const { world, persona: cursed, gate, idOf, activeNames: activeOf, build, personaStats, turn, personaStatsOut, statAt, atDaypart, entitySlots, locationSlots,
} = bundledWorldHarness(raw);

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

describe('the Daylight Seam', () => {
  const seam = world.entities.find((e) => e.name === 'The Daylight Seam')!;
  const isActiveAt = (name: string, daypart: Daypart) => {
    const trait = seam.traits!.find((t) => t.name === name)!;
    return (settleDefaults({ ...gate, daypart }).active.owners[seam.id] ?? []).includes(trait.id);
  };
  const daylight = (daypart: Daypart) => !['evening', 'night'].includes(daypart);

  it.each(DAYPARTS)('holds daylight only from dawn through afternoon (%s)', (daypart) => {
    expect(isActiveAt('Open to Daylight', daypart)).toBe(daylight(daypart));
  });

  it.each(DAYPARTS)('goes dark in the evening and at night (%s)', (daypart) => {
    expect(isActiveAt('Dark Seam', daypart)).toBe(!daylight(daypart));
  });
});

describe('the Licorice Flavor chip', () => {
  it('rolls one flavor for both legs of the forest road, the forest and its lore entry', () => {
    const flavor = world.placeholders!.find((p) => p.name === 'Licorice Flavor')!;
    const road = world.connections!.find((c) => (c.aToB?.hint ?? '').includes(flavor.id))!;
    const forest = world.locations.find((l) => l.name === 'The Licorice Forest')!;
    const lore = world.dictionaries![0].entries.find((e) => e.name === 'The Licorice Forest')!;
    const texts = [road.aToB!.hint!, road.bToA!.hint!, forest.aiDescription!, lore.value];
    // Each fresh roll draws the next value, so two separate rolls would read differently.
    let draws = 0;
    const nextValue: PlaceholderPick = (values) => values[draws++ % values.length].text;
    const rolls = primeRolls(world.placeholders!, texts, {}, nextValue);
    const resolved = texts.map((text) => resolvePlaceholders(text, { placeholders: world.placeholders!, rolls }));
    const rolledFlavor = flavor.values.map((value) => value.text).find((text) => resolved[0].includes(`${text} licorice`))!;
    expect(rolledFlavor).toBeDefined();
    for (const text of resolved) expect(text).toContain(`${rolledFlavor} licorice`);
  });
});

describe('the Sugarscape canvas', () => {
  const rects = canvasRects(world.locations);
  const center = (name: string) => {
    const rect = rects.get(world.locations.find((l) => l.name === name)!.id)!;
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  };

  it('places every location by hand', () => {
    expect(world.locations.filter((l) => !l.canvasPosition).map((l) => l.name)).toEqual([]);
  });

  it('keeps every node clear of every other node but the boxes that hold it', () => {
    const nested = (one: string, other: string) => isDescendantLocation(world.locations, one, other) || isDescendantLocation(world.locations, other, one);
    const overlaps: string[] = [];
    for (const first of world.locations) {
      for (const second of world.locations) {
        if (first.id >= second.id || nested(first.id, second.id)) continue;
        const [one, other] = [rects.get(first.id)!, rects.get(second.id)!];
        const apart = one.x >= other.x + other.width || other.x >= one.x + one.width || one.y >= other.y + other.height || other.y >= one.y + one.height;
        if (!apart) overlaps.push(`${first.name} / ${second.name}`);
      }
    }
    expect(overlaps).toEqual([]);
  });

  it('lays the regions out the way the lore gives them, around Sundaelora', () => {
    const middle = center('Sundaelora');
    expect(center('The Licorice Forest').y).toBeLessThan(middle.y);
    expect(center('The Marshmallow Marsh').x).toBeLessThan(middle.x);
    expect(center('Strawberrycream Shores').y).toBeGreaterThan(middle.y);
    expect(center('Strawberrycream Shores').x).toBeGreaterThan(center('The Marshmallow Marsh').x);
    expect(center('Strawberrycream Shores').y).toBeGreaterThan(center('The Marshmallow Marsh').y);
    expect(center('The Candy Dunes').x).toBeGreaterThan(middle.x);
    expect(center('The Toffee Ridge').x).toBeGreaterThan(center('The Licorice Forest').x);
    expect(center('The Toffee Ridge').y).toBeLessThan(center('The Candy Dunes').y);
    expect(center('The Stalefront').x).toBeGreaterThan(center('The Candy Dunes').x);
    expect(center('The Leftover Wastes').x).toBeGreaterThan(center('The Stalefront').x);
  });
});

describe('the Visibility rules', () => {
  const stalefront = world.locations.find((l) => l.name === 'The Stalefront')!;

  it('coats the Cursed in frosting once Stickiness reaches 75', () => {
    const slots = (value: number) => entitySlots(cursed, statAt('Stickiness', value, cursed.id));
    expect(slots(74)).toEqual([0]);
    expect(slots(75)).toEqual([1]);
  });

  it.each(DAYPARTS)('shows the Stalefront seam lit by day and dark at night (%s)', (daypart) => {
    expect(locationSlots(stalefront, atDaypart(daypart))).toEqual(daypart === 'evening' || daypart === 'night' ? [1] : [0]);
  });
});
