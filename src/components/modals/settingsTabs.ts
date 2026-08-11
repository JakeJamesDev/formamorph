/** The top-level Settings tabs, in order. Single source of truth: `SettingsModal`'s TabsList renders from
 *  this, and the dev-router coverage ledger (`DEV_MODAL_TABS.settings`) is guarded against it in
 *  `devRouter.test.ts` — so a tab added or renamed here without covering it there fails the test. */
export const SETTINGS_TABS = [
  { value: 'presentation', label: 'Presentation' },
  { value: 'generation', label: 'Generation' },
  { value: 'prompts', label: 'Prompts', advancedOnly: true },
  { value: 'endpoints', label: 'AI Endpoints' },
  { value: 'accessibility', label: 'Accessibility' },
] as const;

/** The tabs one settings mode shows. Simple drops the `advancedOnly` ones. */
export function settingsTabsFor(advanced: boolean) {
  return SETTINGS_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}
