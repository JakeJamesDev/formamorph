import type { Tool, ToolOverrideMap } from '@/types';

/** The entity lookup. The description is the probed retrieve-first wording (narration-tool-call-probe). */
const GET_ENTITY: Tool = {
  id: 'get_entity',
  name: 'get_entity',
  description: [
    'Purpose: Retrieve the full authored information needed to narrate an entity. Summaries help you choose which entities to include.',
    'Use when: Once you identify an entity to include, retrieve its full entry before planning its portrayal, unless already loaded for this response. This applies to direct and indirect references, including background appearances. Leave unrelated entities unfetched.',
    "Input: name — the entity's name from the entity list.",
    'Output: JSON with a matches array. Each match contains id, name, and the full authored description when provided by the author. An empty matches array means no matching entity was found.',
  ].join('\n'),
  params: [{ name: 'name', type: 'string', description: '', required: true, options: [] }],
  handler: { kind: 'lookup', source: 'entities', param: 'name', returns: 'full' },
  emptyResult: '{"matches": []}',
  offeredTo: ['narration'],
  enabled: false,
};

/** The built-in Tools every preset can see. A preset changes only their `enabled` and `offeredTo`. */
export const TOOL_CATALOG: readonly Tool[] = [GET_ENTITY];

const CATALOG_IDS = new Set(TOOL_CATALOG.map((t) => t.id));

/** Whether `id` names a catalog Tool. */
export function isCatalogToolId(id: string): boolean {
  return CATALOG_IDS.has(id);
}

/** The catalog as a preset sees it, with that preset's overrides applied. */
export function applyToolOverrides(overrides: ToolOverrideMap): Tool[] {
  return TOOL_CATALOG.map((tool) => {
    const o = overrides[tool.id];
    return o ? { ...tool, enabled: o.enabled, offeredTo: [...o.offeredTo] } : tool;
  });
}
