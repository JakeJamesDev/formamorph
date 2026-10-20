/**
 * @vitest-environment node
 * (Every built-in runs through the real QuickJS sandbox, which needs node's filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tool, ToolParam, ToolScriptTiming } from '@/types';
import {
  BUILT_IN_TEMPLATES, defaultSlotValues, fillTemplate, missingParams, parseTemplateSlots, type CodeTemplate, type TemplateSlot,
} from './statCodeTemplates';
import { type StatCodeWorld } from './statCodeTestRun';
import { tryWorldToolScript } from './tools/worldToolTry';

const world: StatCodeWorld = {
  stats: [{ id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 40, regen: 0, descriptors: [] }],
  statGroups: [], traits: [], traitGroups: [], entities: [{ id: 'e-tor', name: 'Tor' }], entityGroups: [],
  placeholders: [], placeholderGroups: [], dictionaries: [],
  locations: [{ id: 'loc-gate', name: 'North Gate' }, { id: 'loc-inn', name: 'Inn', isStarting: true }],
};

/** What the AI sends for each Parameter a built-in reads, by its slot name. */
const SENT: Record<string, string | number> = {
  sides: 6, amount: 7, place: 'North Gate', minutes: 30, name: 'Tor', line: 'The gate held.', word: 'gate',
};
const SENTENCE = 'Tor shuts the gate.';

/** A name slot filled the way an author picks from this world; a param slot keeps the Parameter it would create. */
const pick = (slot: TemplateSlot): string | undefined => {
  switch (slot.type) {
    case 'stat': return 'Health';
    case 'entity': return 'Tor';
    default: return undefined;
  }
};

/** The Parameters Insert creates on a Tool with none, each with a sample argument and `required` as asked. */
const createdParams = (slots: TemplateSlot[], values: Record<string, string>, required: boolean): ToolParam[] =>
  missingParams(slots, values, []).map((param) => {
    if (!(param.name in SENT)) throw new Error(`No sample argument for the "${param.name}" Parameter`);
    expect(param.type, param.name).toBe(typeof SENT[param.name] === 'number' ? 'number' : 'string');
    return { ...param, required };
  });

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

/** The built-in as a Tool at `timing`, its slots filled, each Parameter `required` or not. */
const toolOf = (template: CodeTemplate, timing: ToolScriptTiming, required: boolean) => {
  const { slots, errors } = parseTemplateSlots(template.code, 'worldTool');
  expect(errors).toEqual([]);
  const values = defaultSlotValues(slots);
  for (const slot of slots) values[slot.name] = pick(slot) ?? values[slot.name];
  const params = createdParams(slots, values, required);
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
      const result = await tryWorldToolScript(tool, args, world, { sentence: SENTENCE });
      expect(result.failure, result.text).toBeUndefined();
      expect(result.warnings).toEqual([]);
      const replied = timing === 'call' && result.text !== tool.emptyResult;
      const rewrote = result.sentence !== undefined && result.sentence !== SENTENCE;
      expect(replied || rewrote || result.writes.length > 0, JSON.stringify(result)).toBe(true);
    });

    // An optional Parameter the AI leaves out is missing from `args`, never the text "undefined".
    it('writes nothing made of a left-out optional argument', async () => {
      const { tool } = toolOf(template, timing, false);
      const result = await tryWorldToolScript(tool, '{}', world, { sentence: SENTENCE });
      expect(result.failure, result.text).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain('undefined');
    });
  },
);

describe('a template with an entity slot and a stat slot tied to it', () => {
  const stat = (id: string, name: string, value: number) =>
    ({ id, name, type: 'number' as const, description: '', min: 0, max: 20, value, regen: 0, descriptors: [] });
  const cast: StatCodeWorld = { ...world, entities: [{ id: 'e-tor', name: 'Tor', stats: [stat('t-grit', 'Grit', 4)] }, { id: 'e-ula', name: 'Ula', stats: [stat('u-grit', 'Grit', 9)] }] };
  const code = 'entities[{{who:entity}}].stats[{{s:stat(who)}}].value += 2;';

  it('writes the picked entity’s stat in Try It', async () => {
    const { slots } = parseTemplateSlots(code, 'worldTool');
    const tool: Tool = {
      id: 't', name: 'try', description: '', params: [], emptyResult: '{}', offeredTo: [],
      handler: { kind: 'script', code: fillTemplate(code, { ...defaultSlotValues(slots), who: 'Ula', s: 'Grit' }), timing: 'call' },
    };
    const result = await tryWorldToolScript(tool, '{}', cast);
    expect(result.failure, result.text).toBeUndefined();
    expect(result.warnings).toEqual([]);
    // Ula's 9 plus 2; Tor's Grit is untouched.
    expect(result.writes).toEqual(['entities.Ula.stats.Grit.value = 11']);
  });
});
