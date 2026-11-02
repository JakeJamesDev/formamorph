import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { screen, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { $createParagraphNode, $createTextNode, $getRoot, getNearestEditorFromDOMNode } from 'lexical';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { blankItem } from '@/lib/items';
import { migrateWorld } from '@/lib/version';
import type { Body, Currency, Item, Placement, Slot, World } from '@/types';

/** The Items tab: a flat list beside Entities and the item panel. */

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

const SLOTS: Slot[] = [{ id: 'hand', name: 'Hand' }, { id: 'ring', name: 'Ring' }, { id: 'tail', name: 'Tail' }];
// Hand holds 2 in one Body and 1 in the other; no Body holds Tail.
const BODIES: Body[] = [
  bodyFixture({ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'hand', capacity: 2 }, { slotId: 'ring' }] }),
  bodyFixture({ id: 'imp', name: 'Imp', entries: [{ slotId: 'hand' }] }),
];
const ITEMS: Item[] = [
  { ...blankItem('lamp', 'Lamp'), playerDescription: 'A brass lamp.' },
  { ...blankItem('sword', 'Greatsword'), slotRule: { mode: 'all', slotIds: ['hand', 'ring'] } },
];
const PLACEMENTS: Placement[] = [
  { id: 'p-lamp', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'lamp' } },
  { id: 'p-sword', where: { kind: 'location', id: 'harbor' }, quantity: 1, hidden: true, source: { kind: 'item', itemId: 'sword' } },
];

const CURRENCIES: Currency[] = [
  { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'gold' } },
  { id: 'goats', name: 'Goats', backing: { kind: 'name' } },
];

const WORLD: World = benchEditorWorld({
  stats: [{ id: 'gold', name: 'Gold', type: 'number', description: '', min: 0, max: 999, regen: 0, descriptors: [] }],
  items: ITEMS, slots: SLOTS, bodies: BODIES, placements: PLACEMENTS,
} as Partial<World>);

const search = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('Filter Items'), { target: { value: term } });

const row = (name: string) => screen.getByRole('button', { name: `Select ${name}` }).parentElement as HTMLElement;

const itemFieldsTab = (name: string) =>
  fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Item Fields' })).getByRole('tab', { name }));

