import { describe, expect, it } from 'vitest';
import { PROMPT_TEXT_DEFAULTS, defaultSystemPrompt } from '@/components/game/GamePrompts';
import type { Item, ItemCopy, ItemCopyWhere } from '@/types';
import { chipValues } from './chipValues/chipValues';
import type { ChipScene } from './chipValues/chipScene';
import { sampleChipScene, sampleWorld } from './chipValues/sampleScene';
import { activeValues, addPreset } from './promptPresets';
import { buildNarrationPrompt } from './turnPipeline/narrationPrompt';

const item = (id: string, name: string, text: Partial<Item> = {}): Item => ({
  id, name, statEffects: [], traitEffects: [], equipRequires: [], ...text,
});
let next = 0;
const copy = (itemId: string, where: ItemCopyWhere, extra: Partial<ItemCopy> = {}): ItemCopy => ({
  id: `c${next++}`, item: { kind: 'item', itemId }, where, quantity: 1, visibility: 'visible', ...extra,
});

const ITEMS = [
  item('blade', 'Notched Blade', { aiSummary: 'A sword with a chipped edge.', aiDescription: 'A long story.' }),
  item('cloak', 'Gray Cloak', { aiDescription: 'Wool, patched at the hem.' }),
  item('ring', 'Plain Ring'),
  item('coin', 'Copper Coin'),
];
/** The sample scene, at the Landing with Wren and the gull, holding `copies`. */
const scene = (copies: ItemCopy[]): ChipScene => ({ ...sampleChipScene(), items: ITEMS, itemCopies: copies });
const render = (copies: ItemCopy[], key = '<INVENTORY|markdown>') => chipValues(scene(copies))(key);

describe('the Inventory chip', () => {
  it("lists each present owner's equipped items with their summary, then carried items by name", () => {
    expect(render([
      copy('blade', { kind: 'you' }, { equipped: { slotId: 'hand', order: 1 } }),
      copy('cloak', { kind: 'you' }, { equipped: { slotId: 'back', order: 2 } }),
      copy('ring', { kind: 'you' }, { equipped: { slotId: 'finger', order: 3 } }),
      copy('coin', { kind: 'you' }, { quantity: 3 }),
      copy('ring', { kind: 'entity', id: 'wren' }),
    ])).toBe([
      '- **Traveler**',
      '  - **equipped:** Notched Blade: A sword with a chipped edge.',
      // No summary: the AI Description stands in; with neither, the name alone.
      '  - **equipped:** Gray Cloak: Wool, patched at the hem.',
      '  - **equipped:** Plain Ring',
      '  - **carried:** Copper Coin (×3)',
      '- **Wren**',
      '  - **carried:** Plain Ring',
      '',
    ].join('\n'));
  });

  it('lists the items lying at the location, hidden ones marked hidden', () => {
    expect(render([
      copy('coin', { kind: 'location', id: 'landing' }, { quantity: 2 }),
      copy('ring', { kind: 'location', id: 'landing' }, { visibility: 'hidden' }),
      copy('coin', { kind: 'location', id: 'landing' }, { quantity: 4, visibility: 'hidden' }),
    ])).toBe('- **The Landing**\n  - **lying here:** Copper Coin (×2), Plain Ring (hidden), Copper Coin (×4, hidden)\n');
  });

  it('marks a hidden owned item hidden too', () => {
    expect(render([copy('blade', { kind: 'entity', id: 'wren' }, { visibility: 'hidden', equipped: { slotId: 'hand', order: 1 } })]))
      .toContain('**equipped:** Notched Blade (hidden): A sword with a chipped edge.');
  });

  it('leaves out owners and places that are not here', () => {
    // Bell stands in the Boathouse, and the coin lies there.
    expect(render([
      copy('ring', { kind: 'entity', id: 'bell' }),
      copy('coin', { kind: 'location', id: 'boathouse' }),
      copy('blade', { kind: 'entity', id: 'gull' }),
    ])).toBe('- **a gull**\n  - **carried:** Notched Blade\n');
  });

  it('gives an entity the player plays no block of its own: its items are the player\'s', () => {
    const played = { ...scene([copy('ring', { kind: 'entity', id: 'wren' })]), playedEntities: [sampleWorld().entities[0]] };
    expect(chipValues(played)('<INVENTORY|markdown>')).toBe('N/A');
  });

  it('leaves runtime items out', () => {
    expect(render([{ ...copy('coin', { kind: 'you' }), item: { kind: 'runtime', runtimeItemId: 'r1' } }])).toBe('N/A');
  });

  it('reads N/A when nobody here has an item', () => {
    expect(render([])).toBe('N/A');
    expect(chipValues({ ...sampleChipScene(), items: undefined, itemCopies: undefined })('<INVENTORY>')).toBe('N/A');
  });

  it('writes the plain and XML shapes', () => {
    const copies = [
      copy('blade', { kind: 'you' }, { equipped: { slotId: 'hand', order: 1 } }),
      copy('coin', { kind: 'location', id: 'landing' }, { visibility: 'hidden' }),
    ];
    expect(render(copies, '<INVENTORY>')).toBe(
      'Traveler\n  equipped: Notched Blade: A sword with a chipped edge.\nThe Landing\n  lying here: Copper Coin (hidden)\n',
    );
    expect(render(copies, '<INVENTORY|xml>')).toBe([
      '<owner>', '  <name>Traveler</name>', '  <equipped>Notched Blade: A sword with a chipped edge.</equipped>', '</owner>',
      '<location>', '  <name>The Landing</name>', '  <lying_here>Copper Coin (hidden)</lying_here>', '</location>', '',
    ].join('\n'));
  });
});

describe('the Inventory chip in the narration prompt', () => {
  const narration = (template: string, copies: ItemCopy[]) => buildNarrationPrompt({
    template, ctx: chipValues(scene(copies)), action: 'I look around.', history: [], dictionary: [], actionVec: null,
    semanticLore: false, embedVectors: new Map(), language: 'English', paragraphLimit: 'single', maxTokens: 1024,
    markdownOutput: false, sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
  const withoutChip = defaultSystemPrompt.replace(/<INVENTORY\|[^>]*>/, '');

  it('adds no text when nobody here has an item', () => {
    expect(defaultSystemPrompt).toMatch(/<INVENTORY\|/);
    expect(narration(defaultSystemPrompt, [])).toBe(narration(withoutChip, []));
  });

  it('sends the block under its header when someone has an item', () => {
    const prompt = narration(defaultSystemPrompt, [copy('ring', { kind: 'you' })]);
    expect(prompt).toContain('## Items Here');
    expect(prompt).toContain('- **Traveler**\n  - **carried:** Plain Ring');
  });

  it("leaves a user preset's narration prompt as its author stored it", () => {
    const stored = addPreset({ activeId: 'default', presets: [] }, 'mine', 'Mine', { ...PROMPT_TEXT_DEFAULTS, systemPrompt: withoutChip }, 'markdown');
    expect(activeValues(stored, { default: PROMPT_TEXT_DEFAULTS }).systemPrompt).toBe(withoutChip);
  });
});
