import { describe, expect, it } from 'vitest';
import { PROMPT_TEXT_DEFAULTS, defaultSystemPrompt } from '@/components/game/GamePrompts';
import type { Currency, Item, ItemInstance, ItemInstanceWhere, Placement, PlayerStat } from '@/types';
import { chipValues } from './chipValues/chipValues';
import type { ChipScene } from './chipValues/chipScene';
import { sampleChipScene, sampleWorld } from './chipValues/sampleScene';
import { activeValues, addPreset } from './promptPresets';
import { buildNarrationPrompt } from './turnPipeline/narrationPrompt';

const item = (id: string, name: string, text: Partial<Item> = {}): Item => ({
  id, name, statEffects: [], traitEffects: [], equipRequires: [], ...text,
});
let next = 0;
const instance = (itemId: string, where: ItemInstanceWhere, extra: Partial<ItemInstance> = {}): ItemInstance => ({
  id: `c${next++}`, item: { kind: 'item', itemId }, where, quantity: 1, visibility: 'visible', ...extra,
});

const ITEMS = [
  item('blade', 'Notched Blade', { aiSummary: 'A sword with a chipped edge.', aiDescription: 'A long story.' }),
  item('cloak', 'Gray Cloak', { aiDescription: 'Wool, patched at the hem.' }),
  item('ring', 'Plain Ring'),
  item('coin', 'Copper Coin'),
];
/** The sample scene with no money, at the Landing with Wren and the gull, holding `instances`. */
const scene = (instances: ItemInstance[]): ChipScene => ({ ...sampleChipScene(), items: ITEMS, itemInstances: instances, currencies: undefined, placements: undefined });
const render = (instances: ItemInstance[], key = '<INVENTORY|markdown>') => chipValues(scene(instances))(key);

