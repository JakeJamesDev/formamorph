import { lengthGuidance, type ParagraphLimit } from './outputLength';
import { restyle } from './sectionStyle';
import { type SectionStyle } from './promptPresets';
import { markdownGuidance, activeCharacterGuidance } from '@/components/game/GamePrompts';
import { languageDirective, type LanguageSurface } from './languages';
import {
  ALL_PROMPT_VARIABLES,
  variableVariantIds,
  withVariant,
  decodeVariant,
  baseToken,
  type PromptVariable,
} from './promptVariables';

/**
 * The one pool the prompt editor's Preview draws on, in two layers.
 *
 * **Derived** values are computed from the player's own settings and are therefore real wherever they are
 * shown — the length, markdown and cast-size guidance a prompt would actually receive. They need no game.
 *
 * **Sample** values stand in for what only a playthrough can supply: the world, its stats, places, people,
 * lore and clock. Deliberately generic ("Sample Town") rather than lifted from a bundled world, since a
 * preview that looked like real content would be taken for the player's own; the pane badges them.
 *
 * Both the in-game path and the Settings fallback compose from here — previously each carried its own
 * placeholder strings, which could only drift apart. Nothing here reaches a model; it is display-only.
 */

/** Which tokens the derived layer owns — real settings values, never sampled. */
export const DERIVED_TOKENS = ['<LENGTH GUIDANCE>', '<MARKDOWN GUIDANCE>', '<ACTIVE CHARACTER GUIDANCE>', '<LANGUAGE>'];

const WORLD = `A quiet stretch of coast where the tide leaves more behind than it takes. People here trade in
salvage and rumor, and nobody asks where either came from.`;

const NOTES = `Traveler is looking for the person who sold them a false map.`;

const TIME = 'Day 3, evening';

const DICTIONARY_AFTER = `Salt Glass: the green-tinted glass the tide grinds smooth. Locals string it over
doorways; nobody agrees on what it wards off.`;

const DICTIONARY_BEFORE = `The Long Ebb: the season when the water pulls back past the old pilings and the
wrecks show. It is happening now.`;

const TRAITS = `Light Sleeper - wakes at the smallest sound, and is never quite rested.
Salvager's Eye - spots the worth in a heap of junk, and rarely says so out loud.`;

/** Full / summary / name renderings for one place. */
const LOCATIONS: Record<string, { full: string; summary: string; name: string }> = {
  '': {
    full: `The Landing - a crescent of wet stone below the town, littered with rope and broken crates. One
lamp burns at the head of the stair. The water is further out than it should be.`,
    summary: 'The Landing - a stone shore below the town, lamplit, the tide well out.',
    name: 'The Landing',
  },
  sublocations: {
    full: `The Boathouse - low, tar-black, its door open on darkness.
The Tide Pools - shallow basins the ebb has left standing.`,
    summary: 'The Boathouse; The Tide Pools',
    name: 'The Boathouse, The Tide Pools',
  },
  parent: {
    full: `Sample Town - a settlement of perhaps two hundred, built up the slope in terraces so no house
stands directly above another's chimney.`,
    summary: 'Sample Town - a small terraced settlement above the water.',
    name: 'Sample Town',
  },
  reachable: {
    full: `Sample Town - the terraced settlement above the water.
The Causeway - a spit of stone that floods at high tide.`,
    summary: 'Sample Town; The Causeway',
    name: 'Sample Town, The Causeway',
  },
  destinations: {
    full: `The Boathouse; The Tide Pools; Sample Town; The Causeway`,
    summary: 'The Boathouse; The Tide Pools; Sample Town; The Causeway',
    name: 'The Boathouse, The Tide Pools, Sample Town, The Causeway',
  },
};

/** Full / summary / name renderings for one roster. */
const ENTITIES: Record<string, { full: string; summary: string; name: string }> = {
  '': {
    full: `Wren - the lamp-keeper, grey-haired and unhurried, who has watched this shore longer than anyone
will admit. Carries a hooked pole she uses for everything but its purpose.
A gull - too fat to be wild, waiting on the post as if owed something.`,
    summary: 'Wren - the unhurried lamp-keeper. A gull - fat, waiting, owed something.',
    name: 'Wren, a gull',
  },
  sublocations: {
    full: `Bell - a boat-mender working by feel in the dark of the boathouse, talking to the hull.`,
    summary: 'Bell - a boat-mender working in the dark.',
    name: 'Bell',
  },
  reachable: {
    full: `Harrow - the man who sells maps in Sample Town, and is not currently at his stall.`,
    summary: 'Harrow - the map-seller, absent from his stall.',
    name: 'Harrow',
  },
  inscene: {
    full: `Wren - the lamp-keeper, mid-sentence, holding the pole across her body like a bar.`,
    summary: 'Wren - the lamp-keeper, mid-sentence.',
    name: 'Wren',
  },
};

const STAT_ROWS = [
  { name: 'Health', range: '82/100', status: 'Bruised', meaning: 'How much punishment the body still has in it.' },
  { name: 'Resolve', range: '40/100', status: 'Fraying', meaning: 'The will to keep going when it stops being sensible.' },
  { name: 'Standing', range: '15/100', status: 'A stranger', meaning: 'How the coast reckons the traveler.' },
];

/** One stat line from whichever pieces the token's toggles selected. The Name is always present. */
function statLine(row: (typeof STAT_ROWS)[number], sel: Record<string, string | null>): string {
  const parts = [row.name];
  if (sel.numbers != null) parts.push(row.range);
  if (sel.descriptions != null) parts.push(row.status);
  const head = parts.join(': ');
  return sel.meaning != null ? `${head} - ${row.meaning}` : head;
}

