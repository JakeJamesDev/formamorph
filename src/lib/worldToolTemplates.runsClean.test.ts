/**
 * @vitest-environment node
 * (Every built-in runs through the real QuickJS sandbox, which needs node's filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tool, ToolParam, ToolScriptTiming } from '@/types';
import {
  BUILT_IN_TEMPLATES, defaultSlotValues, fillTemplate, parseTemplateSlots, type CodeTemplate, type TemplateSlot,
} from './statCodeTemplates';
import { statCodeNames, type StatCodeWorld } from './statCodeTestRun';
import { tryWorldToolScript } from './tools/worldToolTry';

const world: StatCodeWorld = {
  stats: [{ id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 40, regen: 0, descriptors: [] }],
  statGroups: [], traits: [], traitGroups: [], entities: [{ id: 'e-tor', name: 'Tor' }], entityGroups: [],
  placeholders: [], placeholderGroups: [], dictionaries: [],
  locations: [{ id: 'loc-gate', name: 'North Gate' }, { id: 'loc-inn', name: 'Inn', isStarting: true }],
};
const names = statCodeNames(world);

/** What the AI sends for each Parameter a built-in reads, by its slot name. */
const SENT: Record<string, string | number> = {
  sides: 6, amount: 7, place: 'North Gate', minutes: 30, name: 'Tor', line: 'The gate held.', word: 'gate',
};
const SENTENCE = 'Tor shuts the gate.';

/** A name slot filled the way an author picks from this world; a param slot names a Parameter after itself. */
const pick = (slot: TemplateSlot): string | undefined => {
  switch (slot.type) {
    case 'stat': return 'Health';
    case 'entity': return 'Tor';
    case 'param': return slot.name;
    default: return undefined;
  }
};

const paramFor = (name: string): ToolParam => {
  if (!(name in SENT)) throw new Error(`No sample argument for the "${name}" Parameter`);
  return { name, type: typeof SENT[name] === 'number' ? 'number' : 'string', description: '', required: true, options: [] };
};

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

/** The built-in as a Tool at `timing`, its slots filled, each Parameter `required` or not. */
const toolOf = (template: CodeTemplate, timing: ToolScriptTiming, required: boolean) => {
  const { slots, errors } = parseTemplateSlots(template.code, 'worldTool');
  expect(errors).toEqual([]);
  const values = defaultSlotValues(slots);
  for (const slot of slots) values[slot.name] = pick(slot) ?? values[slot.name];
  const params = slots.filter((slot) => slot.type === 'param').map((slot) => ({ ...paramFor(slot.name), required }));
  const tool: Tool = {
    id: 't', name: 'try', description: '', params, emptyResult: '{}', offeredTo: [],
    handler: { kind: 'script', code: fillTemplate(template.code, values), timing },
  };
  return { tool, params };
};

const worldToolCases = BUILT_IN_TEMPLATES.flatMap((template) =>
  (template.kind === 'worldTool' ? template.timings.map((timing) => [template.name, timing, template] as const) : []));

// Q3: a template listed at a timing must do something there: a reply, a write or a sentence.
describe.each(worldToolCases)(
  'World Tool built-in %s at %s',
  (_name, timing, template) => {
    it('runs without error and changes something', async () => {
      const { tool, params } = toolOf(template, timing, true);
      const args = JSON.stringify(Object.fromEntries(params.map((param) => [param.name, SENT[param.name]])));
      const result = await tryWorldToolScript(tool, args, names, { sentence: SENTENCE });
      expect(result.failure, result.text).toBeUndefined();
      expect(result.warnings).toEqual([]);
      const replied = timing === 'call' && result.text !== tool.emptyResult;
      const rewrote = result.sentence !== undefined && result.sentence !== SENTENCE;
      expect(replied || rewrote || result.writes.length > 0, JSON.stringify(result)).toBe(true);
    });

    // An optional Parameter the AI leaves out is missing from `args`, never the text "undefined".
    it('writes nothing made of a left-out optional argument', async () => {
      const { tool } = toolOf(template, timing, false);
      const result = await tryWorldToolScript(tool, '{}', names, { sentence: SENTENCE });
      expect(result.failure, result.text).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain('undefined');
    });
  },
);
