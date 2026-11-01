import { describe, expect, it } from 'vitest';
import { defaultInventoryPrompt, defaultInventoryUserPrompt, defaultSystemPrompt } from '@/components/game/GamePrompts';
import type { Body, Item, ItemCopy, ItemCopyWhere, Slot } from '@/types';
import { authoredChipScene } from './chipValues/authoredScene';
import { chipValues } from './chipValues/chipValues';
import type { ChipScene, SceneEquipment } from './chipValues/chipScene';
import { sampleChipScene, sampleWorld } from './chipValues/sampleScene';
import { buildNarrationPrompt } from './turnPipeline/narrationPrompt';
import { inventoryRequest } from './turnPipeline/turnPasses';

const item = (id: string, name: string, text: Partial<Item> = {}): Item => ({
  id, name, statEffects: [], traitEffects: [], equipRequires: [], ...text,
});
let next = 0;
const copy = (itemId: string, where: ItemCopyWhere, extra: Partial<ItemCopy> = {}): ItemCopy => ({
  id: `s${next++}`, item: { kind: 'item', itemId }, where, quantity: 1, visibility: 'visible', ...extra,
});

const SLOTS: Slot[] = [{ id: 'head', name: 'Head' }, { id: 'hand', name: 'Hand' }, { id: 'collar', name: 'Collar' }];
const HUMANOID: Body = { id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'head' }, { slotId: 'hand', capacity: 2 }] };
const BEAST: Body = { id: 'beast', name: 'Beast', entries: [{ slotId: 'collar' }] };
const ITEMS = [
  item('helm', 'Iron Helm', { slotRule: { mode: 'either', slotIds: ['head'] } }),
  item('pike', 'Long Pike', { slotRule: { mode: 'all', slotIds: ['hand', 'head'] }, aiSummary: 'A pike taller than a man.' }),
  item('coin', 'Copper Coin'),
  item('veil', 'Gray Veil', { slotRule: { mode: 'either', slotIds: ['head'] }, unidentifiedName: 'Strange Cloth' }),
];
/** Bodies and slots, with the Custom Persona entity on the Default and `picks` by entity id. */
const equipment = (bodies: Body[], picks: Record<string, Body | 'none'> = {}): SceneEquipment => ({
  world: {
    bodies, slots: SLOTS,
    entities: [
      { id: 'me', customPersona: true },
      ...Object.entries(picks).map(([id, pick]) => ({ id, body: pick === 'none' ? { kind: 'none' as const } : { kind: 'body' as const, id: pick.id } })),
    ],
  },
});
/** The sample scene, at the Landing with Wren and the gull, holding `copies` under `gear`. */
const scene = (copies: ItemCopy[], gear?: SceneEquipment): ChipScene => ({
  ...sampleChipScene(), items: ITEMS, itemCopies: copies, ...(gear && { equipment: gear }),
});
const render = (copies: ItemCopy[], gear?: SceneEquipment, key = '<INVENTORY|markdown>') => chipValues(scene(copies, gear))(key);

