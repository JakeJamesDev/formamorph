/**
 * @vitest-environment node
 * (Every built-in runs through the real QuickJS sandbox, which needs node's filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN_TEMPLATES, defaultSlotValues, fillTemplate, parseTemplateSlots, type TemplateSlot } from './statCodeTemplates';
import { runTestCode, type StatCodeWorld } from './statCodeTestRun';
import { SAMPLE_SENTENCE } from './scriptTestSamples';
import type { Stat } from '@/types';

const stat = (id: string, name: string, value: number, max = 100): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max, value, regen: 0, descriptors: [] });

const subject = stat('self', 'Subject', 40, 200);
const home = { kind: 'globalStat', stat: subject } as const;
const world: StatCodeWorld = {
  stats: [subject, stat('h', 'Health', 80), stat('s', 'Strength', 20)], statGroups: [],
  traits: [{ id: 'cursed', name: 'Cursed', statChanges: [] }], traitGroups: [],
  entities: [{ id: 'mira', name: 'Mira' }], entityGroups: [],
  placeholders: [{ id: 'mood', name: 'Mood', values: ['calm', 'wary', 'angry', 'furious'].map((text) => ({ id: text, text })) }],
  placeholderGroups: [], dictionaries: [],
};

/** A name slot filled the way an author picks from this world; every other slot keeps its default. */
const pick = (slot: TemplateSlot): string | undefined => {
  switch (slot.type) {
    case 'stat': return slot.name === 'secondStat' || slot.name === 'bonusStat' ? 'Strength' : 'Health';
    case 'placeholder': return 'Mood';
    case 'trait': return 'Cursed';
    case 'entity': return 'Mira';
    default: return undefined;
  }
};

const MAX_RUNS = 5;

/** Something moved: a value, a write, or a rewritten sentence. */
const changedBy = (report: Awaited<ReturnType<typeof runTestCode>>): boolean =>
  (report.value !== null && report.value !== subject.value) || report.writes.length > 0
  || (report.sentence !== undefined && report.sentence !== SAMPLE_SENTENCE);

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

// Q3: a template listed at a timing must do something there. One that reads a reading the timing zeroes runs
// clean and changes nothing, so this fails it.
describe.each(BUILT_IN_TEMPLATES.flatMap((template) =>
  (template.kind === 'script' ? template.timings.map((timing) => [template.name, timing, template] as const) : [])))(
  'built-in %s at %s',
  (_name, timing, template) => {
    it('runs without error and changes something', async () => {
      const { slots } = parseTemplateSlots(template.code);
      const values = defaultSlotValues(slots);
      for (const slot of slots) values[slot.name] = pick(slot) ?? values[slot.name];
      const code = fillTemplate(template.code, values);
      // A random template may land on the stat's current value, so it gets a few runs. A fixed one repeats its result.
      let report = await runTestCode(code, timing, home, world, { sentence: SAMPLE_SENTENCE });
      for (let run = 1; run < MAX_RUNS && !changedBy(report); run++) {
        report = await runTestCode(code, timing, home, world, { sentence: SAMPLE_SENTENCE });
      }
      expect(report.error).toBeNull();
      expect(changedBy(report), JSON.stringify(report)).toBe(true);
    });
  },
);

describe('a stat slot tied to the persona', () => {
  it('fills `persona.stats` and runs in Test Code', async () => {
    const cast: StatCodeWorld = { ...world, entities: [{ id: 'wren', name: 'Wren', persona: true, stats: [stat('w-luck', 'Luck', 7, 10)] }] };
    const template = 'return persona.stats[{{s:stat(persona)}}].value * 2;';
    const code = fillTemplate(template, { s: 'Luck' });
    expect(code).toBe('return persona.stats["Luck"].value * 2;');
    // The editor's run has no persona playing, so it runs clean on an empty one; a pending persona holds Wren's stat.
    expect((await runTestCode(code, 'after', home, cast)).error).toBeNull();
    expect(await runTestCode(code, 'after', home, cast, { pendingPersona: true })).toMatchObject({ error: null, value: 14 });
  });
});
