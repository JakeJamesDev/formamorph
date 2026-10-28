import type { Item } from '@/types';

/** Every authored string on an item that can hold a chip, blank ones included. Chip scans, placement letters
 *  and priming all read this one list. */
export const itemTexts = (item: Item): (string | undefined)[] =>
  [item.name, item.playerDescription, item.aiDescription, item.aiSummary, item.imageTags];
