/** The entity detail panel's own tabs, in order. Single source of truth: `EntityManager`'s TabsList renders
 *  from this, and the dev-router ledger (`DEV_MODAL_TABS.worldEditorEntity`) is guarded against it in
 *  `devRouter.test.ts`. */
import { AlignLeft, Braces, User } from 'lucide-react';

export const ENTITY_PANEL_TABS = [
  { value: 'profile', label: 'Profile', icon: User },
  { value: 'descriptions', label: 'Descriptions', icon: AlignLeft },
  { value: 'placeholders', label: 'Placeholders', icon: Braces, advancedOnly: true },
] as const;

export type EntityPanelTab = (typeof ENTITY_PANEL_TABS)[number]['value'];

/** The tabs one editor mode shows. Simple drops the `advancedOnly` ones, as the editor's own strip does. */
export function entityPanelTabsFor(advanced: boolean) {
  return ENTITY_PANEL_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}
