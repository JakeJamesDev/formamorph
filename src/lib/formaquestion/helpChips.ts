/**
 * The chips of the help prompts: the parts the app reads back or names elsewhere, so a power user cannot
 * retype them by accident. Each chip stands for one text, and a prompt with no chip gets none of it.
 */
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { plainVocabulary } from '@/lib/chipVocabulary';
import { HIGHLIGHT_PALETTE } from '@/lib/highlightUtils';
import type { PromptSegment } from '@/lib/promptTemplate';
import { DOCS_LOOKUP } from './docsLookup';
import { GENERAL_KNOWLEDGE_MARKER } from './generalKnowledge';
import { HELP_PICK_LIMIT } from './helpPicks';
import type { HelpPromptKey } from './helpPrompt';
import type { HelpSettings } from './helpSettings';
import { activeMascotRig } from './mascotPresets';

/** A help chip's token in the stored text. */
export const HELP_CHIP = {
  marker: '<NOT_IN_GUIDE>',
  lookupFunction: '<LOOKUP_FUNCTION>',
  pickLimit: '<PICK_LIMIT>',
  replyFormat: '<REPLY_FORMAT>',
  voice: '<VOICE>',
} as const;

export type HelpChipToken = (typeof HELP_CHIP)[keyof typeof HELP_CHIP];

/** The chip texts that come with each question. */
export interface HelpChipValues {
  /** The Mascot's Voice while the mascot is on, else empty. */
  readonly voice: string;
}

const NO_VALUES: HelpChipValues = { voice: '' };

/** The chip values a prompt's request sends: the active mascot's Voice, trimmed, while the mascot is on; the pick request sends none. */
export const helpChipValues = (prompt: HelpPromptKey, { mascot, mascotPresets }: Pick<HelpSettings, 'mascot' | 'mascotPresets'>): HelpChipValues =>
  (prompt !== 'pick' && mascot ? { voice: activeMascotRig(mascotPresets).voice.trim() } : NO_VALUES);

/** A chip sends a fixed `text`, or the question's `value` of that name in its `frame`. An empty value sends nothing. */
type HelpChipEntry = { label: string; hint: string } & ({ text: string } | { value: keyof HelpChipValues; frame: (value: string) => string });

/** The Voice with the lines that keep the guide's steps and names above its tone. */
export const frameVoice = (voice: string): string =>
  `Speak in this voice: ${voice}\nKeep that voice. Start with the answer, and write each step and control name as the guide writes it.`;

/** Each chip: its label on the chip, its tooltip, and the text it sends. */
export const HELP_CHIPS: Record<HelpChipToken, HelpChipEntry> = {
  [HELP_CHIP.marker]: {
    label: 'Not in Guide Marker',
    hint: 'Marks an answer as general knowledge when the guide does not cover the question, so the notice shows',
    text: GENERAL_KNOWLEDGE_MARKER,
  },
  [HELP_CHIP.lookupFunction]: {
    label: 'Lookup Function',
    hint: 'Names the function your AI calls to read more guide sections',
    text: DOCS_LOOKUP.name,
  },
  [HELP_CHIP.pickLimit]: {
    label: 'Search Limit',
    hint: 'Caps how many sections one search reply names',
    text: String(HELP_PICK_LIMIT),
  },
  [HELP_CHIP.replyFormat]: {
    label: 'Reply Format',
    hint: 'Sets how the search reply is written, so the app can read it',
    text: '- Reply with the lines of your picks alone, one on each line, each copied as the list writes it.',
  },
  [HELP_CHIP.voice]: {
    label: 'Mascot Voice',
    hint: "Sends your mascot's Voice while the mascot is on",
    value: 'voice',
    frame: frameVoice,
  },
};

const TOKENS = Object.keys(HELP_CHIPS) as HelpChipToken[];
const CHIP_RE = new RegExp(TOKENS.map((token) => token.replace(/[<>]/g, '\\$&')).join('|'), 'g');

const isHelpChip = (token: string): token is HelpChipToken => token in HELP_CHIPS;

/** Splits a help prompt into literal runs and chips. Any other `<...>` is text. */
export function parseHelpPrompt(text: string): PromptSegment[] {
  const segments: PromptSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(CHIP_RE)) {
    if (match.index > last) segments.push({ type: 'text', value: text.slice(last, match.index) });
    segments.push({ type: 'variable', token: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments;
}

function chipText(token: HelpChipToken, values: HelpChipValues): string {
  const entry = HELP_CHIPS[token];
  if ('text' in entry) return entry.text;
  const value = values[entry.value];
  return value && entry.frame(value);
}

/** A line that holds one chip alone, with the chip's text empty. */
function isEmptyChipLine(line: string, values: HelpChipValues): boolean {
  const token = line.trim();
  return isHelpChip(token) && chipText(token, values) === '';
}

/** The lines without each empty chip line. A line that stood as its own paragraph takes one blank line with it. */
function dropEmptyChipLines(lines: readonly string[], values: HelpChipValues): string[] {
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isEmptyChipLine(lines[i], values)) {
      kept.push(lines[i]);
      continue;
    }
    const blankBefore = kept.length === 0 || kept[kept.length - 1].trim() === '';
    const blankAfter = i === lines.length - 1 || lines[i + 1].trim() === '';
    if (!blankBefore || !blankAfter) continue;
    if (i < lines.length - 1) i++;
    else kept.pop();
  }
  return kept;
}

/** The prompt as the request carries it: each chip replaced by its text, and each empty chip line gone. */
export function renderHelpPrompt(text: string, values: HelpChipValues = NO_VALUES): string {
  const kept = dropEmptyChipLines(text.split('\n'), values).join('\n');
  return parseHelpPrompt(kept)
    .map((segment) => (segment.type === 'text' ? segment.value : isHelpChip(segment.token) ? chipText(segment.token, values) : segment.token))
    .join('');
}

/** Each chip's token mapped to the text it sends with `values`, for a prompt's Preview. */
export const helpChipPreview = (values: HelpChipValues): Record<string, string> =>
  Object.fromEntries(TOKENS.map((token) => [token, chipText(token, values)]));

// One palette entry for every help chip: the family is a few app texts, not a scene.
const HELP_CHIP_COLOR = HIGHLIGHT_PALETTE[7];

/** The chip family of one help prompt editor. The palette offers `chips`, the chips that prompt reads back. */
export function helpChipVocabulary(chips: readonly HelpChipToken[]): ChipVocabulary {
  return {
    ...plainVocabulary(),
    parse: parseHelpPrompt,
    isKnown: isHelpChip,
    label: (token) => (isHelpChip(token) ? HELP_CHIPS[token].label : token),
    hint: (token) => (isHelpChip(token) ? HELP_CHIPS[token].hint : undefined),
    color: () => HELP_CHIP_COLOR,
    palette: () => chips.map((token) => ({ token, label: HELP_CHIPS[token].label, color: HELP_CHIP_COLOR })),
    acceptsPaletteToken: (token) => isHelpChip(token) && chips.includes(token),
  };
}
