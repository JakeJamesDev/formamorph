import { copiesAt } from './inventory';
import { copyState, usesLeft } from './items';
import type { ContextFormat } from './statContext';
import { NONE_PLACEHOLDER } from './promptFallbacks';
import { xmlEscape } from './utils';
import type { Item, ItemCopy, ItemCopyWhere, RuntimeItem } from '@/types';

/** What the inventory block reads: the authored items, every Item Copy, and who and where the scene is. */
export interface InventoryScene {
  items: readonly Item[];
  copies: readonly ItemCopy[];
  /** The runtime items the Inventory pass made. Absent ⇒ none. */
  runtimeItems?: readonly RuntimeItem[];
  /** The label of the `you` owner: the played persona's name. */
  playerName: string;
  /** The present entities with a block of their own, in roster order. */
  owners: readonly { id: string; name: string }[];
  location: { id: string; name: string } | null;
}

/** What the block reads of an item: an authored item, or a runtime item's name and description. */
type Named = Pick<Item, 'name' | 'aiSummary' | 'aiDescription' | 'uses'> & { runtimeDescription?: string };

/** Uses left as the block reads them, as the Inventory tab shows them (Q30). Null when there is nothing to say. */
function usesMark(item: Named, copy: ItemCopy): string | null {
  const left = usesLeft(copy, item);
  if (left === undefined || item.uses === undefined) return null;
  if (item.uses > 1) return `${left} of ${item.uses} uses left`;
  return left === 0 ? 'no uses left' : null;
}

/** The name an Item Copy goes by in the block: its State, uses left, quantity and hidden state after it. */
function copyName(item: Named, copy: ItemCopy): string {
  const state = copyState(copy);
  const uses = usesMark(item, copy);
  const marks = [
    ...(state ? [state] : []), ...(uses ? [uses] : []),
    ...(copy.quantity > 1 ? [`×${copy.quantity}`] : []), ...(copy.visibility === 'hidden' ? ['hidden'] : []),
  ];
  return marks.length ? `${item.name} (${marks.join(', ')})` : item.name;
}

/**
 * The `<INVENTORY>` chip's value: each present owner's equipped items with their AI Summary (the AI
 * Description where there is none) and carried items by name, then the Item Copies lying at the location,
 * hidden ones marked. A runtime item goes by its name; one with a description gets a line of its own (Q145).
 * N/A when nobody present has an item.
 */
export function buildInventoryContext(scene: InventoryScene, format: ContextFormat): string {
  const items = new Map(scene.items.map((item) => [item.id, item]));
  const runtime = new Map((scene.runtimeItems ?? []).map((item) => [item.id, { name: item.name, runtimeDescription: item.description?.trim() }]));
  const named = (where: ItemCopyWhere) => copiesAt(scene.copies, where).flatMap((copy) => {
    const item: Named | undefined = copy.item.kind === 'item' ? items.get(copy.item.itemId) : runtime.get(copy.item.runtimeItemId);
    return item ? [{ item, copy }] : [];
  });
  const md = format === 'markdown';
  const xml = format === 'xml';
  const field = (key: string, value: string) => {
    const tag = key.replace(/ /g, '_');
    return xml ? `  <${tag}>${xmlEscape(value)}</${tag}>\n` : md ? `  - **${key}:** ${value}\n` : `  ${key}: ${value}\n`;
  };
  const block = (tag: string, name: string, fields: string) => (
    xml ? `<${tag}>\n${field('name', name)}${fields}</${tag}>\n`
    : md ? `- **${name}**\n${fields}`
    : `${name}\n${fields}`
  );
  type Held = { item: Named; copy: ItemCopy };
  /** One comma line of names, then a line for each described runtime item. */
  const listed = (key: string, held: readonly Held[]) => {
    const plain = held.filter(({ item }) => !item.runtimeDescription).map(({ item, copy }) => copyName(item, copy));
    const described = held.filter(({ item }) => item.runtimeDescription)
      .map(({ item, copy }) => field(key, `${copyName(item, copy)}: ${item.runtimeDescription}`));
    return (plain.length ? field(key, plain.join(', ')) : '') + described.join('');
  };
  const ownerBlock = (name: string, where: ItemCopyWhere) => {
    const held = named(where);
    if (!held.length) return '';
    const equipped = held.filter(({ copy }) => copy.equipped).map(({ item, copy }) => {
      const text = (item.aiSummary?.trim() || item.aiDescription?.trim()) ?? '';
      return field('equipped', text ? `${copyName(item, copy)}: ${text}` : copyName(item, copy));
    });
    return block('owner', name, equipped.join('') + listed('carried', held.filter(({ copy }) => !copy.equipped)));
  };
  const here = scene.location && named({ kind: 'location', id: scene.location.id });
  const out = [
    ownerBlock(scene.playerName, { kind: 'you' }),
    ...scene.owners.map((owner) => ownerBlock(owner.name, { kind: 'entity', id: owner.id })),
    scene.location && here?.length ? block('location', scene.location.name, listed('lying here', here)) : '',
  ].join('');
  return out || NONE_PLACEHOLDER;
}
