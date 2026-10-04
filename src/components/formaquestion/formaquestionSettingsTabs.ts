/** The tabs of Formaquestion Settings, in order. Guarded against the dev-router ledger by `devRouter.test.ts`. */
export const FORMAQUESTION_SETTINGS_TABS = [
  { value: 'general', label: 'General' },
  { value: 'endpoint', label: 'Endpoint' },
  { value: 'prompts', label: 'Prompts' },
  { value: 'tools', label: 'Tools' },
  { value: 'mascot', label: 'Mascot' },
] as const;

export type FormaquestionSettingsTab = (typeof FORMAQUESTION_SETTINGS_TABS)[number]['value'];

/** Narrows a dev-router `tab=…` to a tab, or nothing. */
export function asFormaquestionSettingsTab(value: string | undefined): FormaquestionSettingsTab | undefined {
  return FORMAQUESTION_SETTINGS_TABS.find((tab) => tab.value === value)?.value;
}

/** The label and the description of each General row. */
export const GENERAL_COPY = {
  chatStyle: {
    label: 'Chat Style',
    hint: 'Sets how the window looks. Auto is Minimal with the Mascot on.',
    options: [
      { value: 'auto', label: 'Auto' },
      { value: 'minimal', label: 'Minimal' },
      { value: 'full', label: 'Full' },
    ],
  },
  scrimOpacity: {
    label: 'Scrim Opacity',
    hint: 'Draws a panel behind a bare chat column. Set 0 for none.',
  },
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

/** The copy of the Mascot tab. */
export const MASCOT_COPY = {
  mascot: { label: 'Mascot', hint: 'Shows a character beside a bare chat column' },
  voice: { label: 'Voice', hint: 'Tells your AI how help answers sound while the mascot is on' },
  scale: { label: 'Scale', hint: "Sizes the Mascot beside the chat. Auto fits the chat's height." },
  preview: {
    label: 'Preview',
    hint: 'Shows the Idle look, or the layer or overlay you select',
    info: 'Drag a box on the mascot to choose the head. **Head View** shows it as you drag.',
  },
  idleShown: 'Idle Look',
  overlayShown: (layer: string, n: number) => `${layer} · Overlay ${n}`,
  showOverlay: (n: number) => `Show overlay ${n}`,
  showLayerOverlay: (layer: string, n: number) => `Show ${layer} overlay ${n}`,
  headView: 'Head View',
  base: { label: 'Base Image', hint: 'Draws under every layer. Remove yours to go back to the default.' },
  layers: { label: 'Layers', hint: 'Draws each enabled layer in list order. Drag a row to move it.' },
  addLayer: 'Add Layer',
  layerName: 'Name',
  kind: { expression: 'Expression', state: 'State' },
  overlays: 'Overlays',
  bundledOverlay: 'Default Image',
  storedOverlay: 'Your Image',
  removeLayer: 'Remove layer',
  removeOverlay: 'Remove overlay',
  reset: {
    label: 'Reset Mascot',
    confirmTitle: 'Reset the mascot?',
    confirmBody: "This restores the default mascot and deletes every image you added. You can't undo it.",
  },
  card: {
    hint: 'Saves or loads your mascot as one image. Reset restores the default.',
    import: 'Import',
    export: 'Export',
    confirmTitle: 'Replace your mascot?',
    confirmBody: "This replaces your mascot with the one in the card and deletes every image you added. You can't undo it.",
    importFailed: "Couldn't import that mascot card",
    exportFailed: "Couldn't export the mascot",
  },
  saveFailed: "Couldn't save that image. Try again.",
  picks: {
    initial: { label: 'Initial Look', hint: 'Shows the first time the mascot appears after the app starts' },
    idle: { label: 'Idle Look', hint: 'Shows with an answer when your AI picks no face' },
    thinking: { label: 'Thinking Look', hint: 'Shows while your AI works on an answer' },
  },
  noLayer: 'None',
  missingLayer: 'Missing Layer',
  pickWarning: "These looks name a layer that's off or gone, so it draws nothing. Pick another or turn the layer on:",
  transition: {
    mode: { label: 'Transition', hint: 'Moves the mascot each time its look changes' },
    modes: { none: 'None', dissolve: 'Dissolve', jelly: 'Jelly' },
    reducedMotion: "Swaps looks at once while your system's reduced-motion setting is on",
    jelly: {
      durationMs: { label: 'Duration', hint: 'Sets how long the bounce takes' },
      squash: { label: 'Squash', hint: 'Sets how far the mascot squashes before the new look' },
      overshoot: { label: 'Overshoot', hint: 'Sets how far the new look stretches past full height' },
      settle: { label: 'Settle Count', hint: 'Sets how many times the mascot bounces before it rests' },
    },
    dissolveDuration: { label: 'Duration', hint: 'Sets how long the new look takes to fade in' },
    play: { label: 'Play', hint: 'Switches the preview to the Thinking look, or back, with the transition' },
  },
} as const;

/** The copy of the AI Context dialog. */
export const AI_CONTEXT_COPY = {
  title: 'AI Context',
  export: "Download every question's trace as JSON",
  // Lower case after the first word, as the game view's AI Context writes them.
  collapseAll: 'Collapse all',
  expandAll: 'Expand all',
  empty: 'No question has reached your AI yet. Ask one, then reopen this.',
  bare: 'A bare question: no search ran, and the request holds the question alone.',
  search: 'Search',
  question: 'Question',
  query: 'Query',
  preset: 'Preset',
  sourcesOn: 'Sources on',
  none: 'none',
  noScreen: 'No open screen',
  lead: 'Lead',
  merged: 'Merged',
  sentList: 'Sent',
  noRanking: 'no ranking',
  sent: 'sent',
  route: 'Take Me There',
  customPrompt: { label: 'Custom Prompt', tip: 'Differs from the default text' },
  sources: { keyword: 'Keyword Search', aiPicks: 'AI Picks', semantic: 'Semantic Search' },
} as const;

/** The copy of the Endpoint tab. */
export const ENDPOINT_COPY = {
  answer: { label: 'Answer Endpoint', description: 'Sends your questions to this endpoint for answers' },
  pick: { label: 'Pick Endpoint', description: 'Sends the "AI Picks" request here. A small, fast model works well.' },
  followsActive: 'Follows the endpoint picked on the **AI Endpoints** tab of Settings. Switch endpoints there and this follows.',
  sameAsAnswer: 'Goes to the **Answer Endpoint**, and follows it when you change it',
  presetHint: 'Edits the preset Answer uses. The game uses the same presets.',
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
    temperature: 'Custom Temperature',
    repetitionPenalty: 'Custom Repetition Penalty',
    prompts: {
      answer: {
        hint: 'Sets how this preset runs the answer request',
        temperature: 'Sets how freely the answer words its steps',
        repetitionPenalty: 'Sets how hard the answer avoids repeated words',
      },
      pick: {
        hint: 'Sets how this preset runs the Picks request',
        temperature: 'Sets how freely your AI picks guide sections',
        repetitionPenalty: 'Sets how hard the pick reply avoids repeated words',
      },
      lookup: {
        hint: 'Sets how this preset runs the answer request with the lookup function',
        temperature: 'Sets how freely the answer words its steps',
        repetitionPenalty: 'Sets how hard the answer avoids repeated words',
      },
    },
  },
  readOnly: (name: string) => `${name} is read-only`,
  reset: { label: 'Reset to Default', hint: 'Returns this prompt to the text of this release' },
} as const;

/** The copy of the Tools tab. */
export const TOOLS_COPY = {
  lookupSummary: 'Searches the guide or reads sections by id, and returns their text',
  rollSummary: 'Rolls the dice you name, and returns each die and the total',
  unsupported: "Your Answer Endpoint won't receive these functions. Its model doesn't support them, or support isn't confirmed yet.",
  worldText: 'Sends text from the world you have open when a Tool is on',
} as const;

export const COMPARE_COPY = {
  action: { label: 'Compare to Default', hint: 'Shows how this prompt differs from the text of this release', same: 'This prompt matches the default text' },
  title: (label: string) => `${label} Prompt vs. Default`,
  legend: { lead: 'Text you', mid: 'to the default is tinted. Text you', tail: 'from it is struck through.' },
} as const;
