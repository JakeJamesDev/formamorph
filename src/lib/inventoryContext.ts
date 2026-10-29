import { copiesAt } from './inventory';
import type { ContextFormat } from './statContext';
import { NONE_PLACEHOLDER } from './promptFallbacks';
import { xmlEscape } from './utils';
import type { Item, ItemCopy, ItemCopyWhere } from '@/types';

/** What the inventory block reads: the authored items, every Item Copy, and who and where the scene is. */
export interface InventoryScene {
  items: readonly Item[];
  copies: readonly ItemCopy[];
  /** The label of the `you` owner: the played persona's name. */
  playerName: string;
  /** The present entities with a block of their own, in roster order. */
  owners: readonly { id: string; name: string }[];
  location: { id: string; name: string } | null;
}

/** The name an Item Copy goes by in the block, its quantity and hidden state after it. */
function copyName(item: Item, copy: ItemCopy): string {
  const marks = [...(copy.quantity > 1 ? [`×${copy.quantity}`] : []), ...(copy.visibility === 'hidden' ? ['hidden'] : [])];
  return marks.length ? `${item.name} (${marks.join(', ')})` : item.name;
}

/**
 * The `<INVENTORY>` chip's value: each present owner's equipped items with their AI Summary (the AI
 * Description where there is none) and carried items by name, then the Item Copies lying at the location,
 * hidden ones marked. Runtime items are left out. N/A when nobody present has an item.
 */
export function buildInventoryContext(scene: InventoryScene, format: ContextFormat): string {
  const items = new Map(scene.items.map((item) => [item.id, item]));
  const named = (where: ItemCopyWhere) => copiesAt(scene.copies, where).flatMap((copy) => {
    const item = copy.item.kind === 'item' && items.get(copy.item.itemId);
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
  const ownerBlock = (name: string, where: ItemCopyWhere) => {
    const held = named(where);
    if (!held.length) return '';
    const equipped = held.filter(({ copy }) => copy.equipped).map(({ item, copy }) => {
      const text = (item.aiSummary?.trim() || item.aiDescription?.trim()) ?? '';
      return field('equipped', text ? `${copyName(item, copy)}: ${text}` : copyName(item, copy));
    });
    const carried = held.filter(({ copy }) => !copy.equipped).map(({ item, copy }) => copyName(item, copy));
    return block('owner', name, equipped.join('') + (carried.length ? field('carried', carried.join(', ')) : ''));
  };
  const here = scene.location && named({ kind: 'location', id: scene.location.id });
  const out = [
    ownerBlock(scene.playerName, { kind: 'you' }),
    ...scene.owners.map((owner) => ownerBlock(owner.name, { kind: 'entity', id: owner.id })),
    scene.location && here?.length
      ? block('location', scene.location.name, field('lying here', here.map(({ item, copy }) => copyName(item, copy)).join(', ')))
      : '',
  ].join('');
  return out || NONE_PLACEHOLDER;
}
