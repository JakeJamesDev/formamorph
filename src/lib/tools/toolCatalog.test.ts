import { describe, it, expect } from 'vitest';
import type { Tool } from '@/types';
import { TOOL_CATALOG, isCatalogToolId } from './toolCatalog';
import { toolNameProblem, parseTool, parseToolEnabledMap } from './toolValidation';

const RETRIEVE_FIRST = 'Purpose: Retrieve the full authored information needed to narrate an entity. Summaries help you choose which entities to include.\nUse when: Once you identify an entity to include, retrieve its full entry before planning its portrayal, unless already loaded for this response. This applies to direct and indirect references, including background appearances. Leave unrelated entities unfetched.\nInput: name — the entity\'s name from the entity list.\nOutput: JSON with a matches array. Each match contains id, name, and the full authored description when provided by the author. An empty matches array means no matching entity was found.';

const userTool = (patch: Partial<Tool> = {}): Tool => ({
  id: 'u-1', name: 'get_weather', description: 'Purpose: weather.', params: [
    { name: 'place', type: 'string', description: 'Where.', required: true, options: [] },
  ],
  handler: { kind: 'template', body: 'Sunny in {{place}}.' }, emptyResult: 'Nothing.', offeredTo: ['narration'], ...patch,
});

describe('the built-in catalog', () => {
  it('ships get_entity with the probed retrieve-first wording, offered to narration only', () => {
    const tool = TOOL_CATALOG.find((t) => t.name === 'get_entity');
    expect(tool).toEqual({
      id: 'get_entity', name: 'get_entity', description: RETRIEVE_FIRST,
      params: [{ name: 'name', type: 'string', description: '', required: true, options: [] }],
      handler: { kind: 'lookup', source: 'entities', param: 'name', returns: 'full' },
      emptyResult: '{"matches": []}', offeredTo: ['narration'],
    });
  });

  it('knows its own ids', () => {
    expect(isCatalogToolId('get_entity')).toBe(true);
    expect(isCatalogToolId('u-1')).toBe(false);
  });
});

describe('toolNameProblem', () => {
  it('accepts letters, digits, _ and - from 1 to 64 characters', () => {
    expect(toolNameProblem('a', [])).toBeNull();
    expect(toolNameProblem('Get-Weather_2', [])).toBeNull();
    expect(toolNameProblem('x'.repeat(64), [])).toBeNull();
  });

  it('rejects an empty name, a name over 64 characters and any other character', () => {
    expect(toolNameProblem('', [])).toBe('format');
    expect(toolNameProblem('x'.repeat(65), [])).toBe('format');
    for (const bad of ['get weather', 'get.weather', 'wetter€', 'a/b']) expect(toolNameProblem(bad, [])).toBe('format');
  });

  it('rejects a name another Tool in the preset uses, but not the Tool itself', () => {
    const siblings = [userTool()];
    expect(toolNameProblem('get_weather', siblings)).toBe('taken');
    expect(toolNameProblem('GET_WEATHER', siblings)).toBe('taken');
    expect(toolNameProblem('get_weather', siblings, 'u-1')).toBeNull();
  });

  it('rejects a catalog name', () => {
    expect(toolNameProblem('get_entity', [])).toBe('builtin');
    expect(toolNameProblem('Get_Entity', [])).toBe('builtin');
  });
});

describe('parseTool', () => {
  it('accepts a well-formed Tool of each handler kind', () => {
    const lookup = userTool({ handler: { kind: 'lookup', source: 'dictionary', param: 'place', returns: 'summary' }, callLimit: 2 });
    const script = userTool({ handler: { kind: 'script', code: 'return args.place;' } });
    const enumTool = userTool({ params: [{ name: 'mood', type: 'enum', description: '', required: false, options: ['calm', 'angry'] }] });
    for (const tool of [userTool(), lookup, script, enumTool]) expect(parseTool(structuredClone(tool))).toEqual({ tool });
  });

  it('drops prompt kinds it does not know and keeps the Tool', () => {
    const r = parseTool({ ...userTool(), offeredTo: ['narration', 'futurePrompt'] });
    expect(r).toEqual({ tool: userTool() });
  });

  const malformed: [string, unknown][] = [
    ['not an object', 'get_weather'],
    ['no id', { ...userTool(), id: '' }],
    ['a bad name', userTool({ name: 'get weather' })],
    ['a catalog name', userTool({ name: 'get_entity' })],
    ['no description', { ...userTool(), description: 7 }],
    ['params not a list', { ...userTool(), params: {} }],
    ['an unnamed param', userTool({ params: [{ name: '', type: 'string', description: '', required: true, options: [] }] })],
    ['a duplicate param', userTool({ params: [...userTool().params, ...userTool().params] })],
    ['an unknown param type', { ...userTool(), params: [{ name: 'p', type: 'date', description: '', required: true, options: [] }] }],
    ['non-string options', { ...userTool(), params: [{ name: 'p', type: 'enum', description: '', required: true, options: [1] }] }],
    ['an unknown handler kind', { ...userTool(), handler: { kind: 'http', url: 'x' } }],
    ['a lookup with an unknown source', { ...userTool(), handler: { kind: 'lookup', source: 'stats', param: 'p', returns: 'full' } }],
    ['a lookup with an unknown return', { ...userTool(), handler: { kind: 'lookup', source: 'entities', param: 'p', returns: 'all' } }],
    ['a template with no body', { ...userTool(), handler: { kind: 'template' } }],
    ['a script with no code', { ...userTool(), handler: { kind: 'script', code: null } }],
    ['no empty result', { ...userTool(), emptyResult: undefined }],
    ['offeredTo not a list', { ...userTool(), offeredTo: 'narration' }],
    ['a zero call limit', userTool({ callLimit: 0 })],
    ['a fractional call limit', userTool({ callLimit: 1.5 })],
    ['a text call limit', { ...userTool(), callLimit: '3' }],
  ];
  it.each(malformed)('rejects a Tool with %s', (_label, raw) => {
    const r = parseTool(raw);
    expect('error' in r && r.error.length > 0).toBe(true);
  });
});

describe('parseToolEnabledMap', () => {
  it('keeps boolean entries, off ones included', () => {
    expect(parseToolEnabledMap({ get_entity: true, 'u-1': false })).toEqual({ get_entity: true, 'u-1': false });
  });

  it('drops non-boolean entries and ids the filter refuses', () => {
    expect(parseToolEnabledMap({ get_entity: 'on', 'u-1': true }, isCatalogToolId)).toBeUndefined();
    expect(parseToolEnabledMap({ get_entity: true, 'u-1': true }, isCatalogToolId)).toEqual({ get_entity: true });
    expect(parseToolEnabledMap([])).toBeUndefined();
    expect(parseToolEnabledMap('x')).toBeUndefined();
  });
});
