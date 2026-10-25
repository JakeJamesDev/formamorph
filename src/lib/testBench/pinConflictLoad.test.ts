import { describe, it, expect, beforeAll } from 'vitest';
import { loadPinWorld } from '@/test/pinWorld';
import { RULES, type RuleWorld } from './rules';
import type { PlaceholderPin } from '@/types';

let world: RuleWorld;

beforeAll(() => {
  world = loadPinWorld();
});

const rule = RULES.find((r) => r.id === 'placeholder-pin-conflict')!;

const pinsOnlyMood = (pins: readonly PlaceholderPin[] | undefined) => pins?.length === 1 && pins[0].placeholderId === 'ph-mood';

/** The pin world with every source that pins only Mood repeated `times` times, under fresh ids. */
function scaled(base: RuleWorld, times: number): RuleWorld {
  const copies = <T extends { id: string }>(list: readonly T[], keep: (item: T) => boolean, edit: (item: T, id: string) => T = (item, id) => ({ ...item, id })) =>
    [...list, ...Array.from({ length: times - 1 }, (_, k) => list.filter(keep).map((item) => edit(item, `${item.id}-copy${k}`))).flat()];
  return {
    ...base,
    traits: copies(base.traits ?? [], (t) => pinsOnlyMood(t.placeholderPins)),
    locations: copies(base.locations ?? [], (l) => pinsOnlyMood(l.placeholderPins), (l, id) => ({ ...l, id, isStarting: false })),
    placeholders: copies(base.placeholders ?? [], (p) => p.id.startsWith('ph-pinner'), (p, id) => ({
      ...p, id, values: p.values.map((v) => ({ ...v, id: `${v.id}-${id}` })),
    })),
  };
}

/** One cold run: a fresh world object, so no cache from an earlier run carries over. */
const timeMs = (target: RuleWorld) => {
  const fresh = { ...target };
  const started = performance.now();
  rule.check(fresh);
  return performance.now() - started;
};

const median = (times: number[]) => [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)];

/** The median time of each world, the worlds taking turns so a load spike hits both. */
function medianPair(worlds: readonly RuleWorld[], runs = 5): number[] {
  for (const target of worlds) timeMs(target);
  const times = worlds.map((): number[] => []);
  for (let run = 0; run < runs; run++) {
    for (const [at, target] of worlds.entries()) times[at].push(timeMs(target));
  }
  return times.map(median);
}

describe('placeholder-pin-conflict on the pin world', () => {
  it('finds Mood\'s conflict, naming every source that pins it', () => {
    const findings = rule.check(world);
    expect(findings.map((f) => [f.items[0].name, f.items.length])).toEqual([['Mood', 552]]);
  });

  it('grows with the square of Mood\'s pins, not faster', () => {
    const big = scaled(world, 4);
    const [moodRows] = rule.check(big).map((f) => f.items.length - 1);
    const [small, large] = medianPair([world, big]);
    console.info(`pin conflict: 551 rows ${small.toFixed(1)} ms, ${moodRows} rows ${large.toFixed(1)} ms`);
    // 3.8x the rows ran 8.6x the time; a walk of every trait per pair ran 54x.
    expect(large).toBeLessThan(25 * small);
  });
});
