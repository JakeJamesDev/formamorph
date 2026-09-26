import type { Tool } from '@/types';
import { ROLL } from './rollTool';

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
};

/** The location lookup. Its wording follows the entity lookup's outline. */
const GET_LOCATION: Tool = {
  id: 'get_location',
  name: 'get_location',
  description: [
    'Purpose: Retrieve the full authored information needed to narrate a location. Summaries help you choose where the scene can go.',
    'Use when: Once the scene enters or looks toward a location, retrieve its full entry before describing it, unless already loaded for this response. Leave unrelated locations unfetched.',
    "Input: name — the location's name from a location list.",
    'Output: JSON with a matches array. Each match contains id, name, and the full authored description when provided by the author. An empty matches array means no matching location was found.',
  ].join('\n'),
  params: [{ name: 'name', type: 'string', description: '', required: true, options: [] }],
  handler: { kind: 'lookup', source: 'locations', param: 'name', returns: 'full' },
  emptyResult: '{"matches": []}',
  offeredTo: ['narration'],
};

/** The dictionary lookup. "Lore" matches the headers the narration prompt gives the dictionary. */
const GET_DICTIONARY_ENTRY: Tool = {
  id: 'get_dictionary_entry',
  name: 'get_dictionary_entry',
  description: [
    'Purpose: Retrieve the lore entry that explains a term of this world. The lore sections hold only the entries the story has activated.',
    'Use when: Once the story uses a term of this world that you need to narrate accurately, retrieve its entry, unless already loaded for this response. Leave unrelated terms unfetched.',
    "Input: keyword — the term as the story writes it, or a lore entry's name.",
    'Output: JSON with a matches array. Each match contains id, name, and the entry text as description when the entry has text. An empty matches array means no matching entry was found.',
  ].join('\n'),
  params: [{ name: 'keyword', type: 'string', description: '', required: true, options: [] }],
  handler: { kind: 'lookup', source: 'dictionary', param: 'keyword', returns: 'full' },
  emptyResult: '{"matches": []}',
  offeredTo: ['narration'],
};

/** The memory search. Its source is catalog-only, and its wording awaits its own probe. */
const RECALL: Tool = {
  id: 'recall',
  name: 'recall',
  description: [
    'Purpose: Search the memories of earlier turns that this conversation no longer holds in full.',
    'Use when: The story returns to a past event, promise, gift, or person from before the recent turns, and you need its details.',
    'Input: query — a few words from the event, such as names, places, or objects.',
    'Output: JSON with a matches array, oldest first. Each match contains turn, kind (digest or diary), text, and, for a diary entry, the character who wrote it. An empty matches array means no memory matched.',
  ].join('\n'),
  params: [{ name: 'query', type: 'string', description: '', required: true, options: [] }],
  handler: { kind: 'lookup', source: 'memories', param: 'query', returns: 'full' },
  emptyResult: '{"matches": []}',
  offeredTo: ['narration'],
};

/** The built-in Tools every preset lists. A preset switches them on or off; the definitions never change. */
export const TOOL_CATALOG: readonly Tool[] = [GET_ENTITY, GET_LOCATION, GET_DICTIONARY_ENTRY, RECALL, ROLL];

const CATALOG_IDS = new Set(TOOL_CATALOG.map((t) => t.id));

/** Whether `id` names a catalog Tool. */
export function isCatalogToolId(id: string): boolean {
  return CATALOG_IDS.has(id);
}
