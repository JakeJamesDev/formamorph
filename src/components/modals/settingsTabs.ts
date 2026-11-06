import { Database, MessageSquareText, Monitor, Plug, ScrollText, Wrench } from 'lucide-react';

/** The top-level Settings tabs, in order. Single source of truth: `SettingsModal`'s TabsList renders from
 *  this, and the dev-router coverage ledger (`DEV_MODAL_TABS.settings`) is guarded against it in
 *  `devRouter.test.ts` — so a tab added or renamed here without covering it there fails the test.
 *
 *  Tabs divide by *what a setting affects*, so a new setting's home is decidable without knowing where
 *  the code for it lives: what you see or hear, what the AI produces, what it connects to, and the
 *  housekeeping that touches stored data. */
export const SETTINGS_TABS = [
  { value: 'display', label: 'Display', icon: Monitor, group: 'play' },
  { value: 'output', label: 'Output', icon: ScrollText, group: 'play' },
  // Prompts sits next to Output because it is the same subject at a lower level: Output decides which
  // passes run, Prompts is the text each one sends.
  { value: 'prompts', label: 'Prompts', icon: MessageSquareText, group: 'ai', advancedOnly: true },
  // Tools belong to the same preset as the prompts that offer them.
  { value: 'tools', label: 'Tools', icon: Wrench, group: 'ai', advancedOnly: true },
  { value: 'endpoints', label: 'Endpoints', icon: Plug, group: 'ai' },
  { value: 'data', label: 'Data', icon: Database, group: 'data' },
] as const;

/** Every tab id, so a caller asking Settings to open somewhere is compile-checked against this list. */
export type SettingsTabId = (typeof SETTINGS_TABS)[number]['value'];

/** Narrows a hash-supplied tab name (the dev-router's `tab=…`) to a real tab, or nothing. A typo there
 *  should leave Settings on its default tab rather than blank the panel. */
export function asSettingsTab(value: string | undefined): SettingsTabId | undefined {
  return SETTINGS_TABS.some((t) => t.value === value) ? value as SettingsTabId : undefined;
}

/** The Endpoints tab's own tabs, in order. `route` is the dev-router `subtab=…` name and the surface id. */
export const SETTINGS_ENDPOINT_TABS = [
  { value: 'text-endpoint', route: 'text', label: 'Text' },
  { value: 'img-endpoint', route: 'image', label: 'Image' },
  { value: 'img-tagprompt', route: 'tagPrompt', label: 'Tag Prompt', advancedOnly: true, needsImageGen: true },
] as const;

export type SettingsEndpointTab = (typeof SETTINGS_ENDPOINT_TABS)[number]['value'];

/** Maps a dev-router `subtab=…` name to its Endpoints tab. */
export function endpointTabForRoute(route: string | undefined): SettingsEndpointTab | undefined {
  return SETTINGS_ENDPOINT_TABS.find((t) => t.route === route)?.value;
}

/** The Endpoints tabs one settings mode shows. Simple drops the `advancedOnly` ones; image generation off
 *  drops the `needsImageGen` ones. */
export function endpointTabsFor(advanced: boolean, imageGenOn: boolean) {
  return SETTINGS_ENDPOINT_TABS.filter((t) =>
    (advanced || !('advancedOnly' in t && t.advancedOnly)) && (imageGenOn || !('needsImageGen' in t && t.needsImageGen)));
}

/** The tabs one settings mode shows. Simple drops the `advancedOnly` ones. */
export function settingsTabsFor(advanced: boolean) {
  return SETTINGS_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}

/** The tabs one settings mode shows, split into the Sections bar's groups. */
export function settingsTabGroupsFor(advanced: boolean) {
  const tabs = settingsTabsFor(advanced);
  return (['play', 'ai', 'data'] as const).map((id) => ({ id, tabs: tabs.filter((t) => t.group === id) }));
}
