/**
 * The Code rider: the text a code turn adds to the user message of the answer request, so the answer gives
 * each stat box's code as one fenced block tagged with its slot. A code turn is one asked from a stat's Code
 * tab, or one whose question uses code words. Every other turn sends no rider.
 */
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { STAT_CODE_TIMINGS, TIMING_LABEL, type StatCodeTiming } from '@/lib/statCodeTiming';

/** The language the rider asks for, as the Stat Code guide writes its fences. */
export const CODE_RIDER_LANGUAGE = 'javascript';

/** The stat panel's Code tab, as the surface registry reports it. */
export const STAT_CODE_TAB: SurfaceId = 'worldEditorStat.code';

const boxName = (slot: StatCodeTiming) => TIMING_LABEL[slot];

/**
 * The rider of the Default preset. Each fence line ends its line, so the slot is the first word after the language.
 * It names the sandbox objects, since without them the model invents variable names that throw.
 */
export const DEFAULT_CODE_RIDER = [
  'The player wants stat code. Answer with a fenced block of working JavaScript that does the whole task:',
  '- Write the code yourself from the rules in the guide sections. The guide has no script for most tasks.',
  `- Write the whole contents of the box the task needs. Name the box in one sentence:${STAT_CODE_TIMINGS.map((slot) => `**${boxName(slot)}**`).join(' or ')}. Then give the block.`,
  '- Read the stat whose code it is as `self`, other stats through `stats`, traits through `traits`, placeholders through `placeholders`, and the time through `clock`.',
  ...STAT_CODE_TIMINGS.map((slot) => `- Start the block of the **${boxName(slot)}** box with this line: \`\`\`${CODE_RIDER_LANGUAGE} ${slot}`),
  '- After the block, write at most three short steps.',
].join('\n');

/**
 * The names the stat-code sandbox injects. A copy, so the help bundle does not pull in the sandbox engine; a
 * drift test holds it to the sandbox's own list.
 */
export const SANDBOX_GLOBAL_NAMES = ['self', 'stats', 'clock', 'placeholders', 'traits', 'entities', 'persona', 'dictionaries', 'console'] as const;

const GLOBALS = SANDBOX_GLOBAL_NAMES.join('|');

/**
 * The code words of a question. Plain words match as words. A sandbox name matches only as code, followed by
 * a member or an index, since "traits" and "persona" are also ordinary words; `return` and `function` match
 * only in code form for the same reason.
 */
const CODE_WORDS: readonly RegExp[] = [
  /\b(?:code|scripts?|javascript)\b/i,
  new RegExp(`\\b(?:${STAT_CODE_TIMINGS.map(boxName).join('|')})\\b`, 'i'),
  new RegExp(`\\b(?:${GLOBALS})(?:\\.[A-Za-z_$]|\\[)`),
  new RegExp(`\\breturn\\s+(?:-?\\d|(?:${GLOBALS}|Math)\\b|[A-Za-z_$][\\w$]*\\s*[.[(;])`),
  /\bfunction\s*\(|=>/,
];

/** True when the question uses a code word. */
export const hasCodeWords = (question: string): boolean => CODE_WORDS.some((word) => word.test(question));

/** True when the turn rides the rider: a stat's Code tab is open, or the question uses a code word. */
export const isCodeTurn = (question: string, surface?: Surface | null): boolean =>
  surface?.tabs.includes(STAT_CODE_TAB) === true || hasCodeWords(question);

/** The user message with the rider after it. An empty rider leaves the message as it is. */
export const withCodeRider = (message: string, rider: string): string => (rider.trim() ? `${message}\n\n${rider}` : message);
