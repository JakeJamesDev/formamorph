/**
 * @vitest-environment node
 * (Every built-in runs through the real QuickJS sandbox, which needs node's filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Stat } from '@/types';
import { BUILT_IN_TEMPLATES, defaultSlotValues, fillTemplate, parseTemplateSlots, type CodeTemplate, type TemplateSlot } from './statCodeTemplates';
import { executeStatCode } from './statCodeExecutor';
import { runTestCode, statCodeNames, type StatCodeWorld } from './statCodeTestRun';
import { SAMPLE_SENTENCE } from './scriptTestSamples';

const stat = (id: string, name: string, value: number, max = 100): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max, value, regen: 0, descriptors: [] });

// Energy sits at its Min, since Leave When a Stat Runs Out acts on a stat that has run out.
const world: StatCodeWorld = {
  stats: [stat('h', 'Health', 80), stat('en', 'Energy', 0)],
  statGroups: [], traits: [{ id: 'cursed', name: 'Cursed', statChanges: [] }], traitGroups: [],
  entities: [{ id: 'e-tor', name: 'Tor', stats: [stat('t-grit', 'Grit', 4, 20)] }], entityGroups: [],
  placeholders: [{ id: 'mood', name: 'Mood', values: ['calm', 'wary', 'angry'].map((text) => ({ id: text, text })) }],
  placeholderGroups: [], dictionaries: [],
  locations: [{ id: 'loc-gate', name: 'North Gate' }, { id: 'loc-inn', name: 'Inn', isStarting: true }],
};
const names = statCodeNames(world);

/** The daypart Test Code's clock reads, at every timing. */
const TEST_CODE_DAYPART = 'morning';

/** A name slot filled the way an author picks from this world; every other slot keeps its default. */
const pick = (slot: TemplateSlot): string | undefined => {
  switch (slot.type) {
    case 'stat': return slot.owner ? 'Grit' : slot.name === 'source' ? 'Health' : 'Energy';
    case 'placeholder': return 'Mood';
    case 'trait': return 'Cursed';
    case 'entity': return 'Tor';
    case 'location': return 'North Gate';
    case 'daypart': return TEST_CODE_DAYPART;
    default: return undefined;
  }
};

const filled = (template: CodeTemplate, over: Record<string, string> = {}): string => {
  const { slots, errors } = parseTemplateSlots(template.code, 'worldScript');
  expect(errors).toEqual([]);
  const values = defaultSlotValues(slots);
  for (const slot of slots) values[slot.name] = pick(slot) ?? values[slot.name];
  return fillTemplate(template.code, { ...values, ...over });
};

const builtIn = (id: string): CodeTemplate => BUILT_IN_TEMPLATES.find((candidate) => candidate.id === id)!;

/** Every world script built-in, one case per timing it lists. */
const cases = BUILT_IN_TEMPLATES.flatMap((template) =>
  (template.kind === 'worldScript' ? template.timings.map((timing) => [template.name, timing, template] as const) : []));

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

// Q3: a template listed at a timing must do something there: a write or a sentence. A world script returns nothing.
// Test Code holds no trait on, so Advance Time While a Trait Is On runs in its own block below.
describe.each(cases.filter(([, , template]) => template.id !== 'builtin-world-time-while-trait'))(
  'world script built-in %s at %s',
  (_name, timing, template) => {
    it('runs without error and changes something', async () => {
      const report = await runTestCode(filled(template), timing, { kind: 'world' }, world, { sentence: SAMPLE_SENTENCE });
      expect(report.error).toBeNull();
      expect(report.dropped).toEqual([]);
      const rewrote = report.sentence !== undefined && report.sentence !== SAMPLE_SENTENCE;
      expect(rewrote || report.writes.length > 0, JSON.stringify(report)).toBe(true);
    });
  },
);

describe.each(cases.filter(([, , template]) => template.id === 'builtin-world-time-while-trait'))(
  'world script built-in %s at %s',
  (_name, timing, template) => {
    // The trait is on, as a played world has it. Test Code's world holds none on, and the control run proves
    // the template waits for it.
    const run = (enabled: boolean) => executeStatCode(filled(template, { minutes: '45' }), names.codeNamedStats, null, {
      clock: { deltaHours: 0, elapsedHours: 0 }, traits: [{ name: 'Cursed', enabled, acquired: enabled }], places: names.places,
    });

    it('advances the clock while the trait is on', async () => {
      const outcome = await run(true);
      expect(outcome.error).toBeNull();
      expect(outcome.worldWrites?.minutes, timing).toBe(45);
    });

    it('does nothing while the trait is off', async () => {
      const outcome = await run(false);
      expect(outcome.error).toBeNull();
      expect(outcome.worldWrites?.minutes).toBeUndefined();
    });
  },
);

describe('a world script template that acts on a condition', () => {
  it('Leave When a Stat Runs Out moves only while the stat has run out', async () => {
    const template = builtIn('builtin-world-leave-when-empty');
    const run = (stat: string) => runTestCode(filled(template, { stat }), 'after', { kind: 'world' }, world);
    expect((await run('Energy')).writes).toEqual(['location.move: North Gate']);
    expect((await run('Health')).writes).toEqual([]);
  });

  it('Placeholder by Daypart pins only in the daypart it names', async () => {
    const template = builtIn('builtin-world-placeholder-by-daypart');
    const run = (when: string) => runTestCode(filled(template, { when, position: '2' }), 'before', { kind: 'world' }, world);
    expect((await run(TEST_CODE_DAYPART)).writes).toEqual(['Mood = wary']);
    expect((await run('night')).writes).toEqual([]);
  });
});
