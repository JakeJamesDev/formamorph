import type { BodySlot, SlotOwner } from './bodies';
import { copiesAt } from './inventory';
import { copyFace, copyState, isUnidentified, slotSizeOf, usesLeft } from './items';
import type { ContextFormat } from './statContext';
import { NONE_PLACEHOLDER } from './promptFallbacks';
import { xmlEscape } from './utils';
import type { Item, ItemCopy, ItemCopyWhere, RuntimeItem, Slot } from '@/types';

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
  /** Absent ⇒ the world has no Bodies, and the block names no slot. */
  equipment?: InventoryEquipment;
}

/** The world's slots and each owner's slots in force. */
export interface InventoryEquipment {
  slots: readonly Slot[];
  slotsOf: (owner: SlotOwner) => readonly BodySlot[];
}

/** What the block reads of an item: an authored item, or a runtime item's name and description. */
type Named = Pick<Item, 'name' | 'aiSummary' | 'aiDescription' | 'uses' | 'playerDescription' | 'unidentifiedName' | 'unidentifiedDescription' | 'slotId' | 'slotSize'>
  & { runtimeDescription?: string };

/** Uses left as the block reads them, as the Inventory tab shows them (Q30). Null when there is nothing to say. */
function usesMark(item: Named, copy: ItemCopy): string | null {
  const left = usesLeft(copy, item);
  if (left === undefined || item.uses === undefined) return null;
  if (item.uses > 1) return `${left} of ${item.uses} uses left`;
  return left === 0 ? 'no uses left' : null;
}

/** A slot with its count after it when above 1, as `Hand ×2`. */
const slotText = (name: string, count: number): string => (count > 1 ? `${name} ×${count}` : name);

/** The name an Item Copy goes by in the block (its unidentified face while unidentified): its slot mark, State,
 *  uses left, quantity and hidden state after it. */
function copyName(item: Named, copy: ItemCopy, slotMark: string): string {
  const name = copyFace(item, copy).name;
  const state = copyState(copy);
  const uses = usesMark(item, copy);
  const marks = [
    ...(slotMark ? [slotMark] : []), ...(state ? [state] : []), ...(uses ? [uses] : []),
    ...(copy.quantity > 1 ? [`×${copy.quantity}`] : []), ...(copy.visibility === 'hidden' ? ['hidden'] : []),
  ];
  return marks.length ? `${name} (${marks.join(', ')})` : name;
}

/** The AI text of an item: its AI Summary, else its AI Description. */
const aiText = (item: Named): string => (item.aiSummary?.trim() || item.aiDescription?.trim()) ?? '';

/** An unidentified copy's line: the face the player sees, then the true face marked unknown to the player (Q14, Q38). */
function unidentifiedLine(item: Named, copy: ItemCopy, slotMark: string): string {
  const seen = copyFace(item, copy).description?.trim();
  const truth = aiText(item);
  return `${copyName(item, copy, slotMark)}${seen ? `: ${seen}` : ''} (unknown to the player: it is ${item.name}${truth ? `: ${truth}` : ''})`;
}

/**
 * The `<INVENTORY>` chip's value: each present owner's equipped items with their AI Summary (the AI
 * Description where there is none) and carried items by name, then the Item Copies lying at the location,
 * hidden ones marked. A runtime item goes by its name; one with a description gets a line of its own (Q145), as
 * does an unidentified copy, with both faces. In a world with Bodies, each owner block opens with that owner's
 * slots and each equippable item names its slot (Q52, Q53); the player's block shows even when empty.
 * N/A when nobody present has an item and the world has no Bodies.
 */
export function buildInventoryContext(scene: InventoryScene, format: ContextFormat): string {
  const items = new Map(scene.items.map((item) => [item.id, item]));
  const runtime = new Map((scene.runtimeItems ?? []).map((item) => [item.id, { name: item.name, runtimeDescription: item.description?.trim() }]));
  const named = (where: ItemCopyWhere) => copiesAt(scene.copies, where).flatMap((copy) => {
    const item: Named | undefined = copy.item.kind === 'item' ? items.get(copy.item.itemId) : runtime.get(copy.item.runtimeItemId);
    return item ? [{ item, copy }] : [];
  });
  /** The item's slot with its Slot Size; empty for an item with none or in a world with no Bodies. */
  const slotMark = (item: Named) => {
    const slot = item.slotId ? scene.equipment?.slots.find((s) => s.id === item.slotId) : undefined;
    return slot ? slotText(slot.name, slotSizeOf(item)) : '';
  };
  const nameOf = (item: Named, copy: ItemCopy) => copyName(item, copy, slotMark(item));
  const faceLine = (item: Named, copy: ItemCopy) => unidentifiedLine(item, copy, slotMark(item));
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
  /** One comma line of names, then a line for each described runtime item and each unidentified copy. */
  const listed = (key: string, held: readonly Held[]) => {
    const own = ({ item, copy }: Held) => !!item.runtimeDescription || isUnidentified(copy);
    const plain = held.filter((h) => !own(h)).map(({ item, copy }) => nameOf(item, copy));
    const described = held.filter(own).map(({ item, copy }) => field(key, isUnidentified(copy)
      ? faceLine(item, copy) : `${nameOf(item, copy)}: ${item.runtimeDescription}`));
    return (plain.length ? field(key, plain.join(', ')) : '') + described.join('');
  };
  const ownerBlock = (name: string, where: SlotOwner) => {
    const held = named(where);
    if (!held.length && !(where.kind === 'you' && scene.equipment)) return '';
    const own = scene.equipment?.slotsOf(where);
    // The owner's slots in force, or `none`; nothing in a world with no Bodies.
    const slotsLine = own ? field('slots', own.length ? own.map((s) => slotText(s.slot.name, s.capacity)).join(', ') : 'none') : '';
    const equipped = held.filter(({ copy }) => copy.equipped).map(({ item, copy }) => {
      if (isUnidentified(copy)) return field('equipped', faceLine(item, copy));
      const text = aiText(item);
      return field('equipped', text ? `${nameOf(item, copy)}: ${text}` : nameOf(item, copy));
    });
    return block('owner', name, slotsLine + equipped.join('') + listed('carried', held.filter(({ copy }) => !copy.equipped)));
  };
  const here = scene.location && named({ kind: 'location', id: scene.location.id });
  const out = [
    ownerBlock(scene.playerName, { kind: 'you' }),
    ...scene.owners.map((owner) => ownerBlock(owner.name, { kind: 'entity', id: owner.id })),
    scene.location && here?.length ? block('location', scene.location.name, listed('lying here', here)) : '',
  ].join('');
  return out || NONE_PLACEHOLDER;
}
