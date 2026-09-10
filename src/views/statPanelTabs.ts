/** The stat detail panel's own tabs, in order. Single source of truth: `StatManager`'s `PanelTabsList`
 *  renders from this, and the dev-router ledger (`DEV_MODAL_TABS.worldEditorStat`) is guarded against it in
 *  `devRouter.test.ts`. */
import { Code, Gauge, ListOrdered } from 'lucide-react';

import { tabForField } from './findFocus';

export const STAT_PANEL_TABS = [
  { value: 'details', label: 'Details', icon: Gauge },
  { value: 'descriptors', label: 'Descriptors', icon: ListOrdered, advancedOnly: true },
  { value: 'code', label: 'Code', icon: Code, advancedOnly: true },
] as const;

export type StatPanelTab = (typeof STAT_PANEL_TABS)[number]['value'];

/** The tabs one editor mode shows. Simple drops the `advancedOnly` ones, which leaves it a single tab and
 *  so no strip at all. */
export function statPanelTabsFor(advanced: boolean) {
  return STAT_PANEL_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}

/** Which tab holds each searchable field. A descriptor hit arrives with its row's index, since the hit is on
 *  one band, so it is listed in the bracket form `tabForField` matches those against. */
const TAB_BY_FIELD: Record<string, StatPanelTab> = {
  name: 'details',
  description: 'details',
  'descriptors[].description': 'descriptors',
};

/** The tab holding `fieldKey`, or `null` for a key no tab claims. */
export function statTabForField(fieldKey: string): StatPanelTab | null {
  return tabForField(fieldKey, TAB_BY_FIELD);
}
