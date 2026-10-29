/** The item panel's tabs, in order. `ItemManager` renders from these, and the dev-router ledger
 *  (`DEV_MODAL_TABS.worldEditorItem`) is guarded against them in `devRouter.test.ts`. */
import { AlignLeft, ListChecks, SlidersHorizontal } from 'lucide-react';

import { ELEMENT_ICONS } from '@/lib/elementIcons';

export const ITEM_PANEL_TABS = [
  { value: 'profile', label: 'Profile', icon: ELEMENT_ICONS.item },
  { value: 'descriptions', label: 'Descriptions', icon: AlignLeft },
  { value: 'properties', label: 'Properties', icon: SlidersHorizontal },
  { value: 'effects', label: 'Effects', icon: ELEMENT_ICONS.stat },
  { value: 'requirements', label: 'Requirements', icon: ListChecks },
  { value: 'placeholders', label: 'Placeholders', icon: ELEMENT_ICONS.placeholder, advancedOnly: true },
] as const;

export type ItemPanelTab = (typeof ITEM_PANEL_TABS)[number]['value'];

/** The tabs one editor mode shows. Simple drops the `advancedOnly` ones. */
export function itemPanelTabsFor(advanced: boolean) {
  return ITEM_PANEL_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}
