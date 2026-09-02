import { HIGHLIGHT_PALETTE } from './highlightUtils';
import { escapeRegExp } from './utils';

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
  /** Lay the options out this many per row instead of all on one. For axes with enough options that a
   *  single row squeezes the labels unreadably. */
  columns?: number;
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
  /** Offers the prefix/suffix fields: this chip renders one short value that can sit inside a sentence,
   *  rather than a multi-line block. See docs-internal/designs/chip-affixes/design.md. */
  affixable?: boolean;
}

/** Every prompt editor maps to one of these kinds (mirrors the Settings → Output → Turn Extras toggles). */
export type PromptKind = 'narration' | 'thinking' | 'choices' | 'statupdates' | 'location' | 'summary' | 'diary' | 'director' | 'character' | 'storyboard' | 'timepassed' | 'timeopening' | 'scenetags';

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
  // Three per row: the scopes that name ONE place lead, the two that list many follow.
  columns: 3,
  options: [
    { id: null, label: 'Current', help: 'The location the player is in right now.' },
    { id: 'sublocations', label: 'Sub', help: "The current location's direct sub-locations." },
    { id: 'parent', label: 'Parent', help: 'The single location that contains this one (nothing at the top level).' },
    { id: 'reachable', label: 'Reachable', help: 'The location that contains this one, plus its neighbors (same parent).' },
    { id: 'destinations', label: 'Destinations', help: 'Everywhere reachable from here — connections + sub-locations + the containing location and its neighbors.' },
  ],
};

const ENTITY_SCOPE_AXIS: PromptVariantAxis = {
  id: 'scope',
  label: 'Scope',
  options: [
    { id: null, label: 'Here', help: 'Characters and things at the current location.' },
    { id: 'sublocations', label: 'In Sub', help: 'Characters and things in the direct sub-locations.' },
    { id: 'reachable', label: 'Reachable', help: 'Characters and things in the containing location and its neighbors.' },
    { id: 'inscene', label: 'In Scene', help: 'Whoever has actually taken part in the last few turns, wherever they are from.' },
  ],
};

