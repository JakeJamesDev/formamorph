import { HIGHLIGHT_PALETTE } from './highlightUtils';
import { escapeRegExp } from './utils';
import type { TextOrigin } from './markedText';

/** An optional alternate form a variable's chip can be switched to in Chip Options. `id: null` is the
 *  default form with no token suffix; a non-null id contributes to the token suffix (e.g. `|summary`). */
export interface PromptVariant {
  id: string | null;
  label: string;
  help?: string;
  /** Keep this option out of the chip label's pick list. */
  hideInLabel?: boolean;
  /** For a toggle axis: this stored id means the piece is on, where the axis's other stored ids mean off. */
  on?: boolean;
}

/** One independent dimension of a variable's variants (e.g. Stats has a `content` axis and a `format`
 *  axis). Each axis renders as its own row in Chip Options. A variable with a single axis can
 *  just use `variants`; multi-axis variables use `axes`. The token suffix is the non-null option ids of
 *  every axis joined by `.` in axis order (e.g. content `descriptions` + format `markdown` →
 *  `<STATS DESCRIPTION|descriptions.markdown>`). Option ids must be unique across a variable's axes and
 *  match `[a-z]+`. */
export interface PromptVariantAxis {
  id: string;
  label: string;
  options: PromptVariant[]; // first entry (id:null) is the default
  /** Render as an independent checkbox (on = its non-null option) rather than a single-select control. */
  toggle?: boolean;
  /** For a toggle axis: the checkbox is on while the axis holds its default (null) option, and clearing it
   *  stores the non-null one, unless that option is marked `on`. The bare token then keeps the piece. */
  onByDefault?: boolean;
  /** For a toggle axis: whether the piece is on while it holds its default (null) option, read from the
   *  chip's other picks. Absent, `onByDefault` decides. */
  onByDefaultWhen?: (selection: Record<string, string | null>) => boolean;
  /** For a toggle axis: one chip's toggle axes with this name form a group whose last piece on stays on. */
  lockGroup?: string;
  /** For a toggle axis: the Chip Options row its checkbox sits in. Axes that share a row name share a row. */
  row?: string;
  /** One line for the row, read from the first axis of the row that carries it. */
  rowHelp?: string;
  /** Help shown beside a toggle axis's checkbox. */
  help?: string;
  /** Show the stored choice and take no input. For an axis whose options exist but cannot differ here. */
  readOnly?: boolean;
  /** One line under a read-only axis: why it takes no input, and what unlocks it. */
  readOnlyHelp?: string;
  /** The rendered text this axis's control lights in Chip Options, where the chip's renderer reports it. */
  lights?: TextOrigin;
}

/** Registry of the angle-bracket variables that prompt templates can embed. The base `token`
 *  (brackets included) is what lives in the prompt string and what GameViewer substitutes at runtime;
 *  `label` is the friendly text shown on the chip; `color` is its accent (shared with the AI context
 *  viewer's palette); `variants` (when present) are the modes Chip Options offers. Adding a variable
 *  here makes it available to the chip toolbar and the parser. */
export interface PromptVariable {
  token: string; // exact base token, e.g. '<WORLD DESCRIPTION>'
  label: string; // friendly chip label, e.g. 'World'
  color: string; // chip/preview accent, from HIGHLIGHT_PALETTE
  variants?: PromptVariant[]; // single-axis Chip Options modes; first entry is the default/full form
  axes?: PromptVariantAxis[]; // multi-axis Chip Options (takes precedence over `variants`)
  /** Variant ids a released version wrote. They still parse and render as the bare chip; Chip Options never offers them. */
  retiredVariants?: string[];
  /** Offers the prefix/suffix fields: this chip renders one short value that can sit inside a sentence,
   *  rather than a multi-line block. See docs-internal/designs/chip-affixes/design.md. */
  affixable?: boolean;
}

