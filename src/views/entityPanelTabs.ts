/** The entity tabs, in order, for both entity editors. `EntityManager`'s `PanelTabsList` and the library
 *  `EntityEditorModal` render from these, and the dev-router ledgers (`DEV_MODAL_TABS.worldEditorEntity`,
 *  `DEV_MODAL_TABS.entityEditor`, `DEV_MODAL_TABS.entityEditorEntity`) are guarded against them in
 *  `devRouter.test.ts`. */
import { AlignLeft, Braces, Play, SquareUser, User } from 'lucide-react';

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

/** The panel tab that the library entity editor puts on its top strip instead of the Entity sub-strip. */
const LIBRARY_TOP_TAB = 'placeholders' satisfies EntityPanelTab;

/** The library entity editor's sub-tabs, inside its Entity tab. It sits outside Simple and Advanced mode, so it
 *  shows every one. */
export const ENTITY_EDITOR_SUBTABS = ENTITY_PANEL_TABS.filter(
  (t): t is Exclude<(typeof ENTITY_PANEL_TABS)[number], { value: typeof LIBRARY_TOP_TAB }> => t.value !== LIBRARY_TOP_TAB,
);

export type EntityEditorSubTab = (typeof ENTITY_EDITOR_SUBTABS)[number]['value'];

/** The library entity editor's top tabs: Entity for the fields, then the panel's own Placeholders. */
export const ENTITY_EDITOR_TABS = [
  { value: 'entity', label: 'Entity', icon: SquareUser },
  ...ENTITY_PANEL_TABS.filter(
    (t): t is Extract<(typeof ENTITY_PANEL_TABS)[number], { value: typeof LIBRARY_TOP_TAB }> => t.value === LIBRARY_TOP_TAB,
  ),
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

/** Where the library entity editor shows `fieldKey`: always the Entity tab, on the sub-tab that holds it. */
export function entityEditorTabForField(fieldKey: string): { tab: 'entity'; subTab: EntityEditorSubTab } | null {
  const owning = entityTabForField(fieldKey);
  return owning && owning !== LIBRARY_TOP_TAB ? { tab: 'entity', subTab: owning } : null;
}
