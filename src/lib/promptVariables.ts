import { HIGHLIGHT_PALETTE } from './highlightUtils';

/** Registry of the angle-bracket variables that prompt templates can embed. The base `token`
 *  (brackets included) is what lives in the prompt string and what GameViewer substitutes at runtime;
 *  `label` is the friendly text shown on the chip; `color` is its accent (shared with the AI context
 *  viewer's palette); `hasSummary` marks variables that offer a short summary form (`<…|summary>`).
 *  Adding a variable here makes it available to the chip toolbar and the parser. */
export interface PromptVariable {
  token: string; // exact base token, e.g. '<WORLD DESCRIPTION>'
  label: string; // friendly chip label, e.g. 'World'
  color: string; // chip/preview accent, from HIGHLIGHT_PALETTE
  hasSummary: boolean; // true → the chip can toggle between full description and a short summary
}

/** Every prompt editor maps to one of these kinds (mirrors the Settings → System Prompts sub-tabs). */
export type PromptKind = 'gametext' | 'thinking' | 'choices' | 'statupdates' | 'location' | 'summary';

/** Suffix marking the summary variant of a token: `<LOCATION|summary>`. */
export const SUMMARY_SUFFIX = '|summary';

// Each variable gets a fixed palette slot so its color is stable everywhere (chip + preview, every prompt).
const WORLD: PromptVariable = { token: '<WORLD DESCRIPTION>', label: 'World', color: HIGHLIGHT_PALETTE[0], hasSummary: false };
const STATS: PromptVariable = { token: '<STATS DESCRIPTION>', label: 'Stats', color: HIGHLIGHT_PALETTE[1], hasSummary: false };
const TRAITS: PromptVariable = { token: '<TRAITS DESCRIPTION>', label: 'Traits', color: HIGHLIGHT_PALETTE[2], hasSummary: false };
const LOCATION: PromptVariable = { token: '<LOCATION>', label: 'Location', color: HIGHLIGHT_PALETTE[3], hasSummary: true };
const NOTES: PromptVariable = { token: '<NOTES>', label: 'Notes', color: HIGHLIGHT_PALETTE[4], hasSummary: false };
const LENGTH: PromptVariable = { token: '<LENGTH GUIDANCE>', label: 'Length Guidance', color: HIGHLIGHT_PALETTE[5], hasSummary: false };
const MARKDOWN: PromptVariable = { token: '<MARKDOWN GUIDANCE>', label: 'Markdown Guidance', color: HIGHLIGHT_PALETTE[6], hasSummary: false };
const LOCATION_LIST: PromptVariable = { token: '<LOCATION LIST>', label: 'Location List', color: HIGHLIGHT_PALETTE[7], hasSummary: false };
const ENTITIES: PromptVariable = { token: '<ENTITIES>', label: 'Entities', color: HIGHLIGHT_PALETTE[8], hasSummary: true };

/** All known variables — used by the parser to recognize any token regardless of which prompt it's in. */
export const ALL_PROMPT_VARIABLES: PromptVariable[] = [
  WORLD, STATS, TRAITS, LOCATION, ENTITIES, NOTES, LENGTH, MARKDOWN, LOCATION_LIST,
];

/** Which variables each prompt's toolbar offers (matches what GameViewer actually substitutes per
 *  request type). The summary prompt takes no variables. */
export const PROMPT_KIND_VARIABLES: Record<PromptKind, PromptVariable[]> = {
  gametext: [WORLD, STATS, TRAITS, LOCATION, ENTITIES, NOTES, LENGTH, MARKDOWN],
  thinking: [WORLD, STATS, TRAITS, LOCATION, ENTITIES, NOTES],
  choices: [WORLD, STATS, TRAITS, NOTES, LOCATION, ENTITIES],
  statupdates: [WORLD, STATS, TRAITS, NOTES],
  location: [WORLD, LOCATION, ENTITIES, LOCATION_LIST],
  summary: [],
};

const VAR_BY_BASE = new Map(ALL_PROMPT_VARIABLES.map((v) => [v.token, v]));

/** The base token (`<…>`) of a possibly-variant token, e.g. `<LOCATION|summary>` → `<LOCATION>`. */
export function baseToken(token: string): string {
  return isSummaryToken(token) ? token.slice(0, -(SUMMARY_SUFFIX.length + 1)) + '>' : token;
}

/** Whether a token is the summary variant. */
export function isSummaryToken(token: string): boolean {
  return token.endsWith(`${SUMMARY_SUFFIX}>`);
}

/** The summary variant of a base token: `<LOCATION>` → `<LOCATION|summary>`. */
export function summaryToken(base: string): string {
  return `${base.slice(0, -1)}${SUMMARY_SUFFIX}>`;
}

/** The registry entry for a token (by its base), or undefined if unknown. */
export function variableForToken(token: string): PromptVariable | undefined {
  return VAR_BY_BASE.get(baseToken(token));
}

/** The chip label for a token, or the bare token (brackets stripped) if it's somehow unknown. */
export function labelForToken(token: string): string {
  return variableForToken(token)?.label ?? baseToken(token).replace(/^<|>$/g, '');
}

/** The accent color for a token, or undefined for an unknown token. */
export function colorForToken(token: string): string | undefined {
  return variableForToken(token)?.color;
}
