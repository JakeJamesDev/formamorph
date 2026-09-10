/** The trait detail panel's own tabs, in order. Single source of truth: `TraitManager`'s `PanelTabsList`
 *  renders from this, and the dev-router ledger (`DEV_MODAL_TABS.worldEditorTrait`) is guarded against it in
 *  `devRouter.test.ts`. */
import { Activity, Pin, Tag } from 'lucide-react';

import { tabForField } from './findFocus';

export const TRAIT_PANEL_TABS = [
  { value: 'details', label: 'Details', icon: Tag },
  { value: 'stats', label: 'Stats', icon: Activity },
  { value: 'pins', label: 'Pins', icon: Pin, advancedOnly: true },
] as const;

export type TraitPanelTab = (typeof TRAIT_PANEL_TABS)[number]['value'];

/** The tabs one editor mode shows. Simple drops the `advancedOnly` ones, as the editor's own strip does. */
export function traitPanelTabsFor(advanced: boolean) {
  return TRAIT_PANEL_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}

/** Which tab holds each searchable field. A pin hit arrives with its row's index, since the hit is on one
 *  row, so it is listed in the bracket form `tabForField` matches those against. */
const TAB_BY_FIELD: Record<string, TraitPanelTab> = {
  name: 'details',
  playerDescription: 'details',
  aiDescription: 'details',
  'placeholderPins[].value': 'pins',
};

/** The tab holding `fieldKey`, or `null` for a key no tab claims. */
export function traitTabForField(fieldKey: string): TraitPanelTab | null {
  return tabForField(fieldKey, TAB_BY_FIELD);
}
