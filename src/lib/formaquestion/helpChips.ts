/**
 * The chips of the help prompts: the parts the app reads back or names elsewhere, so a power user cannot
 * retype them by accident. Each chip stands for one fixed text, and a prompt with no chip gets none of it.
 */
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { plainVocabulary } from '@/lib/chipVocabulary';
import { HIGHLIGHT_PALETTE } from '@/lib/highlightUtils';
import type { PromptSegment } from '@/lib/promptTemplate';
import { DOCS_LOOKUP } from './docsLookup';
import { GENERAL_KNOWLEDGE_MARKER } from './generalKnowledge';
import { HELP_PICK_LIMIT } from './helpPicks';

/** A help chip's token in the stored text. */
export const HELP_CHIP = {
  marker: '<NOT_IN_GUIDE>',
  lookupFunction: '<LOOKUP_FUNCTION>',
  pickLimit: '<PICK_LIMIT>',
  replyFormat: '<REPLY_FORMAT>',
} as const;

export type HelpChipToken = (typeof HELP_CHIP)[keyof typeof HELP_CHIP];

interface HelpChipEntry {
  label: string;
  hint: string;
  /** The text the chip sends. */
  text: string;
}

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
    label: 'Pick Limit',
    hint: 'Caps how many sections one pick reply names',
    text: String(HELP_PICK_LIMIT),
  },
  [HELP_CHIP.replyFormat]: {
    label: 'Reply Format',
    hint: 'Sets how the pick reply is written, so the picks can be read',
    text: '- Reply with the lines of your picks alone, one on each line, each copied as the list writes it.',
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

/** The prompt as the request carries it: each chip replaced by its text. */
export function renderHelpPrompt(text: string): string {
  return parseHelpPrompt(text).map((segment) => (segment.type === 'variable' && isHelpChip(segment.token) ? HELP_CHIPS[segment.token].text : segment.type === 'text' ? segment.value : segment.token)).join('');
}

// One palette entry for every help chip: the family is four fixed texts, not a scene.
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
