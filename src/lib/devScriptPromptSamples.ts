import type { ScriptPromptRequest } from './scriptPrompts';

/** DEV-only: one `player.*` request per prompt shape, fired by `#dev?view=gameViewer&modal=scriptPrompt&tab=<key>`. */
export const SCRIPT_PROMPT_SAMPLES = {
  confirm: { kind: 'confirm', question: 'Light the lamp before you go in?' },
  ask: { kind: 'ask', question: 'Which door do you open?', options: ['The red door', 'The blue door', 'Neither'], multiple: false },
  askLong: {
    kind: 'ask', question: 'Where does the ferry take you?',
    options: ['Sedge Landing', 'The Salt Flats', 'Old Harbor', 'Gull Rock', 'The Narrows', 'Lantern Isle'], multiple: false,
  },
  askMulti: { kind: 'ask', question: 'What do you pack?', options: ['Rope', 'Lamp oil', 'Bread', 'A map', 'Coins'], multiple: true },
  input: { kind: 'input', question: 'What name do you give the keeper?', placeholder: 'A name' },
  tell: { kind: 'tell', text: 'A bell rings three times somewhere below the harbor.' },
  toast: { kind: 'toast', text: 'The tide turns.' },
} as const satisfies Record<string, ScriptPromptRequest>;

export type ScriptPromptSampleKey = keyof typeof SCRIPT_PROMPT_SAMPLES;

export const SCRIPT_PROMPT_SAMPLE_KEYS = Object.keys(SCRIPT_PROMPT_SAMPLES) as ScriptPromptSampleKey[];

export const isScriptPromptSample = (key: string | undefined): key is ScriptPromptSampleKey =>
  !!key && key in SCRIPT_PROMPT_SAMPLES;
