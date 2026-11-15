import type { BodySlot, SlotOwner } from './bodies';
import { balanceText, worthText, type Balance } from './currency';
import { instancesAt } from './inventory';
import { instanceFace, instanceState, isUnidentified, slotRuleMark, usesLeft } from './items';
import type { ContextFormat } from './statContext';
import { NONE_PLACEHOLDER } from './promptFallbacks';
import { xmlEscape } from './utils';
import type { Currency, Item, ItemInstance, ItemInstanceWhere, RuntimeItem, Slot } from '@/types';

/** What the inventory block reads: the authored items, every Item Instance, and who and where the scene is. */
export interface InventoryScene {
  items: readonly Item[];
  instances: readonly ItemInstance[];
  /** The runtime items the Inventory pass made. Absent ⇒ none. */
  runtimeItems?: readonly RuntimeItem[];
  /** The label of the `you` owner: the played persona's name. */
  playerName: string;
  /** The present entities with a block of their own, in roster order. */
  owners: readonly { id: string; name: string }[];
  location: { id: string; name: string } | null;
  /** Absent ⇒ the world has no Bodies, and the block names no slot. */
  equipment?: InventoryEquipment;
  /** What the items are priced in. Absent ⇒ none, and the block names no worth or balance. */
  currencies?: readonly Currency[];
  /** What each owner holds in a Currency. Absent ⇒ every owner is untracked. */
  balanceOf?: (currency: Currency, owner: SlotOwner) => Balance;
}

/** The world's slots and each owner's slots in force. */
export interface InventoryEquipment {
  slots: readonly Slot[];
  slotsOf: (owner: SlotOwner) => readonly BodySlot[];
}

/** What the block reads of an item: an authored item, or a runtime item's name and description. */
type Named = Pick<Item, 'name' | 'aiSummary' | 'aiDescription' | 'uses' | 'playerDescription' | 'unidentifiedName' | 'unidentifiedDescription' | 'slotRule' | 'value' | 'currencyId'>
  & { runtimeDescription?: string };

/** Uses left as the block reads them, as the Inventory tab shows them (Q30). Null when there is nothing to say. */
function usesMark(item: Named, instance: ItemInstance): string | null {
  const left = usesLeft(instance, item);
  if (left === undefined || item.uses === undefined) return null;
  if (item.uses > 1) return `${left} of ${item.uses} uses left`;
  return left === 0 ? 'no uses left' : null;
}

/** A slot with its count after it when above 1, as `Hand ×2`. */
const slotText = (name: string, count: number): string => (count > 1 ? `${name} ×${count}` : name);

/** The name an Item Instance goes by in the block (its unidentified face while unidentified): its slot mark, State,
 *  uses left, quantity, worth and hidden state after it. */
function instanceName(item: Named, instance: ItemInstance, slotMark: string, worth: string | null): string {
  const name = instanceFace(item, instance).name;
  const state = instanceState(instance);
  const uses = usesMark(item, instance);
  const marks = [
    ...(slotMark ? [slotMark] : []), ...(state ? [state] : []), ...(uses ? [uses] : []),
    ...(instance.quantity > 1 ? [`×${instance.quantity}`] : []), ...(worth ? [worth] : []), ...(instance.visibility === 'hidden' ? ['hidden'] : []),
  ];
  return marks.length ? `${name} (${marks.join(', ')})` : name;
}

/** The AI text of an item: its AI Summary, else its AI Description. */
const aiText = (item: Named): string => (item.aiSummary?.trim() || item.aiDescription?.trim()) ?? '';

/** An unidentified instance's line: the face the player sees, then the true face and worth marked unknown to the player (Q14, Q38). */
function unidentifiedLine(item: Named, instance: ItemInstance, slotMark: string, worth: string | null): string {
  const seen = instanceFace(item, instance).description?.trim();
  const truth = aiText(item);
  return `${instanceName(item, instance, slotMark, null)}${seen ? `: ${seen}` : ''} (unknown to the player: it is ${item.name}${worth ? `, ${worth}` : ''}${truth ? `: ${truth}` : ''})`;
}

