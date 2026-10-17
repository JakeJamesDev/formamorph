/**
 * @vitest-environment node
 * (Every built-in runs through the real QuickJS sandbox, which needs node's filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN_TEMPLATES, defaultSlotValues, fillTemplate, parseTemplateSlots, type TemplateSlot } from './statCodeTemplates';
import { runTestCode, statCodeNames, type StatCodeWorld } from './statCodeTestRun';
import type { Stat } from '@/types';

const stat = (id: string, name: string, value: number, max = 100): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max, value, regen: 0, descriptors: [] });

const subject = stat('self', 'Subject', 40, 200);
const world: StatCodeWorld = {
  stats: [subject, stat('h', 'Health', 80), stat('s', 'Strength', 20)], statGroups: [],
  traits: [{ id: 'cursed', name: 'Cursed', statChanges: [] }], traitGroups: [],
  entities: [{ id: 'mira', name: 'Mira' }], entityGroups: [],
  placeholders: [{ id: 'mood', name: 'Mood', values: ['calm', 'wary', 'angry', 'furious'].map((text) => ({ id: text, text })) }],
  placeholderGroups: [], dictionaries: [],
};
const names = statCodeNames(world);

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
      const report = await runTestCode(fillTemplate(template.code, values), timing, subject, names);
      expect(report.error).toBeNull();
      const changed = (report.value !== null && report.value !== subject.value) || report.writes.length > 0;
      expect(changed, JSON.stringify(report)).toBe(true);
    });
  },
);
