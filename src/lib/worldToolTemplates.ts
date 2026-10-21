/**
 * The bundled World Tool templates, written around `args`. A `param` slot names the Parameter each one reads, so
 * the author picks it from their own Tool. On Call templates return a short reply; the others leave the Reply to
 * the Tool. Each reads its bounds from the stat it writes.
 */
import type { CodeTemplate } from './statCodeTemplates';

export const WORLD_TOOL_TEMPLATES: readonly CodeTemplate[] = [
  {
    id: 'builtin-tool-report-stat',
    kind: 'worldTool',
    timings: ['call'],
    name: 'Report a Stat',
    description: 'Return a stat’s value and range to the AI.',
    code: `const name = {{stat:stat}};
const stat = stats[name];
return name + " is " + stat.value + ", from " + stat.min + " to " + stat.max + ".";`,
  },
  {
    id: 'builtin-tool-roll-dice',
    kind: 'worldTool',
    timings: ['call'],
    name: 'Roll Dice',
    description: 'Roll a die with the sides the AI sent, and return the roll. When the AI sends no usable number, the die uses the default sides.',
    code: `const sent = Math.floor(Number(args[{{sides:param(number)=sides}}]));
const sides = sent >= 2 ? sent : {{defaultSides:number=20}};
const roll = Math.floor(Math.random() * sides) + 1;
return "Rolled " + roll + " on a d" + sides + ".";`,
  },
  {
    id: 'builtin-tool-change-stat',
    kind: 'worldTool',
    timings: ['call', 'after'],
    name: 'Change a Stat',
    description: 'Add the amount the AI sent to a stat, inside the stat’s range. A negative amount subtracts.',
    code: `const name = {{stat:stat}};
const stat = stats[name];
const amount = Number(args[{{amount:param(number)=amount}}]) || 0;
stat.value = Math.min(stat.max, Math.max(stat.min, stat.value + amount));
return name + " is now " + stat.value + ".";`,
  },
  {
    id: 'builtin-tool-move-location',
    kind: 'worldTool',
    timings: ['call', 'after'],
    name: 'Move to Location',
    description: 'Move the turn to the location the AI named. A name the world doesn’t hold fails the call.',
    code: `const place = String(args[{{place:param(string)=place}}] ?? "").trim();
if (place) location.move(place);
return place ? "Moved to " + place + "." : "No place to move to.";`,
  },
  {
    id: 'builtin-tool-pass-time',
    kind: 'worldTool',
    timings: ['call', 'after'],
    name: 'Pass Time',
    description: 'Advance the story clock by the minutes the AI sent.',
    code: `const minutes = Math.max(0, Math.round(Number(args[{{minutes:param(number)=minutes}}]) || 0));
if (minutes > 0) clock.advance(minutes);
return minutes + " minutes pass.";`,
  },
  {
    id: 'builtin-tool-discover-entity',
    kind: 'worldTool',
    timings: ['call', 'after'],
    name: 'Discover an Entity',
    description: 'Add the entity the AI named to the turn’s cast. The AI then describes them.',
    code: `const name = String(args[{{name:param(string)=name}}] ?? "").trim();
if (name) discover(name);
return name ? name + " joins the scene." : "No one to add.";`,
  },
  {
    id: 'builtin-tool-pin-memory',
    kind: 'worldTool',
    timings: ['call', 'after'],
    name: 'Pin a Memory',
    description: 'Pin the line the AI sent as a memory. A pinned memory goes with every request.',
    code: `const line = String(args[{{line:param(string)=line}}] ?? "").trim();
if (line) memories.pin(line);
return line ? "Pinned." : "Nothing to pin.";`,
  },
  {
    id: 'builtin-tool-diary-line',
    kind: 'worldTool',
    timings: ['after'],
    name: 'Add a Diary Line',
    description: 'Add the line the AI sent to an entity’s diary, after the AI’s own entry.',
    code: `const line = String(args[{{line:param(string)=line}}] ?? "").trim();
if (line) entities[{{entity:entity}}].diary(line);`,
  },
  {
    id: 'builtin-tool-highlight-name',
    kind: 'worldTool',
    timings: ['output'],
    name: 'Highlight a Name',
    description: 'Bold the name the AI sent in each later sentence of the turn. A sentence that already bolds it stays as written.',
    code: `const name = String(args[{{name:param(string)=name}}] ?? "").trim();
// A name the AI already bolded stays as it is.
if (name && !narration.sentence.includes("**" + name + "**")) {
  narration.sentence = narration.sentence.split(name).join("**" + name + "**");
}`,
  },
  {
    id: 'builtin-tool-replace-word',
    kind: 'worldTool',
    timings: ['output'],
    name: 'Replace a Word',
    description: 'Replace the word the AI sent with your own word in each later sentence of the turn.',
    code: `const word = String(args[{{word:param(string)=word}}] ?? "").trim();
if (word) narration.sentence = narration.sentence.split(word).join("{{replacement:text=[redacted]}}");`,
  },
];
