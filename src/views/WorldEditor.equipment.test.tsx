import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { blankItem } from '@/lib/items';
import type { Body, Entity, Item, Placement, Slot, World } from '@/types';

/** The Items tab's Equipment Settings entry: slots, Bodies and Persona Items, and the entity Body select. */

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
// Hand holds 2 in Humanoid and 1 in Imp; no Body holds Tail.
const BODIES: Body[] = [
  { id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'hand', capacity: 2 }, { slotId: 'ring' }] },
  { id: 'imp', name: 'Imp', entries: [{ slotId: 'hand' }] },
];
const ITEMS: Item[] = [blankItem('lamp', 'Lamp'), { ...blankItem('sword', 'Greatsword'), slotId: 'hand', slotSize: 2 }];
const PLACEMENTS: Placement[] = [{ id: 'p-lamp', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'lamp' } }];
const ENTITIES = [
  { id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps lit.', locations: ['harbor'], body: { kind: 'body', id: 'imp' } },
  { id: 'gull', name: 'Gull', playerDescription: 'A gull.', aiDescription: 'A gull.', locations: ['harbor'], body: { kind: 'body', id: 'imp' } },
  { id: 'custom', name: 'Custom Persona', playerDescription: 'You.', aiDescription: 'You.', locations: [], customPersona: true },
] as unknown as Entity[];

const WORLD: World = benchEditorWorld({ items: ITEMS, slots: SLOTS, bodies: BODIES, placements: PLACEMENTS, entities: ENTITIES } as Partial<World>);

const section = (label: string) => screen.getByText(label, { selector: 'label' }).closest('[data-history-field]') as HTMLElement;

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

  it('stays at the top of the list under any filter', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openEditorTab(/Items/);
    fireEvent.change(screen.getByPlaceholderText('Filter Items'), { target: { value: 'sword' } });
    expect(screen.getByRole('button', { name: 'Select Equipment Settings' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Select Lamp' })).toBeNull();
  });

  it('shows in a world without items', () => {
    renderWorldEditorBench(benchEditorWorld({}), 'simple');
    openEquipment();
    expect(screen.getByTestId('equipment-editor')).toBeTruthy();
  });
});

describe('the Slots section', () => {
  it('adds and renames a slot, which has a name only', () => {
    const { ctx } = renderWorldEditorBench(benchEditorWorld({}), 'advanced');
    openEquipment();
    fireEvent.click(screen.getByRole('button', { name: 'Add Slot' }));
    fireEvent.change(screen.getByLabelText('Slot Name'), { target: { value: 'Head' } });
    expect(ctx().slots).toEqual([{ id: expect.any(String), name: 'Head' }]);
  });

  it('counts the items and Body entries a slot in use has, then clears them', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEquipment();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Hand' }));
    expect(ctx().slots).toHaveLength(3);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('This also deletes its 2 Body entries and clears the slot on 1 item.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(ctx().slots.map((s) => s.id)).toEqual(['ring', 'tail']);
    expect(ctx().items.find((i) => i.id === 'sword')).not.toHaveProperty('slotId');
    expect(ctx().bodies.map((b) => b.entries.map((e) => e.slotId))).toEqual([['ring'], []]);
  });

  it('asks for a slot only a Body holds', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEquipment();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ring' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('This also deletes its Body entry.');
  });

  it('deletes an unused slot at once', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEquipment();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Tail' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(ctx().slots.map((s) => s.id)).toEqual(['hand', 'ring']);
  });
});

