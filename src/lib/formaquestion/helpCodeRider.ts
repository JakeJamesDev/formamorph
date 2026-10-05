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

/** The rider of the Default preset. Each fence line ends its line, so the slot is the first word after the language. */
export const DEFAULT_CODE_RIDER = [
  'Write the stat code of this answer in this form:',
  '- Keep the numbered steps short.',
  `- Before each code block, name its box in one sentence: ${STAT_CODE_TIMINGS.map((slot) => `**${boxName(slot)}**`).join(' or ')}.`,
  '- Write the whole contents of each box as one fenced code block.',
  ...STAT_CODE_TIMINGS.map((slot) => `- Open the block of the **${boxName(slot)}** box with this line: \`\`\`${CODE_RIDER_LANGUAGE} ${slot}`),
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
