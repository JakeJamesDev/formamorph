import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { $createParagraphNode, $createTextNode, $getRoot, getNearestEditorFromDOMNode } from 'lexical';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { blankItem } from '@/lib/items';
import type { Item, Placement, Slot, World } from '@/types';

/** The Items tab: a flat list beside Entities, the item panel, and the world's slots. */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const SLOTS: Slot[] = [{ id: 'hand', name: 'Hand', capacity: 2 }, { id: 'ring', name: 'Ring' }];
const ITEMS: Item[] = [
  { ...blankItem('lamp', 'Lamp'), playerDescription: 'A brass lamp.' },
  { ...blankItem('sword', 'Greatsword'), slotId: 'hand', slotSize: 2 },
];
const PLACEMENTS: Placement[] = [
  { id: 'p-lamp', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'lamp' } },
  { id: 'p-sword', where: { kind: 'location', id: 'harbor' }, quantity: 1, hidden: true, source: { kind: 'item', itemId: 'sword' } },
];

const WORLD: World = benchEditorWorld({
  stats: [{ id: 'gold', name: 'Gold', type: 'number', description: '', min: 0, max: 999, regen: 0, descriptors: [] }],
  items: ITEMS, slots: SLOTS, placements: PLACEMENTS,
} as Partial<World>);

const search = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('Filter Items'), { target: { value: term } });

const row = (name: string) => screen.getByRole('button', { name: `Select ${name}` }).parentElement as HTMLElement;

const itemFieldsTab = (name: string) =>
  fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Item Fields' })).getByRole('tab', { name }));

