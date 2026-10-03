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
  reasoning: {
    label: 'Reasoning',
    hint: 'Lets your AI reason before it answers. Answers take longer.',
    info: '**Global** follows the **Native Reasoning** row under Settings → Output, its switch included. **Model Default** sends no hint. Only applies to models with native reasoning.',
  },
  answerReveal: { label: 'Answer Reveal', hint: 'Sets how each answer appears as it streams' },
  keyword: { label: 'Keyword Search', hint: 'Finds guide sections that share words with your question' },
  aiPicks: { label: 'AI Picks', hint: 'Lets your AI pick guide sections. Costs one more request per question.' },
  semantic: { label: 'Semantic Search', hint: 'Finds guide sections by meaning. Downloads a small model once.' },
  openScreen: { label: 'Use the Open Screen', hint: 'Sends the screen you have open and its guide section' },
  historyLength: { label: 'History Length', hint: 'Sets how many earlier questions and answers each request holds' },
} as const;

/** The copy of the Endpoint tab. */
export const ENDPOINT_COPY = {
  answer: { label: 'Answer Endpoint', description: 'Sends your questions to this endpoint for answers' },
  pick: { label: 'Pick Endpoint', description: 'Sends the "AI Picks" request here. A small, fast model works well.' },
  followsActive: 'Follows the endpoint picked on the **AI Endpoints** tab of Settings. Switch endpoints there and this follows.',
  sameAsAnswer: 'Goes to the **Answer Endpoint**, and follows it when you change it',
  presetHint: 'Picks the preset to edit. The game uses the same presets.',
} as const;

/** The copy of the Prompts tab. */
export const PROMPTS_COPY = {
  preset: { label: 'Preset', hint: 'Picks the preset that help questions use. Default updates with each release.' },
  prompts: {
    answer: { label: 'Answer', hint: 'Tells your AI how to answer from the guide sections' },
    pick: { label: 'Picks', hint: 'Tells your AI how to pick guide sections from the heading list' },
    lookup: { label: 'Lookup', hint: 'Tells your AI how to answer with the lookup function' },
  },
  options: {
    title: 'Options',
    hint: 'Sets how this preset runs the answer request. The Picks request keeps its own values.',
    temperature: { label: 'Custom Temperature', hint: 'Sets how freely the answer words its steps' },
    repetitionPenalty: { label: 'Custom Repetition Penalty', hint: 'Sets how hard the answer avoids repeated words' },
  },
  readOnly: (name: string) => `${name} is read-only`,
  reset: { label: 'Reset to Default', hint: 'Returns this prompt to the text of this release' },
} as const;

export const COMPARE_COPY = {
  action: { label: 'Compare to Default', hint: 'Shows how this prompt differs from the text of this release', same: 'This prompt matches the default text' },
  title: (label: string) => `${label} Prompt vs. Default`,
  legend: { lead: 'Text you', mid: 'to the default is tinted. Text you', tail: 'from it is struck through.' },
} as const;
