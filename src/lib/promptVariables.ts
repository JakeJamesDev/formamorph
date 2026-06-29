import { HIGHLIGHT_PALETTE } from './highlightUtils';

/** Registry of the angle-bracket variables that prompt templates can embed. The stored `token`
 *  (brackets included) is what lives in the prompt string and what GameViewer substitutes at runtime;
 *  `label` is the friendly text shown on the chip; `color` is its accent (shared with the AI context
 *  viewer's palette). Adding a variable here makes it available to the chip toolbar and the parser. */
export interface PromptVariable {
  token: string; // exact stored token, e.g. '<WORLD DESCRIPTION>'
  label: string; // friendly chip label, e.g. 'World'
  color: string; // chip/preview accent, from HIGHLIGHT_PALETTE
}

/** Every prompt editor maps to one of these kinds (mirrors the Settings → System Prompts sub-tabs). */
export type PromptKind = 'gametext' | 'thinking' | 'choices' | 'statupdates' | 'location' | 'summary';

// Each variable gets a fixed palette slot so its color is stable everywhere (chip + preview, every prompt).
const WORLD: PromptVariable = { token: '<WORLD DESCRIPTION>', label: 'World', color: HIGHLIGHT_PALETTE[0] };
const STATS: PromptVariable = { token: '<STATS DESCRIPTION>', label: 'Stats', color: HIGHLIGHT_PALETTE[1] };
const TRAITS: PromptVariable = { token: '<TRAITS DESCRIPTION>', label: 'Traits', color: HIGHLIGHT_PALETTE[2] };
const LOCATION: PromptVariable = { token: '<LOCATION JSON DATA>', label: 'Location', color: HIGHLIGHT_PALETTE[3] };
const NOTES: PromptVariable = { token: '<NOTES>', label: 'Notes', color: HIGHLIGHT_PALETTE[4] };
const LENGTH: PromptVariable = { token: '<LENGTH GUIDANCE>', label: 'Length Guidance', color: HIGHLIGHT_PALETTE[5] };
const MARKDOWN: PromptVariable = { token: '<MARKDOWN GUIDANCE>', label: 'Markdown Guidance', color: HIGHLIGHT_PALETTE[6] };
const LOCATION_LIST: PromptVariable = { token: '<LOCATION LIST>', label: 'Location List', color: HIGHLIGHT_PALETTE[7] };

/** All known variables — used by the parser to recognize any token regardless of which prompt it's in. */
export const ALL_PROMPT_VARIABLES: PromptVariable[] = [
  WORLD, STATS, TRAITS, LOCATION, NOTES, LENGTH, MARKDOWN, LOCATION_LIST,
];

/** Which variables each prompt's toolbar offers (matches what GameViewer actually substitutes per
 *  request type). The summary prompt takes no variables. */
export const PROMPT_KIND_VARIABLES: Record<PromptKind, PromptVariable[]> = {
  gametext: [WORLD, STATS, TRAITS, LOCATION, NOTES, LENGTH, MARKDOWN],
  thinking: [WORLD, STATS, TRAITS, LOCATION, NOTES],
  choices: [WORLD, STATS, TRAITS, NOTES, LOCATION],
  statupdates: [WORLD, STATS, TRAITS, NOTES],
  location: [WORLD, LOCATION, LOCATION_LIST],
  summary: [],
};

const LABEL_BY_TOKEN = new Map(ALL_PROMPT_VARIABLES.map((v) => [v.token, v.label]));
const COLOR_BY_TOKEN = new Map(ALL_PROMPT_VARIABLES.map((v) => [v.token, v.color]));

/** The chip label for a token, or the bare token (brackets stripped) if it's somehow unknown. */
export function labelForToken(token: string): string {
  return LABEL_BY_TOKEN.get(token) ?? token.replace(/^<|>$/g, '');
}

/** The accent color for a token, or undefined for an unknown token. */
export function colorForToken(token: string): string | undefined {
  return COLOR_BY_TOKEN.get(token);
}