/** Every prompt editor maps to one of these kinds (mirrors the Settings → Output → Turn Extras toggles). */
export type PromptKind = 'narration' | 'thinking' | 'choices' | 'statupdates' | 'location' | 'entitylocation' | 'summary' | 'milestone' | 'diary' | 'director' | 'character' | 'storyboard' | 'timepassed' | 'timeopening' | 'scenetags' | 'discover';

const SUMMARY_VARIANT: PromptVariant = {
  id: 'summary',
  label: 'Summary',
  help: 'Sends the short AI summary, or the full description if there is none',
};

// Location and entity context are each ONE chip with a `scope` axis (current/sub-locations/reachable/…), a
// shared content axis (Full/Summary), and the format axis. `scope: null` = the current location / here.
const LOCATION_SCOPE_AXIS: PromptVariantAxis = {
  id: 'scope',
  label: 'Scope',
  options: [
    { id: null, label: 'Current', help: 'Sends the location the player is in' },
    { id: 'sublocations', label: 'Sub', help: "Sends the current location's direct sub-locations" },
    { id: 'parent', label: 'Parent', help: 'Sends the containing location, or nothing at the top level' },
    { id: 'reachable', label: 'Reachable', help: 'Sends the containing location and its neighbors' },
    { id: 'destinations', label: 'Destinations', help: 'Sends connections, sub-locations, the containing location and its neighbors' },
  ],
};

const ENTITY_SCOPE_AXIS: PromptVariantAxis = {
  id: 'scope',
  label: 'Scope',
  options: [
    { id: null, label: 'Here', help: 'Sends the entities at the current location' },
    { id: 'sublocations', label: 'In Sub', help: 'Sends the entities in the direct sub-locations' },
    { id: 'reachable', label: 'Reachable', help: 'Sends the entities in the containing location and its neighbors' },
    { id: 'known', label: 'Known', help: 'Sends the summaries of entities whose Known In covers this location' },
    { id: 'inscene', label: 'In Scene', help: 'Sends the entities from the last few turns, wherever they are' },
  ],
};

const CONTENT_AXIS: PromptVariantAxis = {
  id: 'content',
  label: 'Content',
  lights: 'content',
  options: [
    { id: null, label: 'Full', help: 'Sends full detail for each item' },
    SUMMARY_VARIANT,
    { id: 'name', label: 'Name', help: 'Sends only the names, comma-separated, for use inside a sentence' },
  ],
};

// The persona is one entity, so its content axis speaks of one person rather than of each item in a list.
const PERSONA_CONTENT_AXIS: PromptVariantAxis = {
  id: 'content',
  label: 'Content',
  lights: 'content',
  options: [
    { id: null, label: 'Full', help: "Sends the persona's name, aliases, pronouns, and full description" },
    { id: 'summary', label: 'Summary', help: 'Sends the short AI summary, or the full description if there is none' },
    { id: 'name', label: 'Name', help: 'Sends only the name and pronouns, for use inside a sentence' },
  ],
};

// Shared "how the block is shaped" axis (mirrors the Default/Simple presets): Simple = plain text; Default =
// markdown. The labels-style preset strips this axis back to plain (see sectionStyle `stripChipFormat`).
const FORMAT_AXIS: PromptVariantAxis = {
  id: 'format',
  label: 'Format',
  options: [
    { id: null, label: 'Simple', help: 'Writes plain lines, with no bullets or bold' },
    { id: 'markdown', label: 'Markdown', help: 'Writes bullets with bold names' },
    { id: 'xml', label: 'XML', help: 'Writes nested tags for each item' },
  ],
};

const STAT_DETAIL_ROW_HELP = 'Picks which parts of each stat the AI reads';
// One wording for each piece on the Stats, Entities and Persona chips, so the three read the same everywhere.
const STAT_RANGE_HELP = "Sends each stat's value and bounds, like \"10/100\"";
const STAT_DESCRIPTOR_HELP = "Sends the word for the stat's current level, like \"Critical\"";
const STAT_DESCRIPTION_HELP = 'Sends what the stat measures';

