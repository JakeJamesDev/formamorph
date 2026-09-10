/** The dictionary entry panel's own tabs, in order. Single source of truth: `DictionaryManager`'s
 *  `PanelTabsList` renders from this, and the dev-router ledger (`DEV_MODAL_TABS.worldEditorEntry`) is
 *  guarded against it in `devRouter.test.ts`. */
import { BookOpen, Filter } from 'lucide-react';

import { tabForField } from './findFocus';

export const DICTIONARY_PANEL_TABS = [
  { value: 'details', label: 'Details', icon: BookOpen },
  { value: 'matching', label: 'Matching', icon: Filter, advancedOnly: true },
] as const;

export type DictionaryPanelTab = (typeof DICTIONARY_PANEL_TABS)[number]['value'];

/** The tabs one editor mode shows. Simple drops the `advancedOnly` ones, which leaves it a single tab and
 *  so no strip at all. */
export function dictionaryPanelTabsFor(advanced: boolean) {
  return DICTIONARY_PANEL_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}

/** Which tab holds each searchable field. A keyword hit arrives with its chip's index, since the hit is on
 *  one chip, so it is listed in the bracket form `tabForField` matches those against. */
const TAB_BY_FIELD: Record<string, DictionaryPanelTab> = {
  name: 'details',
  'key[]': 'details',
  value: 'details',
  'secondaryKeys[]': 'matching',
};

/** The tab holding `fieldKey`, or `null` for a key no tab claims. */
export function dictionaryTabForField(fieldKey: string): DictionaryPanelTab | null {
  return tabForField(fieldKey, TAB_BY_FIELD);
}
