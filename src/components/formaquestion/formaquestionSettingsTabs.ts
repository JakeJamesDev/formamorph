import { MASCOT_BELOW_CAP } from '@/lib/formaquestion/windowBox';

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
  mascot: { label: 'Mascot', hint: 'Shows the Mascot with a bare chat column' },
  chatStyle: {
    label: 'Chat Style',
    hint: 'Sets how the window looks. Auto is Minimal with the Mascot on.',
    options: [
      { value: 'auto', label: 'Auto' },
      { value: 'minimal', label: 'Minimal' },
      { value: 'full', label: 'Full' },
    ],
  },
  mascotPosition: {
    label: 'Mascot Position',
    hint: 'Sets whether the Mascot stands beside or under the chat',
    info: '- **Beside** stands the Mascot next to the chat.\n'
      + `- **Below** stands it under the chat and caps the chat at ${Math.round(MASCOT_BELOW_CAP * 100)}% of the screen height.\n`
      + '- **Auto** stands it under a short chat and beside a tall one.',
    options: [
      { value: 'beside', label: 'Beside' },
      { value: 'below', label: 'Below' },
      { value: 'auto', label: 'Auto' },
    ],
  },
  scrimOpacity: {
    label: 'Backdrop',
    hint: 'Shades the screen behind the chat so the text stands out',
  },
  reasoning: {
    label: 'Reasoning',
    hint: 'Lets your AI reason before it answers. Answers take longer.',
    info: '**Global** follows the **Native Reasoning** row under Settings → Output, its switch included. **Model Default** sends no hint. Only applies to models with native reasoning.',
  },
  answerReveal: { label: 'Answer Reveal', hint: 'Sets how each answer appears as it streams' },
  keyword: { label: 'Keyword Search', hint: 'Matches the words in your question to guide sections' },
  aiPicks: { label: 'AI Search', hint: 'Asks your AI to choose the sections before answering. One extra request.' },
  semantic: { label: 'Semantic Search', hint: 'Finds sections by meaning, not exact words. Downloads a small model once.' },
  openScreen: { label: 'Use the Open Screen', hint: 'Sends the screen you have open and its guide section' },
  historyLength: { label: 'History Length', hint: 'Sets how many earlier questions and answers each request holds' },
} as const;

/** The copy of the Mascot tab. */
export const MASCOT_COPY = {
  title: 'Mascot',
  /** The status line of the off state. The link is the General tab's name, quoted like a control label. */
  off: { before: 'The Mascot is off. Enable it in “', link: 'General', after: '” to customize it.' },
  voice: { label: 'Voice', hint: 'Tells your AI how help answers sound while the mascot is on' },
  scale: { label: 'Scale', hint: "Sizes the Mascot beside the chat. Auto fits the chat's height." },
  preview: {
    label: 'Preview',
    hint: 'Shows the Idle look, or the layer or overlay you select',
    info: "Drag the Mask's edges, corners or middle to choose the head, or drag outside it to draw a new Mask. "
      + 'Press an arrow key to move a focused handle one pixel, or ten with Shift. **Head View** shows it as you drag.',
  },
  mask: {
    label: 'Mask',
    move: 'Move Mask',
    grips: {
      nw: 'Top-Left Corner', n: 'Top Edge', ne: 'Top-Right Corner', e: 'Right Edge',
      se: 'Bottom-Right Corner', s: 'Bottom Edge', sw: 'Bottom-Left Corner', w: 'Left Edge',
    },
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
  preset: {
    label: 'Preset',
    hint: 'Picks the mascot help shows. Default updates with each release.',
    readOnly: (name: string) => `${name} is read-only`,
    /** The header actions' tooltips, by action key. */
    tips: {
      duplicate: 'Make an editable copy of this mascot',
      rename: 'Rename this mascot',
      delete: 'Delete this mascot and its images',
      import: 'Add a mascot from a card',
      export: 'Save this mascot as a card',
      reset: 'Put this mascot back to the Default',
    },
    deleteTitle: 'Delete Mascot',
    deleteBody: (name: string) => `Delete the "${name}" mascot and its images? You can't undo it.`,
  },
  card: {
    importFailed: "Couldn't import that mascot card",
    exportFailed: "Couldn't export the mascot",
  },
  footer: {
    save: 'Save',
    cancel: 'Cancel',
    undo: { label: 'Undo', tip: 'Undo the last change (Ctrl+Z)' },
    redo: { label: 'Redo', tip: 'Redo the change you undid (Ctrl+Shift+Z)' },
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
  sources: { keyword: 'Keyword Search', aiPicks: 'AI Search', semantic: 'Semantic Search' },
} as const;

/** The copy of the Endpoint tab. */
export const ENDPOINT_COPY = {
  answer: { label: 'Answer Endpoint', description: 'Sends your questions to this endpoint for answers' },
  pick: { label: 'Search Endpoint', description: 'Runs the search request. A small, fast model is enough.' },
  followsActive: 'Follows the endpoint picked on the **AI Endpoints** tab of Settings. Switch endpoints there and this follows.',
  sameAsAnswer: 'Goes to the **Answer Endpoint**, and follows it when you change it',
  presetHint: 'Edits the preset Answer uses. The game uses the same presets.',
} as const;

/** The copy of the Prompts tab. */
export const PROMPTS_COPY = {
  preset: { label: 'Preset', hint: 'Picks the preset that help questions use. Default updates with each release.' },
  prompts: {
    answer: { label: 'Answer', hint: 'Tells your AI how to answer from the guide sections' },
    pick: { label: 'Search', hint: 'Tells your AI how to choose guide sections from the heading list' },
    lookup: { label: 'Lookup', hint: 'Tells your AI how to answer with the lookup function' },
    code: { label: 'Code', hint: 'Tells your AI how to write stat code on questions about code' },
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
        hint: 'Sets how this preset runs the search request',
        temperature: 'Sets how freely your AI chooses guide sections',
        repetitionPenalty: 'Sets how hard the search reply avoids repeated words',
      },
      lookup: {
        hint: 'Sets how this preset runs the answer request with the lookup function',
        temperature: 'Sets how freely the answer words its steps',
        repetitionPenalty: 'Sets how hard the answer avoids repeated words',
      },
    },
  },
  readOnly: (name: string) => `${name} is read-only`,
} as const;

/** The copy of the Tools tab. */
export const TOOLS_COPY = {
  lookupSummary: 'Reads guide sections on function-calling endpoints. Roughly quadruples input tokens per question.',
  rollSummary: 'Rolls the dice you name, and returns each die and the total',
  unsupported: "Your Answer Endpoint won't receive these functions. Its model doesn't support them, or support isn't confirmed yet.",
  worldText: 'Sends text from the world you have open when a Tool is on',
} as const;