describe('the Inventory chip’s money', () => {
  const COPPER = item('copper', 'Copper');
  const GOLD = item('gold', 'Gold');
  const MONEY: Currency = { id: 'coin', name: 'Coin', backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'gold', worth: 100 }] } };
  const CREDITS: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'funds' } };
  const GOATS: Currency = { id: 'goats', name: 'Goats', backing: { kind: 'name' } };
  const BLADE = item('blade', 'Notched Blade', { value: 105, currencyId: 'coin' });
  const ROPE = item('rope', 'Rope', { value: 12, currencyId: 'goats' });
  const purse = (where: Placement['where']): Placement => ({ id: 'p1', where, quantity: 1, source: { kind: 'item', itemId: 'gold' } });
  const money = (instances: ItemInstance[], over: Partial<ChipScene> = {}): ChipScene => ({
    ...scene(instances), items: [BLADE, ROPE, COPPER, GOLD, ...ITEMS.filter((i) => i.id === 'cloak')], currencies: [MONEY, GOATS], placements: [purse({ kind: 'entity', id: 'wren' })], ...over,
  });
  const read = (s: ChipScene, key = '<INVENTORY|markdown>') => chipValues(s)(key);

  it('names worth and balances in markdown, and shows an untracked owner none', () => {
    expect(read(money([
      instance('copper', { kind: 'you' }, { quantity: 105 }),
      instance('blade', { kind: 'you' }),
      instance('gold', { kind: 'entity', id: 'wren' }, { quantity: 2 }),
      instance('blade', { kind: 'entity', id: 'gull' }),
      instance('rope', { kind: 'location', id: 'landing' }),
    ]))).toBe([
      '- **Traveler**',
      '  - **balance:** 1 Gold, 5 Copper',
      '  - **carried:** Copper (×105), Notched Blade (worth 1 Gold, 5 Copper)',
      '- **Wren**',
      '  - **balance:** 2 Gold',
      '  - **carried:** Gold (×2)',
      '- **a gull**',
      '  - **carried:** Notched Blade (worth 1 Gold, 5 Copper)',
      '- **The Landing**',
      '  - **lying here:** Rope (worth 12 Goats)',
      '',
    ].join('\n'));
  });

  it('names worth and balances in xml', () => {
    const out = read(money([instance('copper', { kind: 'you' }, { quantity: 7 }), instance('blade', { kind: 'you' })]), '<INVENTORY|xml>');
    expect(out).toContain('<balance>7 Copper</balance>');
    expect(out).toContain('<carried>Copper (×7), Notched Blade (worth 1 Gold, 5 Copper)</carried>');
  });

  it('names worth and balances in plain text', () => {
    const out = read(money([instance('copper', { kind: 'you' }, { quantity: 7 }), instance('blade', { kind: 'you' })]), '<INVENTORY>');
    expect(out).toContain('  balance: 7 Copper\n');
    expect(out).toContain('  carried: Copper (×7), Notched Blade (worth 1 Gold, 5 Copper)\n');
  });

  it('gives each unit’s worth on a stack', () => {
    expect(read(money([instance('blade', { kind: 'you' }, { quantity: 3 })]))).toContain('Notched Blade (×3, worth 1 Gold, 5 Copper each)');
  });

  it('shows a tracked owner with nothing in hand, and at 0', () => {
    expect(read(money([]))).toBe('- **Traveler**\n  - **balance:** 0 Copper\n- **Wren**\n  - **balance:** 0 Copper\n');
  });

  it('puts an unidentified instance’s worth with its true face, never its visible one', () => {
    const cursed = item('cursed', 'Ring of Curses', { value: 7, currencyId: 'coin', aiSummary: 'Drains the wearer.', unidentifiedName: 'Dull Ring', unidentifiedDescription: 'A tarnished band.' });
    const out = read({ ...money([instance('cursed', { kind: 'you' }, { state: { unidentified: true } })]), items: [cursed, COPPER, GOLD] });
    expect(out).toContain('Dull Ring: A tarnished band. (unknown to the player: it is Ring of Curses, worth 7 Copper: Drains the wearer.)');
  });

  it('leaves a hidden item out of the balance and marks it hidden', () => {
    const out = read(money([instance('gold', { kind: 'you' }, { visibility: 'hidden' })]));
    expect(out).toContain('**balance:** 0 Copper');
    expect(out).toContain('Gold (hidden)');
  });

  it('reads a stat balance from the played persona, a Global Stat wallet, and a present entity', () => {
    const funds = (value: number) => ({ id: 'funds', value }) as PlayerStat;
    const base = money([], { currencies: [CREDITS], placements: [] });
    expect(read({ ...base, stats: [funds(9)], ownedStats: { wren: [funds(50)] } })).toBe('- **Traveler**\n  - **balance:** 9 Credits\n');
    expect(read({ ...base, playedStats: [{ ownerId: 'traveler', stats: [funds(40)] }], ownedStats: { wren: [funds(50)] } }))
      .toBe('- **Traveler**\n  - **balance:** 40 Credits\n- **Wren**\n  - **balance:** 50 Credits\n');
  });

  it('leaves a played entity’s block to the player, with one balance', () => {
    const played = money([instance('gold', { kind: 'you' })], { playedEntities: [sampleWorld().entities[0]] });
    expect(read(played)).toBe('- **Traveler**\n  - **balance:** 1 Gold\n  - **carried:** Gold\n');
  });

  it('stays byte-equal in a world with no Currencies, whatever an item stores', () => {
    const priced = { ...scene([instance('blade', { kind: 'you' }, { quantity: 2 })]), items: [BLADE] };
    expect(read(priced)).toBe('- **Traveler**\n  - **carried:** Notched Blade (×2)\n');
    expect(read({ ...priced, currencies: [], placements: [purse({ kind: 'entity', id: 'wren' })] })).toBe('- **Traveler**\n  - **carried:** Notched Blade (×2)\n');
    expect(read({ ...scene([]), items: [BLADE] })).toBe('N/A');
  });

  it('reads the sample scene’s worth and balances', () => {
    const out = chipValues(sampleChipScene())('<INVENTORY|markdown>');
    expect(out).toContain('**balance:** 1 Silver Crown, 4 Copper Bit');
    expect(out).toContain('**balance:** 3 Silver Crown');
    expect(out).toContain('Coil of Rope (worth 1 Silver Crown, 2 Copper Bit)');
    expect(out).toContain('Brass Compass (worth 15 Silver Crown)');
  });
});

