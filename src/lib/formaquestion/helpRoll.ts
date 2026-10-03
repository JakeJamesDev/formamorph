/**
 * The help dice roll: a fixed function of Formaquestion. It runs the catalog roll's handler with the
 * catalog roll's parameters, under a description written for a help chat, which has no story.
 */
import { DEFAULT_TOOL_CALL_LIMIT } from '@/contexts/settingsDefaults';
import { ROLL } from '@/lib/tools/rollTool';
import type { Tool } from '@/types';

/** The default most roll calls one help question runs: the catalog roll's limit. */
export const HELP_ROLL_CALL_LIMIT = DEFAULT_TOOL_CALL_LIMIT;

export const HELP_ROLL: Tool = {
  ...ROLL,
  id: 'help-roll',
  description: [
    'Purpose: Roll dice for a fair random result.',
    'Use when: The player asks you to roll dice. Call it once for each roll the player asks for, then give the player the total.',
    'Input: dice — the dice the player names, in dice notation: the count, the letter d, the number of sides, and an optional plus or minus modifier. Use 1 to 100 dice with 2 to 1000 sides, and a modifier from -1000 to 1000.',
    'Output: JSON with dice, rolls (each die), modifier, and total. Use the total as the result. Bad notation returns text that explains the problem.',
  ].join('\n'),
  offeredTo: [],
};
