import { HIGHLIGHT_PALETTE } from './highlightUtils';

/** An optional alternate form a variable's chip can be switched to via its pop-out. `id: null` is the
 *  default form with no token suffix; a non-null id contributes to the token suffix (e.g. `|summary`). */
export interface PromptVariant {
  id: string | null;
  label: string;
  help?: string;
}

/** One independent dimension of a variable's variants (e.g. Stats has a `content` axis and a `format`
 *  axis). Each axis renders as its own segmented control in the pop-out. A variable with a single axis can
 *  just use `variants`; multi-axis variables use `axes`. The token suffix is the non-null option ids of
 *  every axis joined by `.` in axis order (e.g. content `descriptions` + format `markdown` →
 *  `<STATS DESCRIPTION|descriptions.markdown>`). Option ids must be unique across a variable's axes. */
export interface PromptVariantAxis {
  id: string;
  label: string;
  options: PromptVariant[]; // first entry (id:null) is the default
  /** Render as an independent checkbox (on = its non-null option) rather than a single-select control. A
   *  variable's toggle axes form one "at least one must stay on" group in the editor. */
  toggle?: boolean;
  /** Help shown beside a toggle axis's checkbox. */
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
  variants?: PromptVariant[]; // single-axis pop-out modes; first entry is the default/full form
  axes?: PromptVariantAxis[]; // multi-axis pop-out (takes precedence over `variants`)
}

/** Every prompt editor maps to one of these kinds (mirrors the Settings → System Prompts sub-tabs). */
export type PromptKind = 'narration' | 'thinking' | 'choices' | 'statupdates' | 'location' | 'summary' | 'diary' | 'director' | 'character' | 'storyboard';

const SUMMARY_VARIANT: PromptVariant = {
  id: 'summary',
  label: 'Summary',
  help: 'Sends the short AI summary, falling back to the full description where none is set.',
};

// Location and entity context are each ONE chip with a `scope` axis (current/sub-locations/reachable/…), a
// shared content axis (Full/Summary), and the format axis. `scope: null` = the current location / here.
const LOCATION_SCOPE_AXIS: PromptVariantAxis = {
  id: 'scope',
  label: 'Scope',
  options: [
    { id: null, label: 'Current', help: 'The location the player is in right now.' },
    { id: 'sublocations', label: 'Sub-locations', help: "The current location's direct sub-locations." },
    { id: 'reachable', label: 'Reachable', help: 'Sibling locations reachable from here (same parent).' },
    { id: 'destinations', label: 'Destinations', help: 'Everywhere reachable from here — connections + sub-locations + reachable siblings.' },
  ],
};

const ENTITY_SCOPE_AXIS: PromptVariantAxis = {
  id: 'scope',
  label: 'Scope',
  options: [
    { id: null, label: 'Here', help: 'Characters and things at the current location.' },
    { id: 'sublocations', label: 'Sub-locations', help: 'Characters and things in the direct sub-locations.' },
    { id: 'reachable', label: 'Reachable', help: 'Characters and things in reachable sibling locations.' },
  ],
};

const CONTENT_AXIS: PromptVariantAxis = {
  id: 'content',
  label: 'Content',
  options: [
    { id: null, label: 'Full', help: 'Full detail for each item.' },
    SUMMARY_VARIANT,
  ],
};

// Shared "how the block is shaped" axis (mirrors the Default/Simple presets): Simple = plain text; Default =
// markdown. The labels-style preset strips this axis back to plain (see sectionStyle `stripChipFormat`).
const FORMAT_AXIS: PromptVariantAxis = {
  id: 'format',
  label: 'Format',
  options: [
    { id: null, label: 'Simple', help: 'Plain lines — no bullets or bold.' },
    { id: 'markdown', label: 'Markdown', help: 'Markdown: bullets with bold names.' },
  ],
};

// Stats content is three independent pieces (each a checkbox), plus the shared format axis. The stat's Name
// is always present; at least one piece must stay on (enforced in the editor). The old single-select ids
// `numbers` (Range) and `descriptions` (Descriptor) are kept, so existing tokens still render; `meaning` is new.
const STAT_VALUES_AXIS: PromptVariantAxis = {
  id: 'numbers', label: 'Range', toggle: true, help: 'e.g. "10/100".',
  options: [{ id: null, label: 'Range' }, { id: 'numbers', label: 'Range' }],
};
const STAT_STATUS_AXIS: PromptVariantAxis = {
  id: 'descriptions', label: 'Descriptor', toggle: true, help: 'e.g. "Critical".',
  options: [{ id: null, label: 'Descriptor' }, { id: 'descriptions', label: 'Descriptor' }],
};
const STAT_MEANING_AXIS: PromptVariantAxis = {
  id: 'meaning', label: 'Description', toggle: true, help: 'e.g. "Physical stamina."',
  options: [{ id: null, label: 'Description' }, { id: 'meaning', label: 'Description' }],
};