// Stats content is three independent pieces (each a checkbox), plus the shared format axis. The stat's Name
// is always present; at least one piece must stay on (enforced in the editor). The old single-select ids
// `numbers` (Range) and `descriptions` (Descriptor) are kept, so existing tokens still render; `meaning` is new.
const STAT_VALUES_AXIS: PromptVariantAxis = {
  id: 'numbers', label: 'Range', toggle: true, lights: 'range', lockGroup: 'statDetail', row: 'Stat Detail', rowHelp: STAT_DETAIL_ROW_HELP, help: STAT_RANGE_HELP,
  options: [{ id: null, label: 'Range' }, { id: 'numbers', label: 'Range' }],
};
const STAT_STATUS_AXIS: PromptVariantAxis = {
  id: 'descriptions', label: 'Descriptor', toggle: true, lights: 'descriptor', lockGroup: 'statDetail', row: 'Stat Detail', help: STAT_DESCRIPTOR_HELP,
  options: [{ id: null, label: 'Descriptor' }, { id: 'descriptions', label: 'Descriptor' }],
};
const STAT_MEANING_AXIS: PromptVariantAxis = {
  id: 'meaning', label: 'Description', toggle: true, lights: 'meaning', lockGroup: 'statDetail', row: 'Stat Detail', help: STAT_DESCRIPTION_HELP,
  options: [{ id: null, label: 'Description' }, { id: 'meaning', label: 'Description' }],
};

/** A toggle axis on the Entities and Persona chips that the chip label never names. */
function rosterToggle(
  id: string, label: string, stored: string, help: string, extra: Partial<PromptVariantAxis> = {},
): PromptVariantAxis {
  return {
    id, label, toggle: true, help, ...extra,
    options: [{ id: null, label }, { id: stored, label, hideInLabel: true }],
  };
}

// Only With: keep only the entities that own a picked kind. Off by default; picks read as or.
const ONLY_WITH_STATS_AXIS = rosterToggle('withstats', 'Stats', 'withstats', 'Keeps only entities that own stats', {
  row: 'Only With', rowHelp: 'Keeps entities that own any checked kind', lights: 'ownsStats',
});
const ONLY_WITH_TRAITS_AXIS = rosterToggle('withtraits', 'Traits', 'withtraits', 'Keeps only entities that own traits', {
  row: 'Only With', lights: 'ownsTraits',
});
const PERSONA_ONLY_WITH_STATS_AXIS = { ...ONLY_WITH_STATS_AXIS, help: 'Sends the persona only when it owns stats',
  rowHelp: 'Sends the persona only if it owns any checked kind' };
const PERSONA_ONLY_WITH_TRAITS_AXIS = { ...ONLY_WITH_TRAITS_AXIS, help: 'Sends the persona only when it owns traits' };
// Include Traits and the Stat Detail pieces are on by default, so each stored id is the off state.
const INCLUDE_TRAITS_AXIS = rosterToggle('traits', 'Traits', 'notraits', "Sends each entity's owned traits", {
  onByDefault: true, row: 'Include', rowHelp: 'Picks what each entity sends besides its name', lights: 'traits',
});
const PERSONA_INCLUDE_TRAITS_AXIS = { ...INCLUDE_TRAITS_AXIS, help: "Sends the persona's owned traits",
  rowHelp: 'Picks what the persona sends besides its name' };
const ROSTER_STAT_DETAIL_AXES: PromptVariantAxis[] = [
  rosterToggle('range', 'Range', 'norange', STAT_RANGE_HELP, { onByDefault: true, lockGroup: 'statDetail', row: 'Stat Detail', rowHelp: STAT_DETAIL_ROW_HELP, lights: 'range' }),
  rosterToggle('descriptor', 'Descriptor', 'nodescriptor', STAT_DESCRIPTOR_HELP, { onByDefault: true, lockGroup: 'statDetail', row: 'Stat Detail', lights: 'descriptor' }),
  rosterToggle('description', 'Description', 'nodescription', STAT_DESCRIPTION_HELP, { onByDefault: true, lockGroup: 'statDetail', row: 'Stat Detail', lights: 'meaning' }),
];