/**
 * The `<INVENTORY>` chip's value: each present owner's equipped items with their AI Summary (the AI
 * Description where there is none) and carried items by name, then the Item Instances lying at the location,
 * hidden ones marked. A runtime item goes by its name; one with a description gets a line of its own (Q145), as
 * does an unidentified instance, with both faces. In a world with Bodies, each owner block opens with that owner's
 * slots and each equippable item names its Slot Rule (Q52, Q41); the player's block shows even when empty.
 * A priced item names its worth, each unit's on a stack, and each tracked owner's block names its balances.
 * N/A when nobody present has an item or a balance and the world has no Bodies.
 */
export function buildInventoryContext(scene: InventoryScene, format: ContextFormat): string {
  const items = new Map(scene.items.map((item) => [item.id, item]));
  const runtime = new Map((scene.runtimeItems ?? []).map((item) => [item.id, { name: item.name, runtimeDescription: item.description?.trim() }]));
  const named = (where: ItemInstanceWhere) => instancesAt(scene.instances, where).flatMap((instance) => {
    const item: Named | undefined = instance.item.kind === 'item' ? items.get(instance.item.itemId) : runtime.get(instance.item.runtimeItemId);
    return item ? [{ item, instance }] : [];
  });
  /** The item's Slot Rule; empty for an item with no slot or in a world with no Bodies. */
  const slotMark = (item: Named) => slotRuleMark(item.slotRule, scene.equipment?.slots ?? []);
  const currencies = scene.currencies ?? [];
  const worthMark = (item: Named, instance: ItemInstance) => {
    const worth = worthText(item, currencies, scene.items);
    return worth && `worth ${worth}${instance.quantity > 1 ? ' each' : ''}`;
  };
  const nameOf = (item: Named, instance: ItemInstance) => instanceName(item, instance, slotMark(item), worthMark(item, instance));
  const faceLine = (item: Named, instance: ItemInstance) => unidentifiedLine(item, instance, slotMark(item), worthMark(item, instance));
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
  type Held = { item: Named; instance: ItemInstance };
  /** One comma line of names, then a line for each described runtime item and each unidentified instance. */
  const listed = (key: string, held: readonly Held[]) => {
    const own = ({ item, instance }: Held) => !!item.runtimeDescription || isUnidentified(instance);
    const plain = held.filter((h) => !own(h)).map(({ item, instance }) => nameOf(item, instance));
    const described = held.filter(own).map(({ item, instance }) => field(key, isUnidentified(instance)
      ? faceLine(item, instance) : `${nameOf(item, instance)}: ${item.runtimeDescription}`));
    return (plain.length ? field(key, plain.join(', ')) : '') + described.join('');
  };
  const ownerBlock = (name: string, where: SlotOwner) => {
    const held = named(where);
    const balances = currencies.flatMap((currency) => {
      const balance = scene.balanceOf?.(currency, where);
      return balance?.tracked ? [field('balance', balanceText(balance.amount, currency, scene.items))] : [];
    });
    if (!held.length && !balances.length && !(where.kind === 'you' && scene.equipment)) return '';
    const own = scene.equipment?.slotsOf(where);
    // The owner's slots in force, or `none`; nothing in a world with no Bodies.
    const slotsLine = own ? field('slots', own.length ? own.map((s) => slotText(s.slot.name, s.capacity)).join(', ') : 'none') : '';
    const equipped = held.filter(({ instance }) => instance.equipped).map(({ item, instance }) => {
      if (isUnidentified(instance)) return field('equipped', faceLine(item, instance));
      const text = aiText(item);
      return field('equipped', text ? `${nameOf(item, instance)}: ${text}` : nameOf(item, instance));
    });
    return block('owner', name, slotsLine + balances.join('') + equipped.join('') + listed('carried', held.filter(({ instance }) => !instance.equipped)));
  };
  const here = scene.location && named({ kind: 'location', id: scene.location.id });
  const out = [
    ownerBlock(scene.playerName, { kind: 'you' }),
    ...scene.owners.map((owner) => ownerBlock(owner.name, { kind: 'entity', id: owner.id })),
    scene.location && here?.length ? block('location', scene.location.name, listed('lying here', here)) : '',
  ].join('');
  return out || NONE_PLACEHOLDER;
}
