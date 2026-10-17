/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import type { Tool } from '@/types';
import { TOOL_CATALOG } from './toolCatalog';
import { draftProblems } from './toolDraft';
import { parseWorldTools, reorderTools, worldToolClash } from './worldTools';

const tool = (over: Partial<Tool> = {}): Tool => ({
  id: 'w-1', name: 'roll_fate', description: 'Purpose: roll.', params: [],
  handler: { kind: 'template', body: 'Fate says yes.' }, emptyResult: '', offeredTo: ['narration'], ...over,
});

describe('parseWorldTools', () => {
  it('keeps well-formed Tools of each handler kind, in order', () => {
    const tools = [
      tool(),
      tool({ id: 'w-2', name: 'find_place', params: [{ name: 'place', type: 'string', description: '', required: true, options: [] }],
        handler: { kind: 'lookup', source: 'locations', param: 'place', returns: 'summary' } }),
      tool({ id: 'w-3', name: 'tally', handler: { kind: 'script', code: 'return 1;' }, callLimit: 2 }),
    ];
    expect(parseWorldTools(structuredClone(tools))).toEqual(tools);
  });

  it('keeps a Tool named like a catalog Tool', () => {
    const mine = tool({ name: 'get_entity' });
    expect(parseWorldTools([mine])).toEqual([mine]);
  });

  it('drops an unreadable Tool and keeps the rest', () => {
    expect(parseWorldTools([{ id: 'x' }, tool({ name: 'bad name' }), tool()])).toEqual([tool()]);
  });

  it('drops a later Tool that repeats a name or an id', () => {
    const first = tool();
    expect(parseWorldTools([first, tool({ id: 'w-2', name: 'ROLL_FATE' }), tool({ name: 'other' })])).toEqual([first]);
  });

  it('reads anything but a list as no Tools', () => {
    expect(parseWorldTools(undefined)).toEqual([]);
    expect(parseWorldTools({ tools: [] })).toEqual([]);
  });
});

describe('reorderTools', () => {
  const list = ['a', 'b', 'c'].map((id) => tool({ id, name: id }));
  const ids = (tools: readonly Tool[]) => tools.map((t) => t.id);

  it('moves a Tool down and up to the row it drops on', () => {
    expect(ids(reorderTools(list, 'a', 'c'))).toEqual(['b', 'c', 'a']);
    expect(ids(reorderTools(list, 'c', 'a'))).toEqual(['c', 'a', 'b']);
  });

  it('answers the same list for a drop on itself or an unknown row', () => {
    expect(reorderTools(list, 'a', 'a')).toBe(list);
    expect(reorderTools(list, 'a', 'zz')).toBe(list);
  });
});

describe('worldToolClash', () => {
  const mine = [tool({ id: 'u-1', name: 'weather' })];

  it('names the catalog Tool a World Tool replaces', () => {
    expect(worldToolClash(tool({ name: 'Get_Entity' }), mine)).toEqual({ kind: 'catalog', name: 'get_entity' });
  });

  it('names the user Tool a World Tool replaces', () => {
    expect(worldToolClash(tool({ name: 'weather' }), mine)).toEqual({ kind: 'user', name: 'weather' });
  });

  it('finds no clash for a fresh name', () => {
    expect(worldToolClash(tool(), mine)).toBeNull();
  });
});

describe('a World Tool draft', () => {
  const others = [tool({ id: 'w-2', name: 'tally' })];

  it('saves with a catalog Tool name', () => {
    expect(draftProblems(tool({ name: TOOL_CATALOG[0].name }), others, [], { world: true }).name).toBeNull();
  });

  it('refuses a name another World Tool uses', () => {
    expect(draftProblems(tool({ name: 'Tally' }), others, [], { world: true }).name).toBe('taken');
  });

  it('leaves a user Tool draft refusing a catalog name', () => {
    expect(draftProblems(tool({ name: TOOL_CATALOG[0].name }), others).name).toBe('builtin');
  });
});