// The Entities chip's stats piece: null is the scope's default (on for Here and In Scene), `nostats` stores off, `stats` on.
const ENTITY_STATS_AXIS: PromptVariantAxis = {
  id: 'stats', label: 'Stats', toggle: true, onByDefault: true, row: 'Include', lights: 'stats',
  onByDefaultWhen: (selection) => selection.scope == null || selection.scope === 'inscene',
  help: "Sends each entity's stats: range, descriptor and description",
  options: [{ id: null, label: 'Stats' }, { id: 'nostats', label: 'No Stats' }, { id: 'stats', label: 'Stats', hideInLabel: true, on: true }],
};

// The Persona chip's stats piece: on in a bare token, `nostats` turns it off.
const PERSONA_STATS_AXIS: PromptVariantAxis = {
  ...ENTITY_STATS_AXIS, onByDefaultWhen: undefined, help: "Sends the persona's own stats: range, descriptor and description",
  options: ENTITY_STATS_AXIS.options.slice(0, 2),
};

// Each variable gets a fixed palette slot so its color is stable everywhere (chip + preview, every prompt).
const WORLD: PromptVariable = { token: '<WORLD DESCRIPTION>', label: 'World', color: HIGHLIGHT_PALETTE[0], affixable: true };
const STATS: PromptVariable = { token: '<STATS DESCRIPTION>', label: 'Stats', color: HIGHLIGHT_PALETTE[1], axes: [STAT_VALUES_AXIS, STAT_STATUS_AXIS, STAT_MEANING_AXIS, FORMAT_AXIS] };
const TRAITS: PromptVariable = { token: '<TRAITS DESCRIPTION>', label: 'Traits', color: HIGHLIGHT_PALETTE[2], axes: [FORMAT_AXIS] };
const LOCATION: PromptVariable = { token: '<LOCATION>', label: 'Location', color: HIGHLIGHT_PALETTE[3], axes: [LOCATION_SCOPE_AXIS, CONTENT_AXIS, FORMAT_AXIS], affixable: true };
// The entity the player plays. Affixable so a placement can carry its own heading, which then disappears
// with the value when no persona is set.
const PERSONA: PromptVariable = { token: '<PERSONA>', label: 'Persona', color: HIGHLIGHT_PALETTE[17], axes: [
  PERSONA_ONLY_WITH_STATS_AXIS, PERSONA_ONLY_WITH_TRAITS_AXIS, PERSONA_CONTENT_AXIS, PERSONA_INCLUDE_TRAITS_AXIS, PERSONA_STATS_AXIS,
  ...ROSTER_STAT_DETAIL_AXES, FORMAT_AXIS,
], affixable: true };
const NOTES: PromptVariable = { token: '<NOTES>', label: 'Notes', color: HIGHLIGHT_PALETTE[4], affixable: true };
const LENGTH: PromptVariable = { token: '<LENGTH GUIDANCE>', label: 'Length Guidance', color: HIGHLIGHT_PALETTE[5] };
const MARKDOWN: PromptVariable = {
  token: '<MARKDOWN GUIDANCE>',
  label: 'Markdown Guidance',
  color: HIGHLIGHT_PALETTE[6],
  retiredVariants: ['definitions'],
};
// Director prompt only: expands to the cast-size guidance derived from the Limit Active Characters setting.
const ACTIVE_CHARACTER: PromptVariable = { token: '<ACTIVE CHARACTER GUIDANCE>', label: 'Active Character Guidance', color: HIGHLIGHT_PALETTE[13] };
// Entities are one chip whose `scope` axis picks here / sub-locations / reachable siblings.
const ENTITIES: PromptVariable = { token: '<ENTITIES>', label: 'Entities', color: HIGHLIGHT_PALETTE[8], axes: [
  ENTITY_SCOPE_AXIS, ONLY_WITH_STATS_AXIS, ONLY_WITH_TRAITS_AXIS, CONTENT_AXIS, INCLUDE_TRAITS_AXIS, ENTITY_STATS_AXIS, ...ROSTER_STAT_DETAIL_AXES, FORMAT_AXIS,
], affixable: true };
// The activated-dictionary lore for the turn — supplied by GameViewer per turn (narration prompt only). The
// `before` variant renders the early "## Background Lore" block; the default renders the late "## Foreground Lore".
const DICTIONARY: PromptVariable = {
  token: '<DICTIONARY>',
  label: 'Dictionary',
  color: HIGHLIGHT_PALETTE[11],
  affixable: true,
  variants: [
    { id: null, label: 'Foreground', help: 'Sends keyword-triggered lore late in the prompt, under "## Foreground Lore"' },
    { id: 'before', label: 'Background', help: 'Sends lore early with the world setup, under "## Background Lore"' },
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

// Character-note pass only: two headed blocks, each rendering its own header or nothing. The later
// material is empty on a first note, so a first note and a rewrite share one template.
const FIRST_PASSAGE: PromptVariable = { token: '<FIRST PASSAGE>', label: 'First Passage', color: HIGHLIGHT_PALETTE[10] };
const LATER_MATERIAL: PromptVariable = { token: '<LATER MATERIAL>', label: 'Later Material', color: HIGHLIGHT_PALETTE[12] };

// Milestone selector only: two headed, numbered digest lists. The remembered list is empty on a first run.
const REMEMBERED_MOMENTS: PromptVariable = { token: '<REMEMBERED MOMENTS>', label: 'Remembered Moments', color: HIGHLIGHT_PALETTE[11] };
const NEW_MOMENTS: PromptVariable = { token: '<NEW MOMENTS>', label: 'New Moments', color: HIGHLIGHT_PALETTE[15] };

// Entity location request only: the closed list of replies the entity can give, one per line.
const MOVE_OPTIONS: PromptVariable = { token: '<MOVE OPTIONS>', label: 'Move Options', color: HIGHLIGHT_PALETTE[8] };
// Entity location request only: one sentence saying whether the entity already follows the player.
const MOVE_STATE: PromptVariable = { token: '<MOVE STATE>', label: 'Move State', color: HIGHLIGHT_PALETTE[7] };

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
  WORLD, STATS, TRAITS, PERSONA, LOCATION, ENTITIES, NOTES, DICTIONARY, LENGTH, MARKDOWN, ACTIVE_CHARACTER, PLAYER_ACTION, NARRATION, CHARACTER, SUBJECT,
  TIME, IN_FRAME, LANGUAGE, FIRST_PASSAGE, LATER_MATERIAL, REMEMBERED_MOMENTS, NEW_MOMENTS, MOVE_OPTIONS, MOVE_STATE,
];

/** The context chips every system prompt can reference; GameViewer substitutes them uniformly. */
const CONTEXT_VARS: PromptVariable[] = [WORLD, STATS, TRAITS, PERSONA, LOCATION, ENTITIES, NOTES, TIME];

/** Which variables each prompt's toolbar offers. Every kind gets the shared context chips (even when its
 *  default text doesn't use them); some add their own extras (narration's length/markdown, character's name). */
export const PROMPT_KIND_VARIABLES: Record<PromptKind, PromptVariable[]> = {
  narration: [...CONTEXT_VARS, DICTIONARY, LENGTH, MARKDOWN, LANGUAGE],
  thinking: [...CONTEXT_VARS],
  // The two prompts the player reads the output of, and so the two the language directive is worded for.
  choices: [...CONTEXT_VARS, LANGUAGE],
  statupdates: [...CONTEXT_VARS],
  location: [...CONTEXT_VARS],
  entitylocation: [CHARACTER, ...CONTEXT_VARS],
  summary: [...CONTEXT_VARS],
  milestone: [...CONTEXT_VARS],
  diary: [...CONTEXT_VARS],
  director: [...CONTEXT_VARS, ACTIVE_CHARACTER],
  character: [CHARACTER, ...CONTEXT_VARS],
  storyboard: [...CONTEXT_VARS],
  timepassed: [...CONTEXT_VARS],
  timeopening: [...CONTEXT_VARS],
  scenetags: [...CONTEXT_VARS],
  discover: [...CONTEXT_VARS],
};

/** Variables offered by the editable user-message templates (the per-turn runtime values the code
 *  substitutes). Narration's template is just the action by default — its chip list is deliberately
 *  minimal, since anything added there rides the prompt's highest-recency slot. */
export const PROMPT_KIND_USER_VARIABLES: Partial<Record<PromptKind, PromptVariable[]>> = {
  narration: [PLAYER_ACTION],
  choices: [PLAYER_ACTION, NARRATION],
  statupdates: [PLAYER_ACTION, NARRATION],
  location: [PLAYER_ACTION, NARRATION],
  entitylocation: [CHARACTER, PLAYER_ACTION, NARRATION, MOVE_STATE, MOVE_OPTIONS],
  summary: [PLAYER_ACTION, NARRATION],
  milestone: [REMEMBERED_MOMENTS, NEW_MOMENTS],
  director: [PLAYER_ACTION, NARRATION],
  timepassed: [PLAYER_ACTION, NARRATION],
  // The opening pass runs on turn one, where the player's action is "start the game" — only the narration
  // carries any time signal, so the action chip is deliberately not offered.
  timeopening: [NARRATION],
  // The tag pass reads the prose of this turn and who the composer put in frame. The player's action is
  // deliberately absent: what was attempted is not what the picture shows.
  scenetags: [NARRATION, IN_FRAME],
  discover: [CHARACTER, FIRST_PASSAGE, LATER_MATERIAL],
};

const VAR_BY_BASE = new Map(ALL_PROMPT_VARIABLES.map((v) => [v.token, v]));

/** A variable's variant axes, normalizing a single-axis `variants` list into one unnamed axis. */
export function variableAxes(variable: PromptVariable): PromptVariantAxis[] {
  if (variable.axes) return variable.axes;
  if (variable.variants) return [{ id: 'variant', label: '', options: variable.variants }];
  return [];
}

/** Every non-null option id of a variable's axes, in axis order. */
export function variableOptionIds(variable: PromptVariable): string[] {
  return variableAxes(variable).flatMap((axis) => axis.options.flatMap((o) => (o.id ? [o.id] : [])));
}

/** Split a token's combined id into a per-axis selection (`{ content: 'descriptions', format: 'markdown' }`),
 *  each axis defaulting to null. Parts are matched to axes by id, so order in the token doesn't matter; a
 *  later part on an axis wins over an earlier one. */
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

/** Whether a toggle axis's piece is on while it holds its default (null) option. */
function toggleDefaultOn(axis: PromptVariantAxis, selection: Record<string, string | null>): boolean {
  return axis.onByDefaultWhen ? axis.onByDefaultWhen(selection) : !!axis.onByDefault;
}

/** Whether a toggle axis's piece is on under a selection. A stored id is the piece on, unless the axis is
 *  on by default and the id is not marked `on`. */
export function toggleIsOn(axis: PromptVariantAxis, selection: Record<string, string | null>): boolean {
  const stored = selection[axis.id] ?? null;
  if (stored === null) return toggleDefaultOn(axis, selection);
  return axis.options.find((o) => o.id === stored)?.on ?? !axis.onByDefault;
}

/** The option id that makes a toggle axis's piece `on` under a selection: null when that is the default. */
export function toggleOptionFor(axis: PromptVariantAxis, selection: Record<string, string | null>, on: boolean): string | null {
  if (on === toggleDefaultOn(axis, selection)) return null;
  const stored = axis.options.filter((o) => o.id != null && (o.on ?? !axis.onByDefault) === on);
  return stored[0]?.id ?? null;
}

/** Resets each scope-dependent toggle whose stored id says what its default now says, such as an Entities
 *  `stats` id after the scope moves to one where stats are on by default. The render is unchanged. */
export function dropRedundantToggles(variable: PromptVariable, selection: Record<string, string | null>): Record<string, string | null> {
  const next = { ...selection };
  for (const axis of variableAxes(variable)) {
    if (axis.toggle && axis.onByDefaultWhen && next[axis.id] != null && toggleIsOn(axis, next) === toggleDefaultOn(axis, next)) {
      next[axis.id] = null;
    }
  }
  return next;
}

/** A chip key's variable and the per-axis selection its id spells, or undefined when its variable cannot
 *  spell it: an unknown base, an affix, or an id outside the variable's own axes or out of axis order. */
export function decodeChipKey(key: string): { variable: PromptVariable; selection: Record<string, string | null> } | undefined {
  const variable = variableForToken(key);
  if (!variable) return undefined;
  if (key === variable.token) return { variable, selection: decodeVariant(variable, null) };
  const stem = `${variable.token.slice(0, -1)}|`;
  if (!key.startsWith(stem) || !key.endsWith('>')) return undefined;
  const id = key.slice(stem.length, -1);
  const selection = decodeVariant(variable, id);
  return encodeVariant(variable, selection) === id ? { variable, selection } : undefined;
}

/** The canonical spelling of a variant id on `variable`: its ids decoded and re-encoded in axis order. */
function canonicalVariant(variable: PromptVariable, id: string | null): string | null {
  return id && encodeVariant(variable, decodeVariant(variable, id));
}

/**
 * The token grammar, shared by the template parser, the style downcast and the chip editor:
 *
 *     `<BASE [|variantId] [|pre="…"] [|post="…"] [|format=markdown|xml] [|header="…"]>`
 *
 * The variant id is any `.`-joined run of the base's own option ids, in any order. An id the base does not
 * know, another base's included, fails the match.
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
// Longest-first so a short base can't mask a longer one.
const BY_BASE_LENGTH = [...ALL_PROMPT_VARIABLES].sort((a, b) => b.token.length - a.token.length);
const baseSource = (variable: PromptVariable) => escapeRegExp(variable.token.slice(0, -1)); // drop trailing '>'
const TOKEN_BASES = BY_BASE_LENGTH.map(baseSource).join('|');
const OPTION_IDS = new Map(ALL_PROMPT_VARIABLES.map((v) => [v, new Set([...variableOptionIds(v), ...(v.retiredVariants ?? [])])]));
/** A base followed by an optional run of its own option ids. */
function baseWithVariant(variable: PromptVariable): string {
  const ids = [...OPTION_IDS.get(variable)!].join('|');
  return ids ? `${baseSource(variable)}(?:\\|(?:${ids})(?:\\.(?:${ids}))*)?` : baseSource(variable);
}
// `[^"]+` (not `*`): an empty affix has no canonical spelling, so `pre=""` must not parse.
const AFFIX_BODY = '"([^"]+)"';
// Header uses JSON string escaping; affixes retain their literal grammar.
const HEADER_BODY = '"((?:[^"\\\\\\x00-\\x1f]|\\\\(?:["\\\\/bfnrt]|u[0-9a-fA-F]{4}))*)"';
const TOKEN_TAIL = `(?:\\|pre=${AFFIX_BODY})?(?:\\|post=${AFFIX_BODY})?(?:\\|format=(markdown|xml))?(?:\\|header=${HEADER_BODY})?>`;
export const TOKEN_PATTERN = `(?:${BY_BASE_LENGTH.map(baseWithVariant).join('|')})${TOKEN_TAIL}`;

/** The character an affix cannot contain (it delimits the affix in the token). */
export const AFFIX_FORBIDDEN = '"';

/** A token taken apart. `key` is the token WITHOUT affixes, its variant in axis order — the string the
 *  renderer looks a value up by. */
export interface TokenParts {
  base: string;
  variantId: string | null;
  pre: string;
  post: string;
  header?: string;
  /** Header-only selection; omitted for Simple and kept separate from body lookup keys. */
  headerFormat?: 'markdown' | 'xml';
  key: string;
}

// Anchored twin of the parser's regex; the variant run is captured loosely and checked against its base's ids.
const TOKEN_EXACT = new RegExp(`^(${TOKEN_BASES})(?:\\|([a-z]+(?:\\.[a-z]+)*))?${TOKEN_TAIL}$`);

/** Take a token apart, or null when it isn't a canonical token. The key spells the variant in axis order. */
export function splitToken(token: string): TokenParts | null {
  const m = TOKEN_EXACT.exec(token);
  if (!m) return null;
  const base = `${m[1]}>`;
  const variantId = m[2] ?? null;
  const variable = VAR_BY_BASE.get(base)!;
  const known = OPTION_IDS.get(variable)!;
  if (variantId && !variantId.split('.').every((part) => known.has(part))) return null;
  return { base, variantId, pre: m[3] ?? '', post: m[4] ?? '', key: withVariant(base, canonicalVariant(variable, variantId)),
    ...(m[5] === 'markdown' || m[5] === 'xml' ? { headerFormat: m[5] } : {}),
    ...(m[6] !== undefined ? { header: JSON.parse(`"${m[6]}"`) as string } : {}) };
}

/** Build a canonical token from its pieces. Empty affixes are omitted, so there is exactly one spelling
 *  of any given token — the property the round-trip guarantee rests on. */
export function joinToken(parts: { base: string; variantId?: string | null; pre?: string; post?: string; header?: string; headerFormat?: 'markdown' | 'xml' }): string {
  const inner = parts.base.slice(0, -1);
  const variant = parts.variantId ? `|${parts.variantId}` : '';
  const pre = parts.pre ? `|pre="${parts.pre}"` : '';
  const post = parts.post ? `|post="${parts.post}"` : '';
  const header = parts.header ? `|header=${JSON.stringify(parts.header)}` : '';
  const format = parts.headerFormat ? `|format=${parts.headerFormat}` : '';
  return `${inner}${variant}${pre}${post}${format}${header}>`;
}

/** True when `text` is free of the affix delimiter. */
export function isValidAffix(text: string): boolean {
  return !text.includes(AFFIX_FORBIDDEN);
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
      return opt && !opt.hideInLabel ? [opt.label] : [];
    });
  return labels.length ? labels.join(', ') : null;
}

const ONLY_WITH_AXIS_IDS = new Set([ONLY_WITH_STATS_AXIS.id, ONLY_WITH_TRAITS_AXIS.id]);

/** What a token's Only With picks read as (`Only With Stats or Traits`), or null while no pick is on. The
 *  chip face shows a glyph with this text as its tooltip; the label never names the picks. */
export function onlyWithForToken(token: string): string | null {
  const variable = variableForToken(token);
  if (!variable) return null;
  const selection = decodeVariant(variable, tokenVariant(token));
  const picks = variableAxes(variable)
    .filter((axis) => ONLY_WITH_AXIS_IDS.has(axis.id) && selection[axis.id] != null)
    .map((axis) => axis.label);
  return picks.length ? `Only With ${picks.join(' or ')}` : null;
}

/** The affix-free key a chip is identified by — the same string Chip Values look a value up by, so
 *  one placement's wording never makes it a different chip. Falls back to the token itself for a family
 *  that does not parse here (placeholders). */
export function chipTokenKey(token: string): string {
  return splitToken(token)?.key ?? token;
}

/** The accent color for a token, or undefined for an unknown token. */
export function colorForToken(token: string): string | undefined {
  return variableForToken(token)?.color;
}
