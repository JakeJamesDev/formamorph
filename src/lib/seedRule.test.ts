/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Stat, WorldOverview } from '@/types';
import { startingGateStat } from './gateStats';
import { statStartValue } from './statDescriptorGeometry';
import { seedNewGameStats } from './traitRuntime';
import { pageStatDeltas } from './statChanges';
import { runTestCode, type StatCodeWorld } from './statCodeTestRun';
import { checkScripts } from './testBench/scriptCheck';
import type { RuleWorld } from './testBench/rules';
import { boxScripts } from '@/test/scriptFixtures';

// Q8: every reader opens a stat at its authored value, then its min, then zero; `starting` is only the delta baseline.
const stat = (over: Partial<Stat> & { id: string; name: string }): Stat => ({
  type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], ...over,
});
const mood = stat({ id: 'mood', name: 'Mood', starting: 10, value: 5 });
const probe = stat({ id: 'probe', name: 'Probe' });
const reads = 'const v = stats.Mood.value; if (v !== 5) throw new Error("saw " + v); return v;';

describe('the seed rule (Q8)', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('opens a stat at its authored value in play, not at `starting`', () => {
    expect(seedNewGameStats([mood])[0]).toMatchObject({ value: 5 });
  });

  it('writes the delta baseline from the opening value, so turn one shows no change (Q8)', () => {
    const [seeded] = seedNewGameStats([mood]);
    expect(seeded.starting).toBe(5);
    expect(pageStatDeltas([seeded], undefined)).toEqual({ mood: 0 });
  });

  it('opens an authored zero at zero inside the range, and clamps it to a higher min', () => {
    expect(seedNewGameStats([stat({ id: 's', name: 'S', min: -10, value: 0 })])[0]).toMatchObject({ value: 0, starting: 0 });
    expect(seedNewGameStats([stat({ id: 's', name: 'S', min: 5, value: 0 })])[0]).toMatchObject({ value: 5, starting: 5 });
    expect(seedNewGameStats([stat({ id: 's', name: 'S', min: 3 })])[0]).toMatchObject({ value: 3, starting: 3 });
  });

  it('gives a stat Condition the authored value as its start', () => {
    expect(startingGateStat(mood).value).toBe(5);
  });

  it('falls back to the min, then zero, as play does', () => {
    expect(statStartValue(stat({ id: 's', name: 'S', min: 3 }))).toBe(3);
    expect(statStartValue(stat({ id: 's', name: 'S', min: 3, value: 0 }))).toBe(3);
    expect(statStartValue(stat({ id: 's', name: 'S', starting: 9 }))).toBe(0);
    expect(statStartValue({ max: 10 })).toBe(0);
  });

  it('hands the Bench’s turn-one run the authored value', async () => {
    const world: RuleWorld = {
      worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: 'Narrate the fen.' } as WorldOverview,
      stats: [mood, { ...probe, scripts: boxScripts({ after: reads }) }],
      locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
      entities: [], traits: [], statUpdates: [], dictionaries: [], placeholders: [],
    };
    expect(await checkScripts(world)).toEqual([]);
  });

  const testCode = (stats: Stat[], code: string) => runTestCode(code, 'after', { kind: 'globalStat', stat: probe }, {
    stats: [...stats, probe], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [],
    placeholderGroups: [], dictionaries: [],
  } satisfies StatCodeWorld);

  it('hands Test Code the authored value', async () => {
    const report = await testCode([mood], reads);
    expect(report.error).toBeNull();
    expect(report.value).toBe(5);
  });

  it('hands Test Code the min for a stat with no authored value', async () => {
    const report = await testCode([stat({ id: 'grit', name: 'Grit', min: 3 })], 'return stats.Grit.value;');
    expect(report.error).toBeNull();
    expect(report.value).toBe(3);
  });
});