describe('the Inventory chip', () => {
  it("lists each present owner's equipped items with their summary, then carried items by name", () => {
    expect(render([
      instance('blade', { kind: 'you' }, { equipped: { slotId: 'hand', order: 1 } }),
      instance('cloak', { kind: 'you' }, { equipped: { slotId: 'back', order: 2 } }),
      instance('ring', { kind: 'you' }, { equipped: { slotId: 'finger', order: 3 } }),
      instance('coin', { kind: 'you' }, { quantity: 3 }),
      instance('ring', { kind: 'entity', id: 'wren' }),
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
      instance('coin', { kind: 'location', id: 'landing' }, { quantity: 2 }),
      instance('ring', { kind: 'location', id: 'landing' }, { visibility: 'hidden' }),
      instance('coin', { kind: 'location', id: 'landing' }, { quantity: 4, visibility: 'hidden' }),
    ])).toBe('- **The Landing**\n  - **lying here:** Copper Coin (×2), Plain Ring (hidden), Copper Coin (×4, hidden)\n');
  });

  it('marks a hidden owned item hidden too', () => {
    expect(render([instance('blade', { kind: 'entity', id: 'wren' }, { visibility: 'hidden', equipped: { slotId: 'hand', order: 1 } })]))
      .toContain('**equipped:** Notched Blade (hidden): A sword with a chipped edge.');
  });

  it('gives each instance its State, then its uses left, before quantity and hidden', () => {
    const wand = item('wand', 'Ash Wand', { uses: 3 });
    const letter = item('letter', 'Letter', { uses: 1 });
    const text = chipValues({ ...scene([]), items: [...ITEMS, wand, letter], itemInstances: [
      instance('wand', { kind: 'you' }, { visibility: 'hidden', state: { uses: 2, state: 'lit' } }),
      instance('wand', { kind: 'you' }),
      instance('letter', { kind: 'you' }, { quantity: 2, state: { state: 'sealed' } }),
      instance('letter', { kind: 'you' }, { state: { uses: 0, state: 'opened' } }),
    ] })('<INVENTORY|markdown>');
    expect(text).toContain('**carried:** Ash Wand (lit, 2 of 3 uses left, hidden), Ash Wand (3 of 3 uses left), Letter (sealed, ×2), Letter (opened, no uses left)');
  });

  it('shows an unidentified instance by the face the player sees, then its true face marked unknown to the player (Q14, Q38)', () => {
    const cursed = item('cursed', 'Ring of Curses', {
      aiSummary: 'Drains the wearer.', unidentifiedName: 'Dull Ring', unidentifiedDescription: 'A tarnished band.',
    });
    const out = chipValues({ ...scene([
      instance('cursed', { kind: 'you' }, { state: { unidentified: true }, equipped: { slotId: 'finger', order: 1 } }),
      instance('cursed', { kind: 'location', id: 'landing' }, { state: { unidentified: true }, visibility: 'hidden' }),
      instance('cursed', { kind: 'you' }),
    ]), items: [...ITEMS, cursed] })('<INVENTORY|markdown>');
    expect(out).toContain('**equipped:** Dull Ring: A tarnished band. (unknown to the player: it is Ring of Curses: Drains the wearer.)');
    expect(out).toContain('**carried:** Ring of Curses\n');
    expect(out).toContain('**lying here:** Dull Ring (hidden): A tarnished band. (unknown to the player: it is Ring of Curses: Drains the wearer.)');
  });

  it('leaves out owners and places that are not here', () => {
    // Bell stands in the Boathouse, and the item lies there.
    expect(render([
      instance('ring', { kind: 'entity', id: 'bell' }),
      instance('coin', { kind: 'location', id: 'boathouse' }),
      instance('blade', { kind: 'entity', id: 'gull' }),
    ])).toBe('- **a gull**\n  - **carried:** Notched Blade\n');
  });

  it('gives an entity the player plays no block of its own: its items are the player\'s', () => {
    const played = { ...scene([instance('ring', { kind: 'entity', id: 'wren' })]), playedEntities: [sampleWorld().entities[0]] };
    expect(chipValues(played)('<INVENTORY|markdown>')).toBe('N/A');
  });

  it('names a runtime item by its name, and skips one the save does not list', () => {
    const runtime = (id: string): ItemInstance => ({ ...instance('coin', { kind: 'you' }), item: { kind: 'runtime', runtimeItemId: id } });
    const withRuntime = { ...scene([runtime('r1'), runtime('gone')]), runtimeItems: [{ id: 'r1', name: 'Rusty Key' }] };
    expect(chipValues(withRuntime)('<INVENTORY|markdown>')).toBe('- **Traveler**\n  - **carried:** Rusty Key\n');
  });

  it('gives a described runtime item a line of its own after the name line, carried or lying here (Q145)', () => {
    const runtime = (id: string, where: ItemInstanceWhere): ItemInstance => ({ ...instance('coin', where), item: { kind: 'runtime', runtimeItemId: id } });
    const described = {
      ...scene([instance('coin', { kind: 'you' }), runtime('r1', { kind: 'you' }), runtime('r1', { kind: 'location', id: 'landing' })]),
      runtimeItems: [{ id: 'r1', name: 'Odd Stone', description: 'A smooth black pebble.' }],
    };
    expect(chipValues(described)('<INVENTORY|markdown>')).toBe([
      '- **Traveler**',
      '  - **carried:** Copper Coin',
      '  - **carried:** Odd Stone: A smooth black pebble.',
      '- **The Landing**',
      '  - **lying here:** Odd Stone: A smooth black pebble.',
      '',
    ].join('\n'));
  });

  it('reads N/A when nobody here has an item', () => {
    expect(render([])).toBe('N/A');
    expect(chipValues({ ...sampleChipScene(), items: undefined, itemInstances: undefined, currencies: undefined })('<INVENTORY>')).toBe('N/A');
  });

  it('writes the plain and XML shapes', () => {
    const instances = [
      instance('blade', { kind: 'you' }, { equipped: { slotId: 'hand', order: 1 } }),
      instance('coin', { kind: 'location', id: 'landing' }, { visibility: 'hidden' }),
    ];
    expect(render(instances, '<INVENTORY>')).toBe(
      'Traveler\n  equipped: Notched Blade: A sword with a chipped edge.\nThe Landing\n  lying here: Copper Coin (hidden)\n',
    );
    expect(render(instances, '<INVENTORY|xml>')).toBe([
      '<owner>', '  <name>Traveler</name>', '  <equipped>Notched Blade: A sword with a chipped edge.</equipped>', '</owner>',
      '<location>', '  <name>The Landing</name>', '  <lying_here>Copper Coin (hidden)</lying_here>', '</location>', '',
    ].join('\n'));
  });
});

