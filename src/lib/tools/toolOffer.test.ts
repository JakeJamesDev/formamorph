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
  emptyResult: '', offeredTo: ['narration'], enabled: true, ...over,
});

function sedgeSnapshot() {
  const world: AuthoredWorld = migrateWorld(structuredClone(rawWorld));
  return buildToolSnapshot(authoredChipScene(world), world.dictionaries ?? []);
}

describe('toolsOfferedTo', () => {
  const catalogOn = { ...GET_ENTITY, enabled: true };

  it('offers an enabled Tool to the prompts it names and to no other', () => {
    const tools = [catalogOn, userTool({ id: 'c', name: 'choices_only', offeredTo: ['choices'] })];
    expect(toolsOfferedTo('narration', tools).map((t) => t.name)).toEqual(['get_entity']);
    expect(toolsOfferedTo('choices', tools).map((t) => t.name)).toEqual(['choices_only']);
    expect(toolsOfferedTo('summary', tools)).toEqual([]);
  });

  it('leaves a disabled Tool out', () => {
    expect(toolsOfferedTo('narration', [GET_ENTITY, userTool({ enabled: false })])).toEqual([]);
  });

  it('keeps catalog Tools ahead of user Tools, in list order', () => {
    const tools = [catalogOn, userTool({ id: 'a', name: 'a' }), userTool({ id: 'b', name: 'b' })];
    expect(toolsOfferedTo('narration', tools).map((t) => t.name)).toEqual(['get_entity', 'a', 'b']);
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
