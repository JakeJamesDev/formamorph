/**
 * The bundled item script templates. `self` is the item and `instance` the Item Instance the event happened to,
 * so each one reads the event from `args`. None returns a value.
 */
import type { CodeTemplate } from './statCodeTemplates';

export const ITEM_SCRIPT_TEMPLATES: readonly CodeTemplate[] = [
  {
    id: 'builtin-item-gift-raises-stat',
    kind: 'itemScript',
    timings: ['gained'],
    name: 'Gift Raises a Stat',
    description: 'Raise a stat of whoever gets this item when the player gives it. A buy, a sale, a gift from someone else and a script’s transfer raise nothing.',
    // The stat name is in a template literal in the generated code, so an apostrophe or quote in it is safe.
    code: `if (args.from !== persona || args.purchase || args.by === 'script') return;
const stat = owner.stats && owner.stats[\`{{stat:text=Affection}}\`];
if (stat) stat.value += {{amount:number=1}};`,
  },
];