const openItem = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Select ${name}` }));

beforeEach(() => { localStorage.clear(); });

describe('items, slots, Bodies and placements in the world', () => {
  it('come back out of the editor exactly as they went in', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    const data = ctx().getWorldData();
    expect(data.items).toEqual(ITEMS);
    expect(data.slots).toEqual(SLOTS);
    expect(data.bodies).toEqual(BODIES);
    expect(data.placements).toEqual(PLACEMENTS);
    expect(ctx().isWorldDirty).toBe(false);
  });

  it('leave a world without them unchanged', () => {
    const { ctx } = renderWorldEditorBench(benchEditorWorld({}), 'advanced');
    const data = ctx().getWorldData();
    expect(data).not.toHaveProperty('items');
    expect(data).not.toHaveProperty('slots');
    expect(data).not.toHaveProperty('bodies');
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
  it('reads like the entity panel: Profile, Descriptions, Properties, Scripts and Placeholders', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    const tabs = within(screen.getByRole('tablist', { name: 'Item Fields' })).getAllByRole('tab').map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['Profile', 'Descriptions', 'Properties', 'Effects', 'Requirements', 'Scripts', 'Placeholders']);
    itemFieldsTab('Descriptions');
    expect(screen.getByText('Player-Facing Description')).toBeTruthy();
    expect(screen.getByText('AI-Facing Summary')).toBeTruthy();
  });

  it('writes the Unidentified Name and Unidentified Description from the Descriptions tab, in Simple mode too', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openEditorTab(/Items/);
    openItem('Lamp');
    itemFieldsTab('Descriptions');
    const type = async (name: string, text: string) => {
      const editor = getNearestEditorFromDOMNode(screen.getByRole('textbox', { name }));
      await act(async () => {
        editor?.update(() => { $getRoot().clear().append($createParagraphNode().append($createTextNode(text))); }, { discrete: true });
      });
    };
    await type('Unidentified Name', 'Dented Lamp');
    await type('Unidentified Description', 'A lamp gone green with age.');
    expect(ctx().items.find((i) => i.id === 'lamp')).toMatchObject({ unidentifiedName: 'Dented Lamp', unidentifiedDescription: 'A lamp gone green with age.' });
    await type('Unidentified Name', '');
    expect(ctx().items.find((i) => i.id === 'lamp')?.unidentifiedName).toBeUndefined();
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

  it('turns Stackable off and locks it at Uses 2 or more, leaves it on at Uses 1, and keeps it off when Uses clear', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    itemFieldsTab('Properties');
    const stackable = () => screen.getByRole('checkbox', { name: 'Stackable' });
    expect(stackable().getAttribute('aria-checked')).toBe('true');

    fireEvent.change(screen.getByLabelText('Uses'), { target: { value: '1' } });
    expect(ctx().items[0]).toMatchObject({ uses: 1 });
    expect(stackable().getAttribute('aria-checked')).toBe('true');

    fireEvent.change(screen.getByLabelText('Uses'), { target: { value: '3' } });
    expect(ctx().items[0]).toMatchObject({ uses: 3, stackable: false });
    expect(stackable().getAttribute('aria-checked')).toBe('false');
    expect(stackable().hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText('Uses'), { target: { value: '' } });
    expect(ctx().items[0].uses).toBeUndefined();
    expect(ctx().items[0].whenEmpty).toBeUndefined();
    expect(ctx().items[0].stackable).toBe(false);
    expect(stackable().hasAttribute('disabled')).toBe(false);
  });

  it('shows When Empty once Uses is set, starting at Gone, and picks a Becomes target from the items', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    itemFieldsTab('Properties');
    expect(screen.queryByRole('combobox', { name: 'When Empty' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Uses'), { target: { value: '2' } });
    expect(ctx().items[0].whenEmpty).toEqual({ kind: 'gone' });
    expect(screen.getByRole('combobox', { name: 'When Empty' })).toHaveTextContent('Gone');

    pickOption('When Empty', 'Stays');
    expect(ctx().items[0].whenEmpty).toEqual({ kind: 'stays' });

    pickOption('When Empty', 'Becomes');
    expect(ctx().items[0].whenEmpty).toEqual({ kind: 'becomes', itemId: 'sword' });
    openSelect('Becomes Item');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Greatsword']);
  });

  it('writes a Changes State word and the starting State, and clears a blank State', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    itemFieldsTab('Properties');
    fireEvent.change(screen.getByLabelText('Uses'), { target: { value: '1' } });
    pickOption('When Empty', 'Changes State');
    expect(ctx().items[0].whenEmpty).toEqual({ kind: 'changesState', state: '' });
    fireEvent.change(screen.getByRole('textbox', { name: 'New State' }), { target: { value: 'spent' } });
    expect(ctx().items[0].whenEmpty).toEqual({ kind: 'changesState', state: 'spent' });

    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'unlit' } });
    expect(ctx().items[0].state).toBe('unlit');
    fireEvent.change(screen.getByLabelText('State'), { target: { value: '' } });
    expect(ctx().items[0].state).toBeUndefined();
  });

  it('writes Bound', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    itemFieldsTab('Properties');
    expect(screen.queryByRole('checkbox', { name: 'Consumable' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bound' }));
    expect(ctx().items[0]).toMatchObject({ bound: true });
  });

  it('prices an item in a Currency, and clears it back to priceless with its Value kept', () => {
    const { ctx } = renderWorldEditorBench({ ...WORLD, currencies: CURRENCIES }, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    itemFieldsTab('Properties');
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveTextContent('No Currency');
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '12' } });
    pickOption('Currency', 'Goats');
    expect(ctx().items[0]).toMatchObject({ value: 12, currencyId: 'goats' });
    pickOption('Currency', 'No Currency');
    expect(ctx().items[0].currencyId).toBeUndefined();
    expect(ctx().items[0].value).toBe(12);
  });

  it('reads an item whose Currency is gone as No Currency', () => {
    const world = { ...WORLD, items: [{ ...ITEMS[0], value: 3, currencyId: 'gone' }, ITEMS[1]] };
    renderWorldEditorBench({ ...world, currencies: CURRENCIES }, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    itemFieldsTab('Properties');
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveTextContent('No Currency');
  });

  it('adds slots from the world list and shows Either of / All of once it lists two', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    openItem('Lamp');
    itemFieldsTab('Properties');
    expect(screen.queryByRole('combobox', { name: 'Slot Mode' })).toBeNull();
    openSelect('Add a slot to Lamp');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Hand', 'Ring', 'Tail']);
    fireEvent.keyDown(screen.getByRole('option', { name: 'Ring' }), { key: 'Enter' });
    expect(ctx().items[0].slotRule).toEqual({ mode: 'either', slotIds: ['ring'] });
    // One slot reads the same in both modes, so the mode shows only at two.
    expect(screen.queryByRole('combobox', { name: 'Slot Mode' })).toBeNull();
    openSelect('Add a slot to Lamp');
    fireEvent.keyDown(screen.getByRole('option', { name: 'Hand' }), { key: 'Enter' });
    expect(ctx().items[0].slotRule).toEqual({ mode: 'either', slotIds: ['ring', 'hand'] });
    openSelect('Slot Mode');
    fireEvent.keyDown(screen.getByRole('option', { name: 'All of' }), { key: 'Enter' });
    expect(ctx().items[0].slotRule).toEqual({ mode: 'all', slotIds: ['ring', 'hand'] });
  });

  it('clears the rule with its last slot, so the item is not equippable', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    openItem('Greatsword');
    itemFieldsTab('Properties');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Hand from Greatsword' }));
    expect(ctx().items[1].slotRule).toEqual({ mode: 'all', slotIds: ['ring'] });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ring from Greatsword' }));
    expect(ctx().items[1].slotRule).toBeUndefined();
  });
});

describe('the Currencies entry', () => {
  const openCurrencies = () => {
    openEditorTab(/Items/);
    fireEvent.click(screen.getByRole('button', { name: 'Select Currencies' }));
  };

  it('sits beside Equipment Settings, and adds a name-only Currency that a stat can then back', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openCurrencies();
    fireEvent.click(screen.getByRole('button', { name: 'Add Currency' }));
    expect(ctx().currencies).toEqual([expect.objectContaining({ name: 'New Currency', backing: { kind: 'name' } })]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Currency Name' }), { target: { value: 'Credits' } });
    pickOption('Currency Type', 'Stat');
    expect(ctx().currencies[0]).toMatchObject({ name: 'Credits', backing: { kind: 'stat', statId: 'gold' } });
    pickOption('Currency Type', 'Name Only');
    expect(ctx().currencies[0].backing).toEqual({ kind: 'name' });
  });

  it('lists a linked Blueprint stat once and a Persona’s own stat in the stat picker', () => {
    const blueprint = { id: 'bp', name: 'Blueprints', system: 'blueprints' as const, parentId: null };
    const stat = (id: string, name: string, groupId?: string) => ({ id, name, type: 'number' as const, description: '', min: 0, max: 9, regen: 0, descriptors: [], ...(groupId && { groupId }) });
    const link = { id: 'link', originalId: 'purse', kind: 'stat' as const, originalName: 'Purse', groupId: null };
    const persona = (id: string, name: string, extra: object) => ({ id, name, persona: true, ...extra });
    renderWorldEditorBench(benchEditorWorld({
      stats: [stat('treasury', 'Treasury'), stat('purse', 'Purse', 'bp'), stat('unlinked', 'Unlinked', 'bp')],
      statGroups: [blueprint],
      entities: [persona('a', 'Ada', { statLinks: [link] }), persona('b', 'Bo', { statLinks: [{ ...link, id: 'link-b' }], stats: [stat('credits', 'Credits')] })],
      currencies: [{ id: 'c', name: 'Coin', backing: { kind: 'stat', statId: 'purse' } }],
    } as Partial<World>), 'advanced');
    openCurrencies();
    openSelect('Currency Stat');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Treasury', 'Purse', 'Credits']);
  });

  it('reorders by keyboard drag, so the Default changes', async () => {
    // jsdom lays nothing out; stack the rows 100px apart so the keyboard sensor can find a neighbor.
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const row = this.closest<HTMLElement>('[data-sortable-row]') ?? this.closest<HTMLElement>('li');
      const i = row?.parentElement ? [...row.parentElement.children].indexOf(row) : 0;
      return DOMRect.fromRect({ x: 0, y: i * 100, width: 300, height: 90 });
    });
    const { ctx } = renderWorldEditorBench({ ...WORLD, currencies: CURRENCIES }, 'advanced');
    openCurrencies();
    const user = userEvent.setup();
    within(screen.getByTestId('currencies-editor')).getAllByRole('button', { name: /reorder/i })[1].focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Space]');
    rect.mockRestore();
    expect(ctx().currencies.map((c) => c.id)).toEqual(['goats', 'credits']);
  });

  it('removes a Currency, and the next one becomes the Default', () => {
    const { ctx } = renderWorldEditorBench({ ...WORLD, currencies: CURRENCIES }, 'advanced');
    openCurrencies();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Credits' }));
    expect(ctx().currencies.map((c) => c.id)).toEqual(['goats']);
    search('Rope');
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(ctx().items.find((i) => i.name === 'Rope')?.currencyId).toBe('goats');
  });

  it('drops a malformed Currency on load', () => {
    const { ctx } = renderWorldEditorBench({ ...WORLD, currencies: [CURRENCIES[0], { id: 'bad', name: 'Bad' }, CURRENCIES[1]] as Currency[] }, 'advanced');
    expect(ctx().currencies).toEqual(CURRENCIES);
  });

  it('leaves a new item priceless in a world with no Currency', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Items/);
    search('Rope');
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(ctx().items.every((i) => i.currencyId === undefined)).toBe(true);
  });

  it('gives a new item the first Currency', () => {
    const { ctx } = renderWorldEditorBench({ ...WORLD, currencies: CURRENCIES }, 'advanced');
    openEditorTab(/Items/);
    search('Rope');
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(ctx().items.find((i) => i.name === 'Rope')?.currencyId).toBe('credits');
    expect(ctx().items.find((i) => i.id === 'lamp')?.currencyId).toBeUndefined();
  });

  it('keeps Currencies and an item’s Currency through an export and an import', () => {
    const priced = { ...WORLD, items: [{ ...ITEMS[0], value: 3, currencyId: 'goats' }, ITEMS[1]], currencies: CURRENCIES };
    const { ctx } = renderWorldEditorBench(priced, 'advanced');
    expect(ctx().isWorldDirty).toBe(false);
    const exported = JSON.parse(JSON.stringify(ctx().getWorldData())) as World;
    act(() => { ctx().loadWorldData(migrateWorld(exported)); });
    expect(ctx().currencies).toEqual(CURRENCIES);
    expect(ctx().items[0]).toMatchObject({ value: 3, currencyId: 'goats' });
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
