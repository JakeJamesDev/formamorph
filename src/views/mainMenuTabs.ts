/**
 * The library's card-type tabs, in render order. Split out of `MainMenu` so the dev-router's coverage ledger
 * and its drift guard can import them without pulling in the view — the same split as `worldEditorTabs` and
 * `settingsTabs`.
 */
export const MAIN_MENU_CARD_TABS = ['worlds', 'entities', 'dictionaries', 'models'] as const;

/** Which library grid the main menu is showing. */
export type MainMenuCardTab = (typeof MAIN_MENU_CARD_TABS)[number];
