/** The find-focus path the tabbed detail panels share: which tab holds a hit, and whether a hit is this
 *  item's at all. Each panel keeps its own field-to-tab map and passes it in. */
import type { FocusFieldHint } from '@/types';

/**
 * The tab in `tabByField` that holds `fieldKey`, or `null` for a key no tab claims.
 *
 * Find reaches a field by its text, which a tab that isn't open never renders, so a hit has to open its own
 * tab first. Keys come from the search targets in `worldSearch`. A hit inside an array field arrives with
 * the element's index, since the hit is on one row or chip, and matches a bracket entry wherever the index
 * sits: `aliases[2]` finds `aliases[]`, and `descriptors[0].description` finds `descriptors[].description`.
 * Anything unlisted answers `null`, which leaves the panel on whichever tab the author was already on.
 */
export function tabForField<Tab extends string>(fieldKey: string, tabByField: Record<string, Tab>): Tab | null {
  const direct = tabByField[fieldKey];
  if (direct) return direct;
  const bracketed = fieldKey.replace(/\[\d+\]/g, '[]');
  return bracketed === fieldKey ? null : tabByField[bracketed] ?? null;
}

/**
 * The hint when it belongs to `itemId`, and `null` otherwise.
 *
 * A detail panel remounts per item, so a hit in another item is a stale hint by the time the panel sees it,
 * and the mount would open that hit's tab. Overview hits carry no item id and never match.
 */
export function focusFieldForItem(hint: FocusFieldHint | null, itemId: string): FocusFieldHint | null {
  return hint && hint.itemId === itemId ? hint : null;
}
