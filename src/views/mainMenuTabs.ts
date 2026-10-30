import type { CollapsingToggleOption } from '@/components/ui/collapsing-toggle-group';
import { KIND_BY_CARD_TYPE, KIND_LABELS, KIND_TAB_ICONS } from '@/lib/catalogKinds';

/**
 * The library's card-type tabs, in render order. Split out of `MainMenu` so the dev-router's coverage ledger
 * and its drift guard can import them without pulling in the view — the same split as `worldEditorTabs` and
 * `settingsTabs`.
 */
export const MAIN_MENU_CARD_TABS = ['worlds', 'entities', 'dictionaries', 'models'] as const;

/** Which library grid the main menu is showing. */
export type MainMenuCardTab = (typeof MAIN_MENU_CARD_TABS)[number];

/** Each card-type tab's label and icon, from the catalog kinds so they match the browser's sections. */
export const MAIN_MENU_CARD_OPTIONS: readonly CollapsingToggleOption<MainMenuCardTab>[] = MAIN_MENU_CARD_TABS.map((value) => {
  const kind = KIND_BY_CARD_TYPE[value];
  return { value, label: KIND_LABELS[kind].many, icon: KIND_TAB_ICONS[kind] };
});
