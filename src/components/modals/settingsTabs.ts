/** The top-level Settings tabs, in order. Single source of truth: `SettingsModal`'s TabsList renders from
 *  this, and the dev-router coverage ledger (`DEV_MODAL_TABS.settings`) is guarded against it in
 *  `devRouter.test.ts` — so a tab added or renamed here without covering it there fails the test.
 *
 *  Tabs divide by *what a setting affects*, so a new setting's home is decidable without knowing where
 *  the code for it lives: what you see or hear, what the AI produces, what it connects to, and the
 *  housekeeping that touches stored data. */
export const SETTINGS_TABS = [
  { value: 'display', label: 'Display' },
  { value: 'output', label: 'Output' },
  { value: 'endpoints', label: 'Endpoints' },
  { value: 'prompts', label: 'Prompts', advancedOnly: true },
  { value: 'data', label: 'Data' },
] as const;

/** Every tab id, so a caller asking Settings to open somewhere is compile-checked against this list. */
export type SettingsTabId = (typeof SETTINGS_TABS)[number]['value'];

/** Narrows a hash-supplied tab name (the dev-router's `tab=…`) to a real tab, or nothing. A typo there
 *  should leave Settings on its default tab rather than blank the panel. */
export function asSettingsTab(value: string | undefined): SettingsTabId | undefined {
  return SETTINGS_TABS.some((t) => t.value === value) ? value as SettingsTabId : undefined;
}

/** The tabs one settings mode shows. Simple drops the `advancedOnly` ones. */
export function settingsTabsFor(advanced: boolean) {
  return SETTINGS_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}