// Each variable gets a fixed palette slot so its color is stable everywhere (chip + preview, every prompt).
const WORLD: PromptVariable = { token: '<WORLD DESCRIPTION>', label: 'World', color: HIGHLIGHT_PALETTE[0] };
const STATS: PromptVariable = { token: '<STATS DESCRIPTION>', label: 'Stats', color: HIGHLIGHT_PALETTE[1], axes: [STAT_VALUES_AXIS, STAT_STATUS_AXIS, STAT_MEANING_AXIS, FORMAT_AXIS] };
const TRAITS: PromptVariable = { token: '<TRAITS DESCRIPTION>', label: 'Traits', color: HIGHLIGHT_PALETTE[2], axes: [FORMAT_AXIS] };
const LOCATION: PromptVariable = { token: '<LOCATION>', label: 'Location', color: HIGHLIGHT_PALETTE[3], axes: [LOCATION_SCOPE_AXIS, CONTENT_AXIS, FORMAT_AXIS] };
const NOTES: PromptVariable = { token: '<NOTES>', label: 'Notes', color: HIGHLIGHT_PALETTE[4] };
const LENGTH: PromptVariable = { token: '<LENGTH GUIDANCE>', label: 'Length Guidance', color: HIGHLIGHT_PALETTE[5] };
const MARKDOWN: PromptVariable = { token: '<MARKDOWN GUIDANCE>', label: 'Markdown Guidance', color: HIGHLIGHT_PALETTE[6] };
// Director prompt only: expands to the cast-size guidance derived from the Limit Active Characters setting.
const ACTIVE_CHARACTER: PromptVariable = { token: '<ACTIVE CHARACTER GUIDANCE>', label: 'Active Character Guidance', color: HIGHLIGHT_PALETTE[13] };
// Entities are one chip whose `scope` axis picks here / sub-locations / reachable siblings.
const ENTITIES: PromptVariable = { token: '<ENTITIES>', label: 'Entities', color: HIGHLIGHT_PALETTE[8], axes: [ENTITY_SCOPE_AXIS, CONTENT_AXIS, FORMAT_AXIS] };
// The activated-dictionary lore for the turn — supplied by GameViewer per turn (narration prompt only). The
// `before` variant renders the early "## Background Lore" block; the default renders the late "## Foreground Lore".
const DICTIONARY: PromptVariable = {
  token: '<DICTIONARY>',
  label: 'Dictionary',
  color: HIGHLIGHT_PALETTE[11],
  variants: [
    { id: null, label: 'Foreground', help: 'Keyword-triggered lore placed late for high recency — the "## Foreground Lore" block.' },
    { id: 'before', label: 'Background', help: 'Lore placed early with the world setup — the "## Background Lore" block.' },
  ],
};
// Runtime value-token for the staged character pass — the name of the character whose motivation is being written.
const CHARACTER: PromptVariable = { token: '<CHARACTER NAME>', label: 'Character', color: HIGHLIGHT_PALETTE[7] };

// Runtime value-tokens for the aux requests' user-message templates (the player's action + the turn's
// game text), distinct from the world/context tokens above.
const PLAYER_ACTION: PromptVariable = { token: '<PLAYER ACTION>', label: 'Player Action', color: HIGHLIGHT_PALETTE[9] };
const NARRATION: PromptVariable = { token: '<NARRATION>', label: 'Narration', color: HIGHLIGHT_PALETTE[10] };
// Image-gen tag prompt only (Settings → Image Gen → Tag Prompt): expands to per-kind guidance. Registered
// here so the shared prompt parser/chip recognize it; it is never offered in a game prompt's toolbar.
export const SUBJECT: PromptVariable = { token: '<SUBJECT>', label: 'Subject', color: HIGHLIGHT_PALETTE[12] };

/** All known variables — used by the parser to recognize any token regardless of which prompt it's in. */
export const ALL_PROMPT_VARIABLES: PromptVariable[] = [
  WORLD, STATS, TRAITS, LOCATION, ENTITIES, NOTES, DICTIONARY, LENGTH, MARKDOWN, ACTIVE_CHARACTER, PLAYER_ACTION, NARRATION, CHARACTER, SUBJECT,
];

/** The context chips every system prompt can reference; GameViewer substitutes them uniformly. */
const CONTEXT_VARS: PromptVariable[] = [WORLD, STATS, TRAITS, LOCATION, ENTITIES, NOTES];