const CONTENT_AXIS: PromptVariantAxis = {
  id: 'content',
  label: 'Content',
  options: [
    { id: null, label: 'Full', help: 'Full detail for each item.' },
    SUMMARY_VARIANT,
    { id: 'name', label: 'Name', help: 'Just the name (or a comma-separated list of names), with no description or labels — for use inside a sentence.' },
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
    { id: 'xml', label: 'XML', help: 'XML: nested tags per item.' },
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
const LOCATION: PromptVariable = { token: '<LOCATION>', label: 'Location', color: HIGHLIGHT_PALETTE[3], axes: [LOCATION_SCOPE_AXIS, CONTENT_AXIS, FORMAT_AXIS], affixable: true };
const NOTES: PromptVariable = { token: '<NOTES>', label: 'Notes', color: HIGHLIGHT_PALETTE[4], affixable: true };
const LENGTH: PromptVariable = { token: '<LENGTH GUIDANCE>', label: 'Length Guidance', color: HIGHLIGHT_PALETTE[5] };
const MARKDOWN: PromptVariable = { token: '<MARKDOWN GUIDANCE>', label: 'Markdown Guidance', color: HIGHLIGHT_PALETTE[6] };
// Director prompt only: expands to the cast-size guidance derived from the Limit Active Characters setting.
const ACTIVE_CHARACTER: PromptVariable = { token: '<ACTIVE CHARACTER GUIDANCE>', label: 'Active Character Guidance', color: HIGHLIGHT_PALETTE[13] };
// Entities are one chip whose `scope` axis picks here / sub-locations / reachable siblings.
const ENTITIES: PromptVariable = { token: '<ENTITIES>', label: 'Entities', color: HIGHLIGHT_PALETTE[8], axes: [ENTITY_SCOPE_AXIS, CONTENT_AXIS, FORMAT_AXIS], affixable: true };
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
// Image-gen tag prompt only (Settings → Endpoints → Tag Prompt): expands to per-kind guidance. Registered
// here so the shared prompt parser/chip recognize it; it is never offered in a game prompt's toolbar.
export const SUBJECT: PromptVariable = { token: '<SUBJECT>', label: 'Subject', color: HIGHLIGHT_PALETTE[12] };

// The story's own clock — "Day 3, evening" — as a plain inline value. Renders the uniform placeholder while
// Time in Memory is off, so an affixed placement simply disappears rather than needing its own switch.
const TIME: PromptVariable = { token: '<TIME>', label: 'Time', color: HIGHLIGHT_PALETTE[10], affixable: true };

// Scene-image tag pass only: the characters the composer has put in frame, so the action tags describe
// those people and no others. A value token like <NARRATION> — never a context block.
const IN_FRAME: PromptVariable = { token: '<IN FRAME>', label: 'In Frame', color: HIGHLIGHT_PALETTE[8] };

// The AI Language setting, as the directive the prompt actually carries (lib/languages `languageDirective`).
// Placement is the author's: the default templates put it last, where recency makes a small model honor it,
// and an author who knows their model better can move it. Renders nothing at all for English or a blank
// value, so the chip costs those prompts neither a line nor a blank one.
const LANGUAGE: PromptVariable = { token: '<LANGUAGE>', label: 'Language', color: HIGHLIGHT_PALETTE[14] };

/** The chips the now-line message offers. All ordinary chips: the wording that used to be welded into
 *  bespoke `<SCENE …>` tokens now lives in each placement's prefix/suffix, so it can be reworded. */
export const NOW_LINE_VARIABLES: PromptVariable[] = [LOCATION, ENTITIES, TIME, NOTES];

/** All known variables — used by the parser to recognize any token regardless of which prompt it's in. */
export const ALL_PROMPT_VARIABLES: PromptVariable[] = [
  WORLD, STATS, TRAITS, LOCATION, ENTITIES, NOTES, DICTIONARY, LENGTH, MARKDOWN, ACTIVE_CHARACTER, PLAYER_ACTION, NARRATION, CHARACTER, SUBJECT,
  TIME, IN_FRAME, LANGUAGE,
];

/** The context chips every system prompt can reference; GameViewer substitutes them uniformly. */
const CONTEXT_VARS: PromptVariable[] = [WORLD, STATS, TRAITS, LOCATION, ENTITIES, NOTES, TIME];

/** Which variables each prompt's toolbar offers. Every kind gets the shared context chips (even when its
 *  default text doesn't use them); some add their own extras (narration's length/markdown, character's name). */
export const PROMPT_KIND_VARIABLES: Record<PromptKind, PromptVariable[]> = {
  narration: [...CONTEXT_VARS, DICTIONARY, LENGTH, MARKDOWN, LANGUAGE],
  thinking: [...CONTEXT_VARS],
  // The two prompts the player reads the output of, and so the two the language directive is worded for.
  choices: [...CONTEXT_VARS, LANGUAGE],
  statupdates: [...CONTEXT_VARS],
  location: [...CONTEXT_VARS],
  summary: [...CONTEXT_VARS],
  diary: [...CONTEXT_VARS],
  director: [...CONTEXT_VARS, ACTIVE_CHARACTER],
  character: [CHARACTER, ...CONTEXT_VARS],
  storyboard: [...CONTEXT_VARS],
  timepassed: [...CONTEXT_VARS],
  timeopening: [...CONTEXT_VARS],
  scenetags: [...CONTEXT_VARS],
};

/** Variables offered by the editable user-message templates (the per-turn runtime values the code
 *  substitutes). Narration's template is just the action by default — its chip list is deliberately
 *  minimal, since anything added there rides the prompt's highest-recency slot. */
export const PROMPT_KIND_USER_VARIABLES: Partial<Record<PromptKind, PromptVariable[]>> = {
  narration: [PLAYER_ACTION],
  choices: [PLAYER_ACTION, NARRATION],
  statupdates: [PLAYER_ACTION, NARRATION],
  location: [PLAYER_ACTION, NARRATION],
  summary: [PLAYER_ACTION, NARRATION],
  director: [PLAYER_ACTION, NARRATION],
  timepassed: [PLAYER_ACTION, NARRATION],
  // The opening pass runs on turn one, where the player's action is "start the game" — only the narration
  // carries any time signal, so the action chip is deliberately not offered.
  timeopening: [NARRATION],
  // The tag pass reads the prose of this turn and who the composer put in frame. The player's action is
  // deliberately absent: what was attempted is not what the picture shows.
  scenetags: [NARRATION, IN_FRAME],
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

/**
 * The token grammar, shared by the template parser, the style downcast and the chip editor:
 *
 *     `<BASE [|variantId] [|pre="…"] [|post="…"]>`
 *
 * Affixes are the connective words around a chip used inside a sentence ("Now you are at X, inside Y"),
 * and they render only when the chip has a value — see `renderPromptTemplate`. They live in the token
 * rather than a side table because a preset is a plain string that gets copied, shared and style-downcast,
 * so the wording has to travel with it. Design: docs-internal/designs/chip-affixes/design.md.
 *
 * Quotes delimit the affix, which keeps leading/trailing spaces visible in the raw text and makes `>` and
 * `|` harmless inside one. `"` is therefore the single character an affix cannot contain — one banned
 * character beats an escape grammar for a field that holds words like `, inside `.
 *
 * The order is fixed and empty affixes are never written. Anything else — reordered, unquoted, `pre=""` —
 * simply fails to match and stays literal text, exactly as an unknown variant id does. That is what makes
 * `serialize(parse(x)) === x` hold by construction rather than by care.
 */
const TOKEN_BASES = ALL_PROMPT_VARIABLES.map((v) => v.token.slice(0, -1)) // drop trailing '>'
  .sort((a, b) => b.length - a.length) // longest-first so a short base can't mask a longer one
  .map(escapeRegExp)
  .join('|');
// `[^"]+` (not `*`): an empty affix has no canonical spelling, so `pre=""` must not parse.
const AFFIX_BODY = '"([^"]+)"';
export const TOKEN_PATTERN =
  `(?:${TOKEN_BASES})(?:\\|(?:${ALL_VARIANT_IDS.map(escapeRegExp).join('|')}))?` +
  `(?:\\|pre=${AFFIX_BODY})?(?:\\|post=${AFFIX_BODY})?>`;

/** Longest an affix may be. They are connective phrases, not prose. */
export const AFFIX_MAX_LENGTH = 40;

/** The character an affix cannot contain (it delimits the affix in the token). */
export const AFFIX_FORBIDDEN = '"';

/** A token taken apart. `key` is the token WITHOUT affixes — the string `buildContextValues` precomputes
 *  and the renderer looks values up by. */
export interface TokenParts {
  base: string;
  variantId: string | null;
  pre: string;
  post: string;
  key: string;
}

// Anchored, non-global twin of the parser's regex, with the pieces captured.
const TOKEN_EXACT = new RegExp(
  `^(${TOKEN_BASES})(?:\\|(${ALL_VARIANT_IDS.map(escapeRegExp).join('|')}))?` +
    `(?:\\|pre=${AFFIX_BODY})?(?:\\|post=${AFFIX_BODY})?>$`,
);

/** Take a token apart, or null when it isn't a canonical token. */
export function splitToken(token: string): TokenParts | null {
  const m = TOKEN_EXACT.exec(token);
  if (!m) return null;
  const base = `${m[1]}>`;
  const variantId = m[2] ?? null;
  return { base, variantId, pre: m[3] ?? '', post: m[4] ?? '', key: withVariant(base, variantId) };
}

/** Build a canonical token from its pieces. Empty affixes are omitted, so there is exactly one spelling
 *  of any given token — the property the round-trip guarantee rests on. */
export function joinToken(parts: { base: string; variantId?: string | null; pre?: string; post?: string }): string {
  const inner = parts.base.slice(0, -1);
  const variant = parts.variantId ? `|${parts.variantId}` : '';
  const pre = parts.pre ? `|pre="${parts.pre}"` : '';
  const post = parts.post ? `|post="${parts.post}"` : '';
  return `${inner}${variant}${pre}${post}>`;
}

/** True when `text` is usable as an affix (short enough, and free of the delimiter). */
export function isValidAffix(text: string): boolean {
  return text.length <= AFFIX_MAX_LENGTH && !text.includes(AFFIX_FORBIDDEN);
}

/** The base token (`<…>`) of a possibly-variant token, e.g. `<LOCATION|summary>` → `<LOCATION>`. */
export function baseToken(token: string): string {
  const pipe = token.indexOf('|');
  return pipe === -1 ? token : `${token.slice(0, pipe)}>`;
}

/** The variant id of a token (`<LOCATION|list>` → `'list'`), or null for the default/full form. Affixes
 *  are not part of the variant, so an affixed token reports the same id as a bare one. */
export function tokenVariant(token: string): string | null {
  const parts = splitToken(token);
  if (parts) return parts.variantId;
  // Not canonical (a hand-built token in a test or a legacy call) — fall back to the pre-affix reading.
  const match = token.match(/\|([^>]+)>$/);
  return match ? match[1] : null;
}

/** Re-apply a variant to a base token: `<LOCATION>`, `'list'` → `<LOCATION|list>` (null → base unchanged).
 *  Affix-free by definition; callers that must preserve affixes use `joinToken`. */
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

/** The affix-free key a chip is identified by — the same string `buildContextValues` keys values on, so
 *  one placement's wording never makes it a different chip. Falls back to the token itself for a family
 *  that does not parse here (placeholders). */
export function chipTokenKey(token: string): string {
  return splitToken(token)?.key ?? token;
}

/** The accent color for a token, or undefined for an unknown token. */
export function colorForToken(token: string): string | undefined {
  return variableForToken(token)?.color;
}