describe('the Inventory chip in the narration prompt', () => {
  const narration = (template: string, instances: ItemInstance[]) => buildNarrationPrompt({
    template, ctx: chipValues(scene(instances)), action: 'I look around.', history: [], dictionary: [], actionVec: null,
    semanticLore: false, embedVectors: new Map(), language: 'English', paragraphLimit: 'single', maxTokens: 1024,
    markdownOutput: false, sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
  const withoutChip = defaultSystemPrompt.replace(/<INVENTORY\|[^>]*>/, '');

  it('adds no text when nobody here has an item', () => {
    expect(defaultSystemPrompt).toMatch(/<INVENTORY\|/);
    expect(narration(defaultSystemPrompt, [])).toBe(narration(withoutChip, []));
  });

  it('sends the block under its header when someone has an item', () => {
    const prompt = narration(defaultSystemPrompt, [instance('ring', { kind: 'you' })]);
    expect(prompt).toContain('## Items Here');
    expect(prompt).toContain('- **Traveler**\n  - **carried:** Plain Ring');
  });

  it("leaves a user preset's narration prompt as its author stored it", () => {
    const stored = addPreset({ activeId: 'default', presets: [] }, 'mine', 'Mine', { ...PROMPT_TEXT_DEFAULTS, systemPrompt: withoutChip }, 'markdown');
    expect(activeValues(stored, { default: PROMPT_TEXT_DEFAULTS }).systemPrompt).toBe(withoutChip);
  });
});