/** Shape a block the way the format axis asks, so a prompt's section reads the way it will in play. */
function format(body: string, fmt: string | null, tag: string): string {
  const lines = body.split('\n').filter(Boolean);
  if (fmt === 'markdown') return lines.map((l) => `- ${l.replace(/^([^-:]+)( - | *: *)/, '**$1**$2')}`).join('\n');
  if (fmt === 'xml') return lines.map((l) => `<${tag}>${l}</${tag}>`).join('\n');
  return lines.join('\n');
}

/** Pick the full/summary/name rendering the content axis asked for. */
function byContent(entry: { full: string; summary: string; name: string }, content: string | null): string {
  if (content === 'name') return entry.name;
  if (content === 'summary') return entry.summary;
  return entry.full;
}

/** The sample value for one concrete token, decoded through its variable's own axes. */
function sampleFor(variable: PromptVariable, variantId: string | null): string {
  const sel = decodeVariant(variable, variantId);
  switch (variable.token) {
    case '<WORLD DESCRIPTION>':
      return WORLD;
    case '<STATS DESCRIPTION>': {
      // Every toggle off would render bare names, which no real prompt does; treat it as the default trio.
      const chosen = sel.numbers == null && sel.descriptions == null && sel.meaning == null
        ? { numbers: 'numbers', descriptions: 'descriptions', meaning: null }
        : sel;
      return format(STAT_ROWS.map((r) => statLine(r, chosen)).join('\n'), sel.format, 'stat');
    }
    case '<TRAITS DESCRIPTION>':
      return format(TRAITS, sel.format, 'trait');
    case '<LOCATION>':
      return format(byContent(LOCATIONS[sel.scope ?? ''] ?? LOCATIONS[''], sel.content), sel.format, 'location');
    case '<ENTITIES>':
      return format(byContent(ENTITIES[sel.scope ?? ''] ?? ENTITIES[''], sel.content), sel.format, 'entity');
    case '<NOTES>':
      return NOTES;
    case '<TIME>':
      return TIME;
    case '<DICTIONARY>':
      return variantId === 'before' ? DICTIONARY_BEFORE : DICTIONARY_AFTER;
    case '<PLAYER ACTION>':
      return 'I ask her who else has been down here tonight.';
    case '<NARRATION>':
      return `Wren doesn't look up from the lamp. "Nobody worth the asking," she says, and the pole shifts
against her shoulder. Out past the pilings something knocks twice against stone, and stops.`;
    case '<CHARACTER NAME>':
      return 'Wren';
    case '<IN FRAME>':
      return 'Wren, the traveler';
    case '<SUBJECT>':
      return 'a weathered lamp-keeper on a stone shore';
    default:
      return 'sample value';
  }
}

/**
 * Every token the chip vocabulary can produce, mapped to sample content — generated from the variables'
 * own variant lists rather than hand-listed, so a token added to the registry cannot silently arrive here
 * with no value and render as raw `<TOKEN>` in a preview.
 */
export const SAMPLE_PREVIEW_VALUES: Record<string, string> = Object.fromEntries(
  ALL_PROMPT_VARIABLES
    // The derived layer owns these; a sample here would shadow the player's real setting.
    .filter((variable) => !DERIVED_TOKENS.includes(variable.token))
    .flatMap((variable) =>
      [null, ...variableVariantIds(variable)].map((id) => [
        withVariant(baseToken(variable.token), id),
        sampleFor(variable, id),
      ]),
    ),
);


/** Settings the derived layer reads. Exactly the inputs the real guidance functions take. */
export interface DerivedPreviewSettings {
  paragraphLimit: ParagraphLimit;
  maxTokens: number;
  markdownOutput: boolean;
  sectionStyle: SectionStyle;
  limitActiveCharacters: boolean;
  activeCharacterLimit: number;
  /** The AI Language setting, as the language chip renders it. */
  language: string;
}

/**
 * The language chip's value for one prompt surface. The two surfaces that offer the chip name themselves in
 * the directive, so a preview has to be told which one it is rendering; the pool's own entry is the
 * narration wording, and the choices field layers this over it.
 */
export function languagePreviewValue(surface: LanguageSurface, language: string): Record<string, string> {
  return { '<LANGUAGE>': languageDirective(surface, language) };
}

/**
 * The tokens whose real value follows from settings alone, so a preview shows what the model would truly be
 * told rather than a stand-in. Kept out of the sample layer — a sample here would quietly shadow the truth.
 */
export function derivedPreviewValues(s: DerivedPreviewSettings): Record<string, string> {
  return {
    '<LENGTH GUIDANCE>': lengthGuidance(s.paragraphLimit, s.maxTokens),
    '<MARKDOWN GUIDANCE>': restyle(markdownGuidance(s.markdownOutput), s.sectionStyle),
    '<ACTIVE CHARACTER GUIDANCE>': activeCharacterGuidance(s.limitActiveCharacters, s.activeCharacterLimit),
    ...languagePreviewValue('narration', s.language),
  };
}

/**
 * The values a Preview should use: samples underneath, real settings-derived guidance over them, and a live
 * game's own context over that. Callers pass `live` only when a playthrough is running.
 */
export function composePreviewValues(
  settings: DerivedPreviewSettings,
  live?: Record<string, string>,
): Record<string, string> {
  return { ...SAMPLE_PREVIEW_VALUES, ...derivedPreviewValues(settings), ...(live ?? {}) };
}
