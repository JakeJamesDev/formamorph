import catalog from '@/data/itemIcons.json';
import { isUnidentified } from '@/lib/items';
import type { Item, ItemCopy, Slot } from '@/types';

/** One icon of the catalog. `id` is ours, never the art's name. `body` is the SVG inside a 512 viewBox. */
export interface ItemIconEntry {
  id: string;
  group: string;
  author: string;
  words: string[];
  body: string;
}

/** The `Item.icon` value that turns the icon off. */
export const ITEM_ICON_NONE = 'none';

/** The icon a name and slot both fail to derive. */
export const GENERIC_ITEM_ICON = 'generic';

export const ITEM_ICONS: readonly ItemIconEntry[] = catalog;

/** The authors of the icons we ship, in alphabetical order. */
export const ITEM_ICON_AUTHORS: readonly string[] = [...new Set(ITEM_ICONS.map((icon) => icon.author))].sort((a, b) => a.localeCompare(b, 'en'));

const BY_ID = new Map(ITEM_ICONS.map((icon) => [icon.id, icon]));
const BY_WORD = new Map(ITEM_ICONS.flatMap((icon) => icon.words.map((word): [string, string] => [word, icon.id])));

const SLOT_WORDS = new Map(Object.entries({
  head: 'helmet', neck: 'necklace', chest: 'armor', torso: 'armor', waist: 'belt', leg: 'pants', foot: 'boots', feet: 'boots', hand: 'sword', hands: 'gloves', back: 'cloak', finger: 'ring', ring: 'ring',
}));

/** Words that name what holds the thing, so the words after "of" name the thing. */
const CONTAINERS = new Set(['pair', 'set', 'bundle', 'piece', 'slice', 'stack', 'handful', 'box', 'vial', 'phial', 'bottle', 'flask']);

const wordsIn = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').split(/[\s-]+/).filter(Boolean);

/** A word's entry in `map`, as written or without its plural s. */
const lookUp = (map: ReadonlyMap<string, string>, word: string) =>
  map.get(word) ?? (word.endsWith('s') ? map.get(word.slice(0, -1)) : undefined);

const lastMatch = (words: readonly string[]) => {
  for (let i = words.length - 1; i >= 0; i--) {
    const hit = lookUp(BY_WORD, words[i]);
    if (hit) return hit;
  }
  return undefined;
};

/** The icon a name means: the head noun's before of, from, with or for, else the tail's. A container reads its tail first. */
function iconFromName(name: string): string | undefined {
  const [head, ...rest] = name.split(/\s(?:of|from|with|for)\s/i);
  const headWords = wordsIn(head);
  const tailWords = wordsIn(rest.join(' '));
  return headWords.some((word) => CONTAINERS.has(word))
    ? lastMatch(tailWords) ?? lastMatch(headWords)
    : lastMatch(headWords) ?? lastMatch(tailWords);
}

function iconFromSlots(slotNames: readonly string[]): string | undefined {
  for (const slot of slotNames) {
    for (const word of wordsIn(slot)) {
      const hit = lookUp(SLOT_WORDS, word) ?? lookUp(BY_WORD, word);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Auto's icon: from the name, then the slots, then the generic icon. */
export const deriveItemIcon = (name: string, slotNames: readonly string[]): string =>
  iconFromName(name) ?? iconFromSlots(slotNames) ?? GENERIC_ITEM_ICON;

/** The names of an item's slots in its rule's order, read through `readText`. A slot gone from the world drops out. */
export const itemSlotNames = (item: Pick<Item, 'slotRule'> | undefined, slots: readonly Slot[], readText: (text: string) => string): string[] =>
  (item?.slotRule?.slotIds ?? []).flatMap((id) => {
    const slot = slots.find((s) => s.id === id);
    return slot ? [readText(slot.name)] : [];
  });

export const itemIconById = (id: string): ItemIconEntry | undefined => BY_ID.get(id);

/** The name an author reads for an icon: its first word in Title Case. */
export const itemIconName = ({ words: [word] }: ItemIconEntry): string => word.charAt(0).toUpperCase() + word.slice(1);

/** The icons with a word starting with each term of `search`, in catalog order. */
export function searchItemIcons(search: string): readonly ItemIconEntry[] {
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  return ITEM_ICONS.filter((icon) => terms.every((term) => icon.words.some((word) => word.startsWith(term))));
}

/** What an Item Copy shows on the doll and in rows. */
export type ShownItemIcon = { kind: 'icon'; id: string } | { kind: 'image'; src: string } | { kind: 'nothing' };

export interface ItemIconInput {
  /** `Item.icon`. Absent, or an id the catalog lacks, reads as Auto. */
  icon?: string;
  /** The name the player sees on this copy. */
  name: string;
  /** The names of the item's slots, in its rule's order. */
  slotNames: readonly string[];
  unidentified?: boolean;
  /** The Item image this copy would show. */
  image?: string;
}

/** Unidentified derives only. Otherwise a specific icon, then None's image or nothing, then Auto's derivation. */
export function resolveItemIcon({ icon, name, slotNames, unidentified, image }: ItemIconInput): ShownItemIcon {
  if (!unidentified && icon === ITEM_ICON_NONE) return image ? { kind: 'image', src: image } : { kind: 'nothing' };
  if (!unidentified && icon && BY_ID.has(icon)) return { kind: 'icon', id: icon };
  return { kind: 'icon', id: deriveItemIcon(name, slotNames) };
}

/** What one Item Copy shows on a play surface. `name` and `image` are what the player may see of the copy. */
export const copyItemIcon = (
  copy: Pick<ItemCopy, 'state'>,
  item: Pick<Item, 'icon' | 'slotRule'> | undefined,
  { name, slots, readText, image }: { name: string; slots: readonly Slot[]; readText: (text: string) => string; image?: string },
): ShownItemIcon => resolveItemIcon({
  icon: item?.icon,
  name,
  slotNames: itemSlotNames(item, slots, readText),
  unidentified: isUnidentified(copy),
  image,
});
