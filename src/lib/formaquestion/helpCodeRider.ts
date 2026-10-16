/**
 * The Code rider: the text a code turn adds to the user message of the answer request, so the answer gives
 * each script's code as one fenced block tagged with its timing. A code turn is one asked from a stat's Code
 * tab, or one whose question uses code words. Every other turn sends no rider.
 */
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { SCRIPT_TIMING_LABEL, SCRIPT_TIMINGS } from '@/lib/scripts';
import type { ScriptTiming } from '@/types';

/** The language the rider asks for, as the Scripts guide writes its fences. */
export const CODE_RIDER_LANGUAGE = 'javascript';

/** The stat panel's Code tab, as the surface registry reports it. */
export const SCRIPT_TAB: SurfaceId = 'worldEditorStat.code';

const boxName = (timing: ScriptTiming) => SCRIPT_TIMING_LABEL[timing];
/** When each box runs, so a small model picks the box by the task's moment, not by its label. */
const RUNS_WHEN: Record<ScriptTiming, string> = {
  before: 'at the start of each turn',
  after: 'at the end of each turn',
  output: 'once for each narration sentence',
  start: 'once when a new game begins',
  switch: 'each time a trait turns on or off',
};

/**
 * The rider of the Default preset. Each fence line ends its line, so the timing is the first word after the language.
 * The line above them says why the timing is there. It reads only what every script home shares; the home line adds the rest.
 * It names the sandbox objects, since without them the model invents variable names that throw.
 */
export const DEFAULT_CODE_RIDER = [
  'The player wants a script. Answer with a fenced block of working JavaScript that does the whole task:',
  '- Write the code yourself from the rules in the guide sections. The guide has no script for most tasks.',
  `- Write the whole contents of the box the task needs. Pick the box by when it runs: ${SCRIPT_TIMINGS.map((timing) => `**${boxName(timing)}** ${RUNS_WHEN[timing]}`).join(', ')}. Name the box in one sentence. Then give the block.`,
  '- Read the script\'s home as `self`, the world\'s stats through `stats`, traits through `traits`, placeholders through `placeholders`, and the time through `clock`.',
  `- The app reads the word after \`${CODE_RIDER_LANGUAGE}\` on the opening line to put the code in the right box: ${SCRIPT_TIMINGS.map((timing) => `\`${timing}\` for **${boxName(timing)}**`).join(', ')}.`,
  ...SCRIPT_TIMINGS.map((timing) => `- Start the block of the **${boxName(timing)}** box with this line: \`\`\`${CODE_RIDER_LANGUAGE} ${timing}`),
  '- After the block, write at most three short steps.',
].join('\n');

/**
 * The names the script sandbox injects. A copy, so the help bundle does not pull in the sandbox engine; a
 * drift test holds it to the sandbox's own list.
 */
export const SANDBOX_GLOBAL_NAMES = ['self', 'owner', 'stats', 'clock', 'placeholders', 'traits', 'entities', 'persona', 'dictionaries', 'console'] as const;

const GLOBALS = SANDBOX_GLOBAL_NAMES.join('|');

/**
 * The code words of a question. Plain words match as words. A sandbox name matches only as code, followed by
 * a member or an index, since "traits" and "persona" are also ordinary words; `return` and `function` match
 * only in code form for the same reason.
 */
const CODE_WORDS: readonly RegExp[] = [
  /\b(?:code|scripts?|javascript)\b/i,
  new RegExp(`\\b(?:${SCRIPT_TIMINGS.map((timing) => boxName(timing).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|')})\\b`, 'i'),
  new RegExp(`\\b(?:${GLOBALS})(?:\\.[A-Za-z_$]|\\[)`),
  new RegExp(`\\breturn\\s+(?:-?\\d|(?:${GLOBALS}|Math)\\b|[A-Za-z_$][\\w$]*\\s*[.[(;])`),
  /\bfunction\s*\(|=>/,
];

/** True when the question uses a code word. */
export const hasCodeWords = (question: string): boolean => CODE_WORDS.some((word) => word.test(question));

/** The Scripts Guide section that lists the whole sandbox API. Every code turn sends it. */
export const QUICK_REFERENCE_SECTION = 'ScriptsGuide#quick-reference';

/** True when a stat's Code tab is open. */
export const isOnCodeTab = (surface?: Surface | null): boolean => surface?.tabs.includes(SCRIPT_TAB) === true;

/** The line for the open script home, naming what `self` and the owner read there; null off a home. */
export const scriptHomeLine = (surface?: Surface | null): string | null =>
  (isOnCodeTab(surface) ? '- This is a stat\'s script: `self` is the stat, and `owner.stats` reads the stats of the entity that owns it.' : null);

/** True when the turn rides the rider: a stat's Code tab is open, or the question uses a code word. */
export const isCodeTurn = (question: string, surface?: Surface | null): boolean => isOnCodeTab(surface) || hasCodeWords(question);

/** The rider with a line after it. An empty rider gives the line alone. */
export const withRiderLine = (rider: string, line: string): string => (rider.trim() ? `${rider.trimEnd()}\n${line}` : line);

/** The user message with the rider after it. An empty rider leaves the message as it is. */
export const withCodeRider = (message: string, rider: string): string => (rider.trim() ? `${message}\n\n${rider}` : message);