/** Which variables each prompt's toolbar offers. Every kind gets the shared context chips (even when its
 *  default text doesn't use them); some add their own extras (narration's length/markdown, character's name). */
export const PROMPT_KIND_VARIABLES: Record<PromptKind, PromptVariable[]> = {
  narration: [...CONTEXT_VARS, DICTIONARY, LENGTH, MARKDOWN],
  thinking: [...CONTEXT_VARS],
  choices: [...CONTEXT_VARS],
  statupdates: [...CONTEXT_VARS],
  location: [...CONTEXT_VARS],
  summary: [...CONTEXT_VARS],
  diary: [...CONTEXT_VARS],
  director: [...CONTEXT_VARS, ACTIVE_CHARACTER],
  character: [CHARACTER, ...CONTEXT_VARS],
  storyboard: [...CONTEXT_VARS],
};

/** Variables offered by the aux requests' editable user-message templates (the per-turn runtime values
 *  the code substitutes). Only the four aux kinds have a user template. */
export const PROMPT_KIND_USER_VARIABLES: Partial<Record<PromptKind, PromptVariable[]>> = {
  choices: [PLAYER_ACTION, NARRATION],
  statupdates: [PLAYER_ACTION, NARRATION],
  location: [PLAYER_ACTION, NARRATION],
  summary: [PLAYER_ACTION, NARRATION],
  director: [PLAYER_ACTION, NARRATION],
};

const VAR_BY_BASE = new Map(ALL_PROMPT_VARIABLES.map((v) => [v.token, v]));

/** A variable's variant axes, normalizing a single-axis `variants` list into one unnamed axis. */
export function variableAxes(variable: PromptVariable): PromptVariantAxis[] {
  if (variable.axes) return variable.axes;
  if (variable.variants) return [{ id: 'variant', label: '', options: variable.variants }];
  return [];
}

/** All non-null combined variant ids a variable can produce (cross-product of its axes' options, each
 *  axis contributing its id or nothing), joined by `.` in axis order. Excludes the all-default (empty). */
export function variableVariantIds(variable: PromptVariable): string[] {
  let combos: string[][] = [[]];
  for (const axis of variableAxes(variable)) {
    combos = combos.flatMap((c) => axis.options.map((o) => (o.id ? [...c, o.id] : c)));
  }
  return [...new Set(combos.filter((c) => c.length > 0).map((c) => c.join('.')))];
}

/** Split a token's combined id into a per-axis selection (`{ content: 'descriptions', format: 'markdown' }`),
 *  each axis defaulting to null. Parts are matched to axes by id, so order in the token doesn't matter. */
export function decodeVariant(variable: PromptVariable, id: string | null): Record<string, string | null> {
  const axes = variableAxes(variable);
  const selection: Record<string, string | null> = {};
  for (const axis of axes) selection[axis.id] = null;
  if (id) {
    for (const part of id.split('.')) {
      const axis = axes.find((a) => a.options.some((o) => o.id === part));
      if (axis) selection[axis.id] = part;
    }
  }
  return selection;
}

/** Inverse of `decodeVariant`: the combined id for a per-axis selection (non-null ids joined by `.` in
 *  axis order), or null when every axis is at its default. */
export function encodeVariant(variable: PromptVariable, selection: Record<string, string | null>): string | null {
  const ids = variableAxes(variable)
    .map((axis) => selection[axis.id])
    .filter((v): v is string => v != null);
  return ids.length ? ids.join('.') : null;
}

/** Every non-null variant id any variable supports (incl. multi-axis combos) — drives the parser's token
 *  regex. Longest-first so a compound id (`descriptions.markdown`) isn't masked by a prefix (`descriptions`). */
export const ALL_VARIANT_IDS: string[] = [
  ...new Set(ALL_PROMPT_VARIABLES.flatMap(variableVariantIds)),
].sort((a, b) => b.length - a.length);

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

/** The label(s) of a token's active, non-default variant selections, joined by ', ' (`<LOCATION|list>` →
 *  `'List'`, `<STATS DESCRIPTION|descriptions.markdown>` → `'Words, Default'`), or null when all axes are
 *  at their default. */
export function variantLabelForToken(token: string): string | null {
  const variable = variableForToken(token);
  if (!variable) return null;
  const selection = decodeVariant(variable, tokenVariant(token));
  const labels = variableAxes(variable)
    .flatMap((axis) => {
      const chosen = selection[axis.id];
      const opt = chosen != null ? axis.options.find((o) => o.id === chosen) : undefined;
      return opt ? [opt.label] : [];
    });
  return labels.length ? labels.join(', ') : null;
}

/** The accent color for a token, or undefined for an unknown token. */
export function colorForToken(token: string): string | undefined {
  return variableForToken(token)?.color;
}
