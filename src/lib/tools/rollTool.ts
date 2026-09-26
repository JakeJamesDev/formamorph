import type { Tool } from '@/types';

// The player can open this script in the Tool editor, so it stays short enough to read and trust.
const ROLL_SCRIPT = `// Reads dice notation such as 2d6+1, d20, or 1d20-2. Spaces and case don't matter.
const EXAMPLE = 'Use dice notation like 2d6+1.';
const match = /^(\\d*)d(\\d+)([+-]\\d+)?$/.exec(args.dice.replace(/\\s+/g, '').toLowerCase());
if (!match) return 'Unreadable dice notation. ' + EXAMPLE;

const count = match[1] === '' ? 1 : Number(match[1]);
const sides = Number(match[2]);
const modifier = match[3] ? Number(match[3]) : 0;
if (count < 1 || count > 100) return 'The dice count must be 1 to 100. ' + EXAMPLE;
if (sides < 2 || sides > 1000) return 'Each die needs 2 to 1000 sides. ' + EXAMPLE;
if (modifier < -1000 || modifier > 1000) return 'The modifier must be -1000 to 1000. ' + EXAMPLE;

const rolls = [];
for (let i = 0; i < count; i++) rolls.push(1 + Math.floor(Math.random() * sides));

let total = modifier;
for (const die of rolls) total += die;
const shown = count + 'd' + sides + (modifier > 0 ? '+' + modifier : modifier < 0 ? String(modifier) : '');
return { dice: shown, rolls, modifier, total };`;

/** The dice roller. The description is a draft until its narration probe (ticket 07). */
export const ROLL: Tool = {
  id: 'roll',
  name: 'roll',
  description: [
    'Purpose: Roll dice for a fair random result.',
    'Use when: An action or event has an uncertain outcome that chance decides, such as an attack, a skill check, or a game of luck. Roll before you narrate the outcome, then narrate the outcome the total gives.',
    'Input: dice — dice notation, such as 1d20, 2d6+1, or 1d20-2. Use 1 to 100 dice with 2 to 1000 sides, and a modifier from -1000 to 1000.',
    'Output: JSON with dice, rolls (each die), modifier, and total. Use the total as the result. Bad notation returns text that explains the problem.',
  ].join('\n'),
  params: [{ name: 'dice', type: 'string', description: 'Dice notation, such as 2d6+1.', required: true, options: [] }],
  handler: { kind: 'script', code: ROLL_SCRIPT },
  emptyResult: 'Use dice notation like 2d6+1.',
  offeredTo: ['narration'],
};
