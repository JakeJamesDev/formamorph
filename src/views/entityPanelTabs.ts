/** The entity tabs, in order, for both entity editors. `EntityManager`'s `PanelTabsList` and the library
 *  `EntityEditorModal` render from these, and the dev-router ledgers (`DEV_MODAL_TABS.worldEditorEntity`,
 *  `DEV_MODAL_TABS.entityEditor`) are guarded against them in `devRouter.test.ts`. */
import { AlignLeft, Braces, Info, Play, User } from 'lucide-react';

import { isOpeningFieldKey } from '@/lib/openings';
import { tabForField } from './findFocus';

export const ENTITY_PANEL_TABS = [
  { value: 'profile', label: 'Profile', icon: User },
  { value: 'descriptions', label: 'Descriptions', icon: AlignLeft },
  { value: 'openings', label: 'Openings', icon: Play, advancedOnly: true },
  { value: 'placeholders', label: 'Placeholders', icon: Braces, advancedOnly: true },
] as const;

export type EntityPanelTab = (typeof ENTITY_PANEL_TABS)[number]['value'];

/** The tabs one editor mode shows. Simple drops the `advancedOnly` ones, as the editor's own strip does. */
export function entityPanelTabsFor(advanced: boolean) {
  return ENTITY_PANEL_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}

/** The library entity editor's tabs: Overview for publish information, then the panel's own. The library
 *  editor sits outside the Simple/Advanced mode, so it shows every tab. */
export const ENTITY_EDITOR_TABS = [
  { value: 'overview', label: 'Overview', icon: Info },
  ...ENTITY_PANEL_TABS,
] as const;

export type EntityEditorTab = (typeof ENTITY_EDITOR_TABS)[number]['value'];

/** Which tab holds each searchable field. An opening row's key names its id, so `entityTabForField` matches it
 *  apart. An alias arrives indexed, since the hit is on one chip, so it is
 *  listed in the bracket form `tabForField` matches those against. */
const TAB_BY_FIELD: Record<string, EntityPanelTab> = {
  name: 'profile',
  type: 'profile',
  imageTags: 'profile',
  'aliases[]': 'profile',
  pronouns: 'profile',
  playerDescription: 'descriptions',
  aiDescription: 'descriptions',
  aiSummary: 'descriptions',
};

/** The tab holding `fieldKey`, or `null` for a key no tab claims, such as a group's name. */
export function entityTabForField(fieldKey: string): EntityPanelTab | null {
  if (isOpeningFieldKey(fieldKey)) return 'openings';
  return tabForField(fieldKey, TAB_BY_FIELD);
}
