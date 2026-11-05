import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { blankItem } from '@/lib/items';
import type { Body, Entity, Item, Placement, Slot, World } from '@/types';

/** How the view holds the Items tab: its place in the rail, the shared search, and the entity Body select. */

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

const SLOTS: Slot[] = [{ id: 'hand', name: 'Hand' }, { id: 'ring', name: 'Ring' }];
const BODIES: Body[] = [
  bodyFixture({ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'hand', capacity: 2 }, { slotId: 'ring' }] }),
  bodyFixture({ id: 'imp', name: 'Imp', entries: [{ slotId: 'hand' }] }),
];
const ITEMS: Item[] = [blankItem('lamp', 'Lamp'), { ...blankItem('sword', 'Greatsword'), slotRule: { mode: 'either', slotIds: ['hand'] } }];
const PLACEMENTS: Placement[] = [{ id: 'p-lamp', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'lamp' } }];
const ENTITIES = [
  { id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps lit.', locations: ['harbor'], body: { kind: 'body', id: 'imp' } },
  { id: 'custom', name: 'Custom Persona', playerDescription: 'You.', aiDescription: 'You.', locations: [], customPersona: true },
] as unknown as Entity[];

const WORLD: World = benchEditorWorld({ items: ITEMS, slots: SLOTS, bodies: BODIES, placements: PLACEMENTS, entities: ENTITIES } as Partial<World>);

const section = (label: string) => screen.getByText(label, { selector: 'label' }).closest('[data-history-field]') as HTMLElement;

const search = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('Filter Items'), { target: { value: term } });

const openEquipment = () => {
  openEditorTab(/Items/);
  fireEvent.click(screen.getByRole('button', { name: 'Select Equipment Settings' }));
};

const openEntityItems = (name: string) => {
  openEditorTab(/Entities/);
  fireEvent.click(screen.getByText(name));
  fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Entity Fields' })).getByRole('tab', { name: 'Items' }));
};

/** Open a Radix select by keyboard: a click needs pointer capture, which jsdom has not got. */
const pickOption = (combobox: HTMLElement, option: string) => {
  act(() => { fireEvent.keyDown(combobox, { key: 'Enter' }); });
  fireEvent.keyDown(screen.getByRole('option', { name: option }), { key: 'Enter' });
};

const options = (combobox: HTMLElement) => {
  act(() => { fireEvent.keyDown(combobox, { key: 'Enter' }); });
  const names = screen.getAllByRole('option').map((o) => o.textContent);
  fireEvent.keyDown(screen.getAllByRole('option')[0], { key: 'Escape' });
  return names;
};

beforeEach(() => { localStorage.clear(); });

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
});

describe('the Equipment Settings entry', () => {
  it('opens the Slots, Bodies and Persona Items sections, which leave the Overview', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openEditorTab(/Overview/);
    expect(screen.queryByText('Slots', { selector: 'label' })).toBeNull();
    expect(screen.queryByText('Persona Items', { selector: 'label' })).toBeNull();
    openEquipment();
    const editor = screen.getByTestId('equipment-editor');
    expect([...editor.querySelectorAll('label')].map((l) => l.textContent)).toEqual(expect.arrayContaining(['Slots', 'Bodies', 'Persona Items']));
    expect(within(section('Persona Items')).getByLabelText('Lamp Quantity')).toHaveProperty('value', '1');
  });
});

describe('the entity Body select', () => {
  const bodySelect = () => screen.getByRole('combobox', { name: 'Body' });

  it('lists Default with the first Body, None, then each Body, and saves the pick', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openEntityItems('Odd Wick');
    expect(options(bodySelect())).toEqual(['Default (Humanoid)', 'None', 'Humanoid', 'Imp']);
    pickOption(bodySelect(), 'None');
    expect(ctx().entities.find((e) => e.id === 'resident')?.body).toEqual({ kind: 'none' });
    pickOption(bodySelect(), 'Humanoid');
    expect(ctx().entities.find((e) => e.id === 'resident')?.body).toEqual({ kind: 'body', id: 'humanoid' });
    pickOption(bodySelect(), 'Default (Humanoid)');
    expect(ctx().entities.find((e) => e.id === 'resident')).not.toHaveProperty('body');
  });

  it("says on the Custom Persona entity that its pick also sets the player's Body", () => {
    renderWorldEditorBench(WORLD, 'simple');
    openEntityItems('Custom Persona');
    expect(section('Body').textContent).toContain("Also sets the player's Body under None or a library persona");
    expect(bodySelect()).toBeTruthy();
  });

  it('points at Equipment in a world without Bodies', () => {
    renderWorldEditorBench(benchEditorWorld({}), 'simple');
    openEntityItems('Odd Wick');
    expect(screen.queryByRole('combobox', { name: 'Body' })).toBeNull();
    expect(section('Body').textContent).toContain('Add a Body in Equipment Settings');
  });
});
