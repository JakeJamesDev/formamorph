import { describe, it, expect } from 'vitest';
import type { Tool } from '@/types';
import { TOOL_CATALOG } from './toolCatalog';
import { buildToolPack, copyTool, parseToolPack, planToolImport } from './toolPack';

const tool = (patch: Partial<Tool> = {}): Tool => ({
  id: 'u-1', name: 'get_weather', description: 'Purpose: weather.', params: [
    { name: 'place', type: 'string', description: 'Where.', required: true, options: [] },
  ],
  handler: { kind: 'template', body: 'Sunny in {{arg:place}}.' }, emptyResult: 'Nothing.', offeredTo: ['narration'], enabled: true, ...patch,
});

const script = tool({ id: 'u-2', name: 'roll_dice', handler: { kind: 'script', code: 'return 4;' } });

describe('the Tool pack', () => {
  it('round-trips user Tools through its JSON', () => {
    const pack = buildToolPack([tool(), script], '9.9.9');
    expect(pack).toEqual({ formamorphTools: 1, appVersion: '9.9.9', tools: [tool(), script] });
    expect(parseToolPack(JSON.stringify(pack))).toEqual({ tools: [tool(), script], warnings: [] });
  });

  it('rejects text that is not JSON, and JSON that is not a pack', () => {
    expect(() => parseToolPack('{nope')).toThrow('That file isn’t valid JSON.');
    expect(() => parseToolPack('{"formamorphTemplates":1,"templates":[]}')).toThrow('That file isn’t a Formamorph Tool pack.');
    expect(() => parseToolPack('{"formamorphTools":1,"tools":{}}')).toThrow('That file isn’t a Formamorph Tool pack.');
  });

  it('warns on a pack from a newer format and reads what it can', () => {
    const { tools, warnings } = parseToolPack(JSON.stringify({ formamorphTools: 2, tools: [script] }));
    expect(tools).toEqual([script]);
    expect(warnings).toEqual(['This pack was made with a newer format. Anything unrecognized was skipped.']);
  });

  it('drops a malformed Tool with a warning and keeps the rest', () => {
    const broken = { ...tool({ id: 'u-3', name: 'bad name' }) };
    const { tools, warnings } = parseToolPack(JSON.stringify({ formamorphTools: 1, tools: [broken, script] }));
    expect(tools).toEqual([script]);
    expect(warnings).toEqual(['Skipped "bad name": its name uses characters other than letters, digits, _ and -, or is over 64 characters.']);
  });
});

describe('planToolImport', () => {
  const mint = (() => { let n = 0; return () => `new-${++n}`; })();

  it('gives every imported Tool a fresh id and flags a Script Tool', () => {
    const plan = planToolImport([], [tool(), script], mint);
    expect(plan.added.map((t) => t.name)).toEqual(['get_weather', 'roll_dice']);
    expect(plan.added.every((t) => t.id.startsWith('new-'))).toBe(true);
    expect(plan.skipped).toEqual([]);
    expect(plan.hasScript).toBe(true);
  });

  it('skips a name the preset already holds, in any case, and a repeat inside the pack', () => {
    const plan = planToolImport([tool()], [tool({ name: 'GET_WEATHER' }), script, script], mint);
    expect(plan.added.map((t) => t.name)).toEqual(['roll_dice']);
    expect(plan.skipped).toEqual(['GET_WEATHER', 'roll_dice']);
  });

  it('does not flag a Script Tool it skipped', () => {
    expect(planToolImport([script], [script], mint).hasScript).toBe(false);
  });
});

describe('copyTool', () => {
  const [catalog] = TOOL_CATALOG;

  it('copies a Tool under a _copy name with a fresh id, enabled as the source was', () => {
    const copy = copyTool(catalog, [], 'fresh');
    expect(copy).toEqual({ ...catalog, id: 'fresh', name: 'get_entity_copy' });
  });

  it('numbers the copy when the name is taken', () => {
    const held = [tool({ name: 'get_entity_copy' }), tool({ id: 'u-9', name: 'get_entity_copy_2' })];
    expect(copyTool(catalog, held, 'fresh').name).toBe('get_entity_copy_3');
  });

  it('keeps the copy name within 64 characters', () => {
    const long = tool({ name: 'x'.repeat(64) });
    expect(copyTool(long, [long], 'fresh').name).toBe(`${'x'.repeat(59)}_copy`);
  });
});
