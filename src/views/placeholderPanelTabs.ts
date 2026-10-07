/** The placeholder panel's own tabs, in order. Single source of truth: `PlaceholderManager`'s `PanelTabs`
 *  renders from this, and the dev-router ledger (`DEV_MODAL_TABS.worldEditorPlaceholder`) is guarded against
 *  it in `devRouter.test.ts`. */
import { Pin } from 'lucide-react';

import { ELEMENT_ICONS } from '@/lib/elementIcons';

export const PLACEHOLDER_PANEL_TABS = [
  { value: 'details', label: 'Details', icon: ELEMENT_ICONS.placeholder },
  { value: 'pins', label: 'Pins', icon: Pin, advancedOnly: true },
] as const;

export type PlaceholderPanelTab = (typeof PLACEHOLDER_PANEL_TABS)[number]['value'];

/** The tabs one panel shows. Pins needs Advanced mode and a world to gather pins from, so Simple mode and the
 *  library's editors keep one tab and no strip. */
export function placeholderPanelTabsFor(advanced: boolean, hasWorld: boolean) {
  return PLACEHOLDER_PANEL_TABS.filter((t) => (advanced && hasWorld) || !('advancedOnly' in t && t.advancedOnly));
}
