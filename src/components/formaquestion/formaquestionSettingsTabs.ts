/** The tabs of Formaquestion Settings, in order. Guarded against the dev-router ledger by `devRouter.test.ts`. */
export const FORMAQUESTION_SETTINGS_TABS = [
  { value: 'general', label: 'General' },
  { value: 'endpoint', label: 'Endpoint' },
  { value: 'prompts', label: 'Prompts' },
  { value: 'tools', label: 'Tools' },
] as const;

export type FormaquestionSettingsTab = (typeof FORMAQUESTION_SETTINGS_TABS)[number]['value'];

/** Narrows a dev-router `tab=…` to a tab, or nothing. */
export function asFormaquestionSettingsTab(value: string | undefined): FormaquestionSettingsTab | undefined {
  return FORMAQUESTION_SETTINGS_TABS.find((tab) => tab.value === value)?.value;
}

/** The label and the description of each General row. */
export const GENERAL_COPY = {
  keyword: { label: 'Keyword Search', hint: 'Finds guide sections that share words with your question' },
  aiPicks: { label: 'AI Picks', hint: 'Lets your AI pick guide sections. Costs one more request per question.' },
  openScreen: { label: 'Use the Open Screen', hint: 'Sends the screen you have open and its guide section' },
  historyLength: { label: 'History Length', hint: 'Sets how many earlier questions and answers each request carries' },
} as const;