describe('the Bodies section', () => {
  it('names the first Body as the Default and marks only its card', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openEquipment();
    const bodies = section('Bodies');
    expect(bodies.textContent).toContain('Humanoid is the Default, for entities set to Default');
    expect(within(bodies).getAllByText(/^Default · /).map((meta) => meta.textContent)).toEqual(['Default · Hand ×2, Ring']);  });

  it('adds a Body with no entries, renames it, and adds a slot to it with a capacity', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openEquipment();
    fireEvent.click(screen.getByRole('button', { name: 'Add Body' }));
    const names = within(section('Bodies')).getAllByLabelText('Name');
    fireEvent.change(names[2], { target: { value: 'Dog' } });
    expect(ctx().bodies[2]).toEqual({ id: expect.any(String), name: 'Dog', entries: [] });
    pickOption(screen.getByRole('combobox', { name: 'Add a slot to Dog' }), 'Tail');
    fireEvent.change(screen.getAllByLabelText('Tail Capacity')[0], { target: { value: '3' } });
    expect(ctx().bodies[2].entries).toEqual([{ slotId: 'tail', capacity: 3 }]);
    fireEvent.change(screen.getAllByLabelText('Tail Capacity')[0], { target: { value: '1' } });
    expect(ctx().bodies[2].entries).toEqual([{ slotId: 'tail' }]);
  });

  it('offers only the slots a Body lacks', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openEquipment();
    expect(options(screen.getByRole('combobox', { name: 'Add a slot to Humanoid' }))).toEqual(['Tail']);
  });

  it('warns on Bodies that share a name, without blocking it', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openEquipment();
    expect(screen.queryByText(/Another Body has this name/)).toBeNull();
    fireEvent.change(within(section('Bodies')).getAllByLabelText('Name')[1], { target: { value: 'humanoid ' } });
    expect(screen.getAllByText(/Another Body has this name/)).toHaveLength(2);
    expect(ctx().bodies[1].name).toBe('humanoid ');
  });

  it('cuts Slot Sizes down when the largest capacity for their slot drops', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openEquipment();
    // Humanoid's Hand is the only capacity of 2; Imp keeps a Hand of 1.
    fireEvent.change(screen.getAllByLabelText('Hand Capacity')[0], { target: { value: '1' } });
    expect(ctx().items.find((i) => i.id === 'sword')).not.toHaveProperty('slotSize');
  });

  it('undoes a capacity drop and its Slot Size cut in one step', () => {
    const bench = renderWorldEditorBench(WORLD, 'simple');
    openEquipment();
    fireEvent.change(screen.getAllByLabelText('Hand Capacity')[0], { target: { value: '1' } });
    act(() => bench.history().undo());
    expect(bench.ctx().bodies[0].entries[0]).toEqual({ slotId: 'hand', capacity: 2 });
    expect(bench.ctx().items.find((i) => i.id === 'sword')).toMatchObject({ slotSize: 2 });
  });

  it('keeps Slot Sizes another Body still fits', () => {
    const world = benchEditorWorld({
      items: ITEMS, slots: SLOTS, placements: PLACEMENTS, entities: ENTITIES,
      bodies: [BODIES[0], { ...BODIES[1], entries: [{ slotId: 'hand', capacity: 2 }] }],
    } as Partial<World>);
    const { ctx } = renderWorldEditorBench(world, 'simple');
    openEquipment();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Hand from Humanoid' }));
    expect(ctx().items.find((i) => i.id === 'sword')).toMatchObject({ slotSize: 2 });
  });

  it('counts the entities that pick a Body in use, then sets them back to Default', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openEquipment();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Imp' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('This also resets 2 picks to Default.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(ctx().bodies.map((b) => b.id)).toEqual(['humanoid']);
    expect(ctx().entities.filter((e) => e.body)).toEqual([]);
  });

  it('counts the trait Body rows that pick a Body, world and entity traits both, then blanks them', () => {
    const imp = { kind: 'body' as const, id: 'imp' };
    const world = benchEditorWorld({
      items: ITEMS, slots: SLOTS, bodies: BODIES, placements: PLACEMENTS,
      traits: [{ id: 'curse', name: 'Imp Curse', statChanges: [], body: { pick: imp } }, { id: 'calm', name: 'Calm', statChanges: [], body: { pick: { kind: 'body', id: 'humanoid' } } }],
      entities: [{ ...ENTITIES[0], body: undefined, traits: [{ id: 'own', name: 'Own Form', statChanges: [], body: { pick: imp } }] }],
    } as Partial<World>);
    const { ctx } = renderWorldEditorBench(world, 'simple');
    openEquipment();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Imp' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('This also clears 2 trait Body rows.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(ctx().traits.map((t) => t.body)).toEqual([{}, { pick: { kind: 'body', id: 'humanoid' } }]);
    expect(ctx().entities[0].traits?.[0].body).toEqual({});
  });

  it('deletes a Body no entity picks at once, cutting Slot Sizes with it', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openEquipment();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Humanoid' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(ctx().bodies.map((b) => b.id)).toEqual(['imp']);
    expect(ctx().items.find((i) => i.id === 'sword')).not.toHaveProperty('slotSize');
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
