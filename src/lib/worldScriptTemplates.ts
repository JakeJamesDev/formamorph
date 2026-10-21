/**
 * The bundled world script templates. A world script has no stat or trait of its own, so `self` and `owner`
 * are empty and each one names what it reads and writes through slots. None returns a value.
 */
import type { CodeTemplate } from './statCodeTemplates';

export const WORLD_SCRIPT_TEMPLATES: readonly CodeTemplate[] = [
  {
    id: 'builtin-world-opening-location',
    kind: 'worldScript',
    timings: ['start'],
    name: 'Opening Location',
    description: 'Move the opening turn to a location.',
    code: 'location.move({{place:location}});',
  },
  {
    id: 'builtin-world-time-while-trait',
    kind: 'worldScript',
    timings: ['before', 'after'],
    name: 'Advance Time While a Trait Is On',
    description: 'Advance the story clock by a set number of minutes each turn while a trait is on.',
    code: `if (traits[{{trait:trait}}].enabled) clock.advance({{minutes:number=30}});`,
  },
  {
    id: 'builtin-world-leave-when-empty',
    kind: 'worldScript',
    timings: ['after'],
    name: 'Leave When a Stat Runs Out',
    description: 'Move to a location when a stat reaches its Min.',
    code: `const stat = stats[{{stat:stat}}];
if (stat.value <= stat.min) location.move({{place:location}});`,
  },
  {
    id: 'builtin-world-placeholder-by-daypart',
    kind: 'worldScript',
    timings: ['before', 'start'],
    name: 'Placeholder by Daypart',
    description: 'Pin one value of a placeholder during one part of the day. Position 1 is the first value. A position past the last value pins nothing.',
    code: `const target = placeholders[{{placeholder:placeholder}}];
const value = target.values[{{position:number=1}} - 1];
if (clock.daypart === {{when:daypart=night}} && value !== undefined) target.pin(value);`,
  },
  {
    id: 'builtin-world-memory-on-trait',
    kind: 'worldScript',
    timings: ['switch'],
    name: 'Memory When a Trait Turns On',
    description: 'Pin a memory line when a trait turns on. The line is sent with every request. A switch-off pins nothing.',
    // The line sits in a template literal in the generated code, so an apostrophe or quote in it is safe.
    code: `if (trait.name !== {{trait:trait}} || !trait.enabled) return;
memories.pin(\`{{line:text=A change took hold.}}\`);`,
  },
  {
    id: 'builtin-world-diary-on-trait',
    kind: 'worldScript',
    timings: ['switch'],
    name: 'Diary Line When a Trait Turns On',
    description: 'Add a line to an entity’s diary when a trait turns on. A switch-off adds nothing.',
    code: `if (trait.name !== {{trait:trait}} || !trait.enabled) return;
entities[{{entity:entity}}].diary(\`{{line:text=Something changed today.}}\`);`,
  },
  {
    id: 'builtin-world-replace-word',
    kind: 'worldScript',
    timings: ['output'],
    name: 'Replace a Word',
    description: 'Replace one word with another in each narration sentence. The match uses the exact spelling and case.',
    // The word sits in a template literal in the generated code, so an apostrophe or quote in it is safe.
    code: `narration.sentence = narration.sentence.split(\`{{word:text=door}}\`).join(\`{{replacement:text=[redacted]}}\`);`,
  },
  {
    id: 'builtin-world-entity-follows-stat',
    kind: 'worldScript',
    timings: ['before', 'after'],
    name: 'Entity Stat Follows a Global Stat',
    description: 'Set one stat of an entity to the value of a global stat. The entity’s stat keeps its own range.',
    code: `entities[{{who:entity}}].stats[{{target:stat(who)}}].value = stats[{{source:stat}}].value;`,
  },
];
