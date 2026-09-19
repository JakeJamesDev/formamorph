/** The World Editor dictionary book panel's own tabs, in order. Single source of truth:
 *  `DictionaryBookManager`'s `PanelTabsList` renders from this, and the dev-router ledger
 *  (`DEV_MODAL_TABS.worldEditorBook`) is guarded against it in `devRouter.test.ts`. */
import { BookOpen, Braces } from 'lucide-react';

export const DICTIONARY_BOOK_PANEL_TABS = [
  { value: 'details', label: 'Details', icon: BookOpen },
  { value: 'placeholders', label: 'Placeholders', icon: Braces, advancedOnly: true },
] as const;

export type DictionaryBookPanelTab = (typeof DICTIONARY_BOOK_PANEL_TABS)[number]['value'];

/** The tabs one editor mode shows. Simple drops the `advancedOnly` ones, which leaves it a single tab and
 *  so no strip at all. */
export function dictionaryBookPanelTabsFor(advanced: boolean) {
  return DICTIONARY_BOOK_PANEL_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}
