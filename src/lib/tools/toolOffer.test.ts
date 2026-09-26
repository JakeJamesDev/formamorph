/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import rawWorld from '../../../testing/baseline/sedge-landing.json';
import { migrateWorld } from '@/lib/version';
import { authoredChipScene, type AuthoredWorld } from '@/lib/chipValues/authoredScene';
import type { Tool } from '@/types';
import { TOOL_CATALOG } from './toolCatalog';
import { buildToolSnapshot } from './toolSnapshot';
import { snapshotToolExecutor, toolsOfferedTo } from './toolOffer';

const GET_ENTITY = TOOL_CATALOG.find((t) => t.id === 'get_entity')!;

const userTool = (over: Partial<Tool>): Tool => ({
  id: 'u', name: 'u', description: '', params: [], handler: { kind: 'template', body: 'hi' },
  emptyResult: '', offeredTo: ['narration'], ...over,
});

function sedgeSnapshot() {
  const world: AuthoredWorld = migrateWorld(structuredClone(rawWorld));
  return buildToolSnapshot(authoredChipScene(world), world.dictionaries ?? []);
}

describe('toolsOfferedTo', () => {
  const allOn = { get_entity: true, u: true, c: true, a: true, b: true };

  it('offers an enabled Tool to the prompts it names and to no other', () => {
    const tools = [GET_ENTITY, userTool({ id: 'c', name: 'choices_only', offeredTo: ['choices'] })];
    expect(toolsOfferedTo('narration', tools, allOn, true).map((t) => t.name)).toEqual(['get_entity']);
    expect(toolsOfferedTo('choices', tools, allOn, true).map((t) => t.name)).toEqual(['choices_only']);
    expect(toolsOfferedTo('summary', tools, allOn, true)).toEqual([]);
  });

  it('leaves out a Tool the preset switches off or never names', () => {
    expect(toolsOfferedTo('narration', [GET_ENTITY, userTool({})], { u: false }, true)).toEqual([]);
    expect(toolsOfferedTo('narration', [GET_ENTITY, userTool({})], { get_entity: true }, true)).toEqual([GET_ENTITY]);
  });

  it('offers nothing with the global Tools switch off', () => {
    expect(toolsOfferedTo('narration', [GET_ENTITY, userTool({})], allOn, false)).toEqual([]);
  });

  it('keeps catalog Tools ahead of user Tools, in list order', () => {
    const tools = [GET_ENTITY, userTool({ id: 'a', name: 'a' }), userTool({ id: 'b', name: 'b' })];
    expect(toolsOfferedTo('narration', tools, allOn, true).map((t) => t.name)).toEqual(['get_entity', 'a', 'b']);
  });
});

describe('snapshotToolExecutor', () => {
  it('builds no snapshot until a Tool is called', () => {
    const build = vi.fn(sedgeSnapshot);
    snapshotToolExecutor(build);
    expect(build).not.toHaveBeenCalled();
  });

  it('builds the snapshot once and shares it across calls and Tools', async () => {
    const build = vi.fn(sedgeSnapshot);
    const execute = snapshotToolExecutor(build);
    const echo = userTool({ name: 'echo', handler: { kind: 'template', body: 'fixed' } });
    await execute(GET_ENTITY, '{"name":"Bram"}');
    await execute(GET_ENTITY, '{"name":"Wick"}');
    await execute(echo, '{}');
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('runs the call through the Tool Runner against the snapshot', async () => {
    const execute = snapshotToolExecutor(sedgeSnapshot);
    const result = await execute(GET_ENTITY, '{"name":"bram"}');
    expect(result.failure).toBeUndefined();
    const { matches } = JSON.parse(result.text) as { matches: { name: string }[] };
    expect(matches.map((m) => m.name)).toEqual(['Bram']);
  });
});
