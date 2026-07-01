import { HIGHLIGHT_PALETTE } from './highlightUtils';

/** An optional alternate form a variable's chip can be switched to via its pop-out. `id: null` is the
 *  default (full) form with no token suffix; a non-null id encodes as `<TOKEN|id>` (e.g. `|summary`). */
export interface PromptVariant {
  id: string | null;
  label: string;
  help?: string;
}

/** Registry of the angle-bracket variables that prompt templates can embed. The base `token`
 *  (brackets included) is what lives in the prompt string and what GameViewer substitutes at runtime;
 *  `label` is the friendly text shown on the chip; `color` is its accent (shared with the AI context
 *  viewer's palette); `variants` (when present) are the modes the chip pop-out offers. Adding a variable
 *  here makes it available to the chip toolbar and the parser. */
export interface PromptVariable {
  token: string; // exact base token, e.g. '<WORLD DESCRIPTION>'
  label: string; // friendly chip label, e.g. 'World'
  color: string; // chip/preview accent, from HIGHLIGHT_PALETTE
  variants?: PromptVariant[]; // pop-out modes; first entry is the default/full form
}

/** Every prompt editor maps to one of these kinds (mirrors the Settings → System Prompts sub-tabs). */
export type PromptKind = 'narration' | 'thinking' | 'choices' | 'statupdates' | 'location' | 'summary';

const SUMMARY_VARIANT: PromptVariant = {
  id: 'summary',
  label: 'Summary',
  help: 'Sends the short AI summary, falling back to the full description where none is set.',
};

const LOCATION_VARIANTS: PromptVariant[] = [
  { id: null, label: 'Full', help: 'The current location in full detail.' },
  SUMMARY_VARIANT,
  { id: 'list', label: 'List', help: 'A plain newline list of every location name.' },
];

const ENTITY_VARIANTS: PromptVariant[] = [
  { id: null, label: 'Full', help: 'Each available character or thing in full.' },
  SUMMARY_VARIANT,
];

// Each variable gets a fixed palette slot so its color is stable everywhere (chip + preview, every prompt).
const WORLD: PromptVariable = { token: '<WORLD DESCRIPTION>', label: 'World', color: HIGHLIGHT_PALETTE[0] };
const STATS: PromptVariable = { token: '<STATS DESCRIPTION>', label: 'Stats', color: HIGHLIGHT_PALETTE[1] };
const TRAITS: PromptVariable = { token: '<TRAITS DESCRIPTION>', label: 'Traits', color: HIGHLIGHT_PALETTE[2] };
const LOCATION: PromptVariable = { token: '<LOCATION>', label: 'Location', color: HIGHLIGHT_PALETTE[3], variants: LOCATION_VARIANTS };
const NOTES: PromptVariable = { token: '<NOTES>', label: 'Notes', color: HIGHLIGHT_PALETTE[4] };
const LENGTH: PromptVariable = { token: '<LENGTH GUIDANCE>', label: 'Length Guidance', color: HIGHLIGHT_PALETTE[5] };
const MARKDOWN: PromptVariable = { token: '<MARKDOWN GUIDANCE>', label: 'Markdown Guidance', color: HIGHLIGHT_PALETTE[6] };
const ENTITIES: PromptVariable = { token: '<ENTITIES>', label: 'Entities', color: HIGHLIGHT_PALETTE[8], variants: ENTITY_VARIANTS };

// Runtime value-tokens for the aux requests' user-message templates (the player's action + the turn's
// game text), distinct from the world/context tokens above.
const PLAYER_ACTION: PromptVariable = { token: '<PLAYER ACTION>', label: 'Player Action', color: HIGHLIGHT_PALETTE[9] };
const NARRATION: PromptVariable = { token: '<NARRATION>', label: 'Narration', color: HIGHLIGHT_PALETTE[10] };

/** All known variables — used by the parser to recognize any token regardless of which prompt it's in. */
export const ALL_PROMPT_VARIABLES: PromptVariable[] = [
  WORLD, STATS, TRAITS, LOCATION, ENTITIES, NOTES, LENGTH, MARKDOWN, PLAYER_ACTION, NARRATION,
];

/** Which variables each prompt's toolbar offers (matches what GameViewer actually substitutes per
 *  request type). The summary prompt takes no variables. */
export const PROMPT_KIND_VARIABLES: Record<PromptKind, PromptVariable[]> = {
  narration: [WORLD, STATS, TRAITS, LOCATION, ENTITIES, NOTES, LENGTH, MARKDOWN],
  thinking: [WORLD, STATS, TRAITS, LOCATION, ENTITIES, NOTES],
  choices: [WORLD, STATS, TRAITS, NOTES, LOCATION, ENTITIES],
  statupdates: [WORLD, STATS, TRAITS, NOTES],
  location: [WORLD, LOCATION, ENTITIES],
  summary: [],
};

/** Variables offered by the aux requests' editable user-message templates (the per-turn runtime values
 *  the code substitutes). Only the four aux kinds have a user template. */
export const PROMPT_KIND_USER_VARIABLES: Partial<Record<PromptKind, PromptVariable[]>> = {
  choices: [PLAYER_ACTION, NARRATION],
  statupdates: [PLAYER_ACTION, NARRATION],
  location: [PLAYER_ACTION, NARRATION],
  summary: [NARRATION],
};

const VAR_BY_BASE = new Map(ALL_PROMPT_VARIABLES.map((v) => [v.token, v]));

/** Every non-null variant id any variable supports — drives the parser's token regex. */
export const ALL_VARIANT_IDS: string[] = [
  ...new Set(ALL_PROMPT_VARIABLES.flatMap((v) => v.variants ?? []).flatMap((vr) => (vr.id ? [vr.id] : []))),
];

/** The base token (`<…>`) of a possibly-variant token, e.g. `<LOCATION|summary>` → `<LOCATION>`. */
export function baseToken(token: string): string {
  const pipe = token.indexOf('|');
  return pipe === -1 ? token : `${token.slice(0, pipe)}>`;
}

/** The variant id of a token (`<LOCATION|list>` → `'list'`), or null for the default/full form. */
export function tokenVariant(token: string): string | null {
  const match = token.match(/\|([^>]+)>$/);
  return match ? match[1] : null;
}

/** Re-apply a variant to a base token: `<LOCATION>`, `'list'` → `<LOCATION|list>` (null → base unchanged). */
export function withVariant(base: string, variantId: string | null): string {
  return variantId ? `${base.slice(0, -1)}|${variantId}>` : base;
}

/** The registry entry for a token (by its base), or undefined if unknown. */
export function variableForToken(token: string): PromptVariable | undefined {
  return VAR_BY_BASE.get(baseToken(token));
}

/** The chip label for a token, or the bare token (brackets stripped) if it's somehow unknown. */
export function labelForToken(token: string): string {
  return variableForToken(token)?.label ?? baseToken(token).replace(/^<|>$/g, '');
}

/** The label of a token's active variant (`<LOCATION|list>` → `'List'`), or null for the default/full form. */
export function variantLabelForToken(token: string): string | null {
  const id = tokenVariant(token);
  if (!id) return null;
  return variableForToken(token)?.variants?.find((vr) => vr.id === id)?.label ?? id;
}

/** The accent color for a token, or undefined for an unknown token. */
export function colorForToken(token: string): string | undefined {
  return variableForToken(token)?.color;
}