const openItem = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Select ${name}` }));

beforeEach(() => { localStorage.clear(); });

describe('items, slots and placements in the world', () => {
  it('come back out of the editor exactly as they went in', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    const data = ctx().getWorldData();
    expect(data.items).toEqual(ITEMS);
    expect(data.slots).toEqual(SLOTS);
    expect(data.placements).toEqual(PLACEMENTS);
    expect(ctx().isWorldDirty).toBe(false);
  });

  it('leave a world without them unchanged', () => {
    const { ctx } = renderWorldEditorBench(benchEditorWorld({}), 'advanced');
    const data = ctx().getWorldData();
    expect(data).not.toHaveProperty('items');
    expect(data).not.toHaveProperty('slots');
    expect(data).not.toHaveProperty('placements');
  });
});

describe('the Items list', () => {
  it('sits beside Entities and lists the items in order', () => {
    renderWorldEditorBench(WORLD, 'simple');
    const tabs = within(screen.getByRole('tablist', { name: 'Editor Sections' })).getAllByRole('tab').map((t) => t.textContent);
    expect(tabs.indexOf('Items')).toBe(tabs.indexOf('Entities') + 1);
    openEditorTab(/Items/);
    expect(screen.getByRole('button', { name: 'Select Lamp' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Select Greatsword' })).toBeTruthy();
  });

  it('adds an item named by the search text and opens it', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    search('Rope');
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    const added = ctx().items.find((i) => i.name === 'Rope');
    expect(added).toMatchObject({ statEffects: [], traitEffects: [], equipRequires: [] });
    expect(ctx().items.at(-1)?.id).toBe(added?.id);
  });

  it('renames an item from its Name field', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    const editor = getNearestEditorFromDOMNode(screen.getByRole('textbox', { name: 'Name' }));
    await act(async () => {
      editor?.update(() => {
        $getRoot().clear().append($createParagraphNode().append($createTextNode('Storm Lamp')));
      }, { discrete: true });
    });
    expect(ctx().items.find((i) => i.id === 'lamp')?.name).toBe('Storm Lamp');
  });

  it('duplicates an item and opens the copy', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    fireEvent.click(within(row('Lamp')).getByRole('button', { name: 'Duplicate' }));
    expect(ctx().items.map((i) => i.name)).toEqual(['Lamp', 'Lamp (Copy)', 'Greatsword']);
    expect(screen.getByLabelText('Name').textContent).toBe('Lamp (Copy)');
  });

  it('deletes an item with its placements', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    fireEvent.click(within(row('Lamp')).getByRole('button', { name: 'Delete' }));
    expect(ctx().items.map((i) => i.id)).toEqual(['sword']);
    expect(ctx().placements.map((p) => p.id)).toEqual(['p-sword']);
  });
});

describe('the item panel', () => {
  it('reads like the entity panel: Profile, Descriptions, Properties and Placeholders', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    const tabs = within(screen.getByRole('tablist', { name: 'Item Fields' })).getAllByRole('tab').map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['Profile', 'Descriptions', 'Properties', 'Effects', 'Requirements', 'Placeholders']);
    itemFieldsTab('Descriptions');
    expect(screen.getByText('Player-Facing Description')).toBeTruthy();
    expect(screen.getByText('AI-Facing Summary')).toBeTruthy();
  });

  it('leaves Placeholders and the summary to Advanced mode', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openEditorTab(/Items/);
    openItem('Lamp');
    const tabs = within(screen.getByRole('tablist', { name: 'Item Fields' })).getAllByRole('tab').map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['Profile', 'Descriptions', 'Properties', 'Effects', 'Requirements']);
    itemFieldsTab('Descriptions');
    expect(screen.queryByText('AI-Facing Summary')).toBeNull();
  });

  it('turns Stackable off and locks it once the item has charges, and keeps it off when they clear', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    itemFieldsTab('Properties');
    const stackable = () => screen.getByRole('checkbox', { name: 'Stackable' });
    expect(stackable().getAttribute('aria-checked')).toBe('true');

    fireEvent.change(screen.getByLabelText('Charges'), { target: { value: '3' } });
    expect(ctx().items[0]).toMatchObject({ charges: 3, stackable: false });
    expect(stackable().getAttribute('aria-checked')).toBe('false');
    expect(stackable().hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText('Charges'), { target: { value: '' } });
    expect(ctx().items[0].charges).toBeUndefined();
    expect(ctx().items[0].stackable).toBe(false);
    expect(stackable().hasAttribute('disabled')).toBe(false);
  });

  it('writes Consumable and Bound', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    itemFieldsTab('Properties');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Consumable' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bound' }));
    expect(ctx().items[0]).toMatchObject({ consumable: true, bound: true });
  });

  it('takes a value with a free-text unit', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    itemFieldsTab('Properties');
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '12' } });
    pickOption('Value Unit', 'Text');
    fireEvent.change(screen.getByLabelText('Unit Text'), { target: { value: 'silver' } });
    expect(ctx().items[0]).toMatchObject({ value: 12, valueUnit: { kind: 'text', text: 'silver' } });
  });

  it('points the value unit at a stat', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    itemFieldsTab('Properties');
    pickOption('Value Unit', 'Gold');
    expect(ctx().items[0].valueUnit).toEqual({ kind: 'stat', statId: 'gold' });
  });

  it('lists the world slots in its slot picker and caps the slot size at the slot capacity', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    itemFieldsTab('Properties');
    expect(screen.queryByLabelText('Slot Size')).toBeNull();
    openSelect('Slot');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Not Equippable', 'Hand', 'Ring']);
    fireEvent.keyDown(screen.getByRole('option', { name: 'Hand' }), { key: 'Enter' });
    expect(ctx().items[0].slotId).toBe('hand');
    fireEvent.change(screen.getByLabelText('Slot Size'), { target: { value: '5' } });
    expect(ctx().items[0].slotSize).toBe(2);
  });
});

describe('the Slots section', () => {
  const openSlots = () => openEditorTab(/Overview/);

  it('adds, renames and sizes a slot', () => {
    const { ctx } = renderWorldEditorBench(benchEditorWorld({}), 'advanced');
    openSlots();
    fireEvent.click(screen.getByRole('button', { name: 'Add Slot' }));
    fireEvent.change(screen.getByLabelText('Slot Name'), { target: { value: 'Head' } });
    fireEvent.change(screen.getByLabelText('Head Capacity'), { target: { value: '2' } });
    expect(ctx().slots).toMatchObject([{ name: 'Head', capacity: 2 }]);
  });

  it('asks before it removes a slot items use, then clears it from them', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openSlots();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Hand' }));
    expect(ctx().slots).toHaveLength(2);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('1 item equips into this slot');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(ctx().slots.map((s) => s.id)).toEqual(['ring']);
    expect(ctx().items.find((i) => i.id === 'sword')).not.toHaveProperty('slotId');
  });

  it('cuts the slot size of the items in a slot when its capacity drops', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openSlots();
    fireEvent.change(screen.getByLabelText('Hand Capacity'), { target: { value: '1' } });
    expect(ctx().slots.find((s) => s.id === 'hand')).not.toHaveProperty('capacity');
    expect(ctx().items.find((i) => i.id === 'sword')?.slotSize).toBe(1);
  });

  it('removes an unused slot at once', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openSlots();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ring' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(ctx().slots.map((s) => s.id)).toEqual(['hand']);
  });
});

/** Open a Radix select by its label, by keyboard: a click needs pointer capture, which jsdom has not got. */
function openSelect(label: string) {
  act(() => { fireEvent.keyDown(screen.getByRole('combobox', { name: label }), { key: 'Enter' }); });
}

function pickOption(label: string, option: string) {
  openSelect(label);
  fireEvent.keyDown(screen.getByRole('option', { name: option }), { key: 'Enter' });
}