describe("the Inventory chip's slots (Q52, Q53)", () => {
  it("opens each owner block with that owner's slots in force, the count shown above 1", () => {
    expect(render([
      copy('coin', { kind: 'you' }),
      copy('coin', { kind: 'entity', id: 'wren' }),
    ], equipment([HUMANOID, BEAST], { wren: BEAST }))).toBe([
      '- **Traveler**',
      '  - **slots:** Head, Hand ×2',
      '  - **carried:** Copper Coin',
      '- **Wren**',
      '  - **slots:** Collar',
      '  - **carried:** Copper Coin',
      '',
    ].join('\n'));
  });

  it("names an equippable item's first slot on every face, in both modes", () => {
    const out = render([
      copy('helm', { kind: 'you' }),
      copy('pike', { kind: 'you' }, { equipped: { slotId: 'hand', order: 1 } }),
      copy('veil', { kind: 'you' }, { state: { unidentified: true } }),
      copy('helm', { kind: 'location', id: 'landing' }),
    ], equipment([HUMANOID]));
    expect(out).toContain('**equipped:** Long Pike (Hand): A pike taller than a man.');
    expect(out).toContain('**carried:** Iron Helm (Head)');
    expect(out).toContain('**carried:** Strange Cloth (Head) (unknown to the player');
    expect(out).toContain('**lying here:** Iron Helm (Head)');
  });

  it('writes none for an owner under None, and never a Body name', () => {
    const out = render([copy('helm', { kind: 'entity', id: 'wren' })], equipment([HUMANOID, BEAST], { wren: 'none' }));
    expect(out).toContain('- **Wren**\n  - **slots:** none\n');
    expect(out).not.toMatch(/Humanoid|Beast/);
  });

  it("shows the player's block with its slots when the player holds nothing, and no block for an empty entity", () => {
    expect(render([], equipment([HUMANOID]))).toBe('- **Traveler**\n  - **slots:** Head, Hand ×2\n');
  });

  it('names no slot in a world with no Bodies', () => {
    expect(render([copy('helm', { kind: 'you' })], equipment([]))).toBe('- **Traveler**\n  - **carried:** Iron Helm\n');
    expect(render([], equipment([]))).toBe('N/A');
  });

  it('writes the slots as a tag in xml', () => {
    expect(render([], equipment([HUMANOID]), '<INVENTORY|xml>'))
      .toBe('<owner>\n  <name>Traveler</name>\n  <slots>Head, Hand ×2</slots>\n</owner>\n');
  });

  it("lists the slots of a trait's Body over the authored pick (Q54)", () => {
    const gear = equipment([HUMANOID, BEAST]);
    const out = render([copy('coin', { kind: 'entity', id: 'wren' })], {
      ...gear, world: { ...gear.world, traitPicks: { '': { kind: 'body', id: 'beast' }, wren: { kind: 'none' } } },
    });
    expect(out).toContain('- **Traveler**\n  - **slots:** Collar\n');
    expect(out).toContain('- **Wren**\n  - **slots:** none\n');
  });

  it("reads a world persona's own Body pick", () => {
    const gear = equipment([HUMANOID, BEAST], { hound: BEAST });
    expect(render([], { ...gear, persona: { source: 'world', entityId: 'hound' } })).toContain('**slots:** Collar');
  });
});

describe('the narration prompt', () => {
  it("sends each owner's slots in Items Here", () => {
    const prompt = buildNarrationPrompt({
      template: defaultSystemPrompt, ctx: chipValues(scene([copy('helm', { kind: 'entity', id: 'wren' })], equipment([HUMANOID, BEAST], { wren: BEAST }))),
      action: 'I look around.', history: [], dictionary: [], actionVec: null, semanticLore: false, embedVectors: new Map(), language: 'English',
      paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false, sectionStyle: 'markdown', resolvePH: (text) => text,
    }).prompt;
    expect(prompt).toContain('- **Traveler**\n  - **slots:** Head, Hand ×2\n- **Wren**\n  - **slots:** Collar\n  - **carried:** Iron Helm (Head)');
    expect(prompt).not.toMatch(/Humanoid|Beast/);
  });
});

describe('the Inventory pass request', () => {
  it("lists each present owner's own slots from the authored world, and no Body name", () => {
    const world = sampleWorld();
    const authored = authoredChipScene({
      ...world, items: ITEMS, slots: SLOTS, bodies: [HUMANOID, BEAST],
      entities: world.entities.map((e) => (e.id === 'wren' ? { ...e, body: { kind: 'body', id: 'beast' } } : e)),
      placements: [{ id: 'p-coin', where: { kind: 'entity', id: 'wren' }, quantity: 1, source: { kind: 'item', itemId: 'coin' } }],
    });
    const request = inventoryRequest(
      { system: defaultInventoryPrompt, user: defaultInventoryUserPrompt },
      { ctx: chipValues(authored), action: 'I wait.', narration: 'Nothing happens.' }, { textPass: false, quiet: false },
    );
    expect(request.systemPrompt).toMatch(/\n {2}- \*\*slots:\*\* Head, Hand ×2\n/);
    expect(request.systemPrompt).toContain('- **Wren**\n  - **slots:** Collar\n');
    expect(request.systemPrompt).not.toMatch(/Humanoid|Beast/);
  });
});
