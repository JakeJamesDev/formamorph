import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { centerBox, KEY_STEP, MAX_ASPECT } from '@/lib/bodyLayout';
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
  bodyFixture({ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'hand', capacity: 2 }, { slotId: 'ring' }] }),
  bodyFixture({ id: 'imp', name: 'Imp', entries: [{ slotId: 'hand' }] }),
];
const ITEMS: Item[] = [blankItem('lamp', 'Lamp'), { ...blankItem('sword', 'Greatsword'), slotRule: { mode: 'either', slotIds: ['hand'] } }];
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

// jsdom decodes no image, so the measured aspect is what each test says it is.
const readImageAspect = vi.hoisted(() => vi.fn());
vi.mock('@/lib/imageAspect', () => ({ readImageAspect }));

beforeEach(() => { localStorage.clear(); readImageAspect.mockReset(); });

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
    expect(ctx().bodies[2]).toEqual({ id: expect.any(String), name: 'Dog', entries: [], backdrop: { kind: 'humanoid' }, aspect: 0.5 });
    pickOption(screen.getByRole('combobox', { name: 'Add a slot to Dog' }), 'Tail');
    fireEvent.change(screen.getAllByLabelText('Tail Capacity')[0], { target: { value: '3' } });
    fireEvent.blur(screen.getAllByLabelText('Tail Capacity')[0]);
    expect(ctx().bodies[2].entries).toEqual([{ slotId: 'tail', capacity: 3, boxes: [centerBox(0.5), centerBox(0.5), centerBox(0.5)] }]);
    fireEvent.change(screen.getAllByLabelText('Tail Capacity')[0], { target: { value: '1' } });
    fireEvent.blur(screen.getAllByLabelText('Tail Capacity')[0]);
    expect(ctx().bodies[2].entries).toEqual([{ slotId: 'tail', boxes: [centerBox(0.5)] }]);
  });

  describe('the layout', () => {
    const humanoidFields = () => within(section('Bodies')).getAllByLabelText('Name')[0].closest('.grid.gap-3') as HTMLElement;
    const boxButton = (name: string) => within(humanoidFields()).getByRole('button', { name });
    const pressed = () => within(humanoidFields()).getAllByRole('button', { pressed: true }).map((b) => b.getAttribute('aria-label'));
    const rowSelected = (name: string) => !!within(humanoidFields()).getByRole('button', { name: `Select ${name}` }).closest('[data-editor-row-selected]');

    it('labels boxes by slot and unit, or by slot alone at capacity 1', () => {
      renderWorldEditorBench(WORLD, 'simple');
      openEquipment();
      expect(within(humanoidFields()).getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed')).map((b) => b.getAttribute('aria-label')))
        .toEqual(['Hand 1', 'Hand 2', 'Ring']);
    });

    it('selects a box from its row, each click moving to the next unit', () => {
      renderWorldEditorBench(WORLD, 'simple');
      openEquipment();
      const select = within(humanoidFields()).getByRole('button', { name: 'Select Hand' });
      fireEvent.click(select);
      expect(pressed()).toEqual(['Hand 1']);
      expect(document.activeElement).toBe(boxButton('Hand 1'));
      fireEvent.click(select);
      expect(pressed()).toEqual(['Hand 2']);
      fireEvent.click(select);
      expect(pressed()).toEqual(['Hand 1']);
    });

    it('returns focus to the box when a capacity 1 row is clicked again', () => {
      renderWorldEditorBench(WORLD, 'simple');
      openEquipment();
      const select = within(humanoidFields()).getByRole('button', { name: 'Select Ring' });
      fireEvent.click(select);
      select.focus();
      fireEvent.click(select);
      expect(document.activeElement).toBe(boxButton('Ring'));
    });

    it('selects a row from its box', () => {
      renderWorldEditorBench(WORLD, 'simple');
      openEquipment();
      expect(rowSelected('Ring')).toBe(false);
      fireEvent.focus(boxButton('Ring'));
      expect(rowSelected('Ring')).toBe(true);
      expect(rowSelected('Hand')).toBe(false);
    });

    it('leaves the selection alone while a capacity is typed', () => {
      renderWorldEditorBench(WORLD, 'simple');
      openEquipment();
      fireEvent.click(within(humanoidFields()).getByLabelText('Hand Capacity'));
      expect(within(humanoidFields()).queryAllByRole('button', { pressed: true })).toEqual([]);
    });

    it('moves a selected box with arrow keys, and resizes it with Shift', () => {
      const { ctx } = renderWorldEditorBench(WORLD, 'simple');
      openEquipment();
      const start = ctx().bodies[0].entries[1].boxes[0];
      fireEvent.keyDown(boxButton('Ring'), { key: 'ArrowRight' });
      fireEvent.keyDown(boxButton('Ring'), { key: 'ArrowDown' });
      expect(ctx().bodies[0].entries[1].boxes[0]).toEqual({ ...start, x: start.x + KEY_STEP, y: start.y + KEY_STEP });
      fireEvent.keyDown(boxButton('Ring'), { key: 'ArrowLeft', shiftKey: true });
      expect(ctx().bodies[0].entries[1].boxes[0].w).toBeCloseTo(start.w - KEY_STEP);
      expect(ctx().bodies[0].entries[1].boxes[0].x).toBeCloseTo(start.x + KEY_STEP);
    });

    it('applies a typed capacity when the edit ends, not on each keystroke (Q79)', () => {
      const { ctx } = renderWorldEditorBench(WORLD, 'simple');
      openEquipment();
      const before = ctx().bodies[0].entries[0];
      const field = within(humanoidFields()).getByLabelText('Hand Capacity');
      fireEvent.change(field, { target: { value: '' } });
      fireEvent.change(field, { target: { value: '1' } });
      expect(ctx().bodies[0].entries[0]).toEqual(before);
      fireEvent.change(field, { target: { value: '12' } });
      expect(ctx().bodies[0].entries[0]).toEqual(before);
      fireEvent.keyDown(field, { key: 'Enter' });
      expect(ctx().bodies[0].entries[0].capacity).toBe(12);
      expect(ctx().bodies[0].entries[0].boxes).toHaveLength(12);
      expect(ctx().bodies[0].entries[0].boxes.slice(0, 2)).toEqual(before.boxes);
    });

    it('keeps the aspect and boxes when the current outline is picked again, also through Custom Image (Q77)', () => {
      const { ctx } = renderWorldEditorBench(WORLD, 'simple');
      openEquipment();
      fireEvent.keyDown(within(humanoidFields()).getByRole('slider', { name: 'Backdrop Height' }), { key: 'ArrowDown' });
      const dragged = ctx().bodies[0];
      const backdrop = () => within(humanoidFields()).getByRole('combobox', { name: 'Backdrop' });
      pickOption(backdrop(), 'Humanoid');
      expect(ctx().bodies[0]).toEqual(dragged);
      pickOption(backdrop(), 'Custom Image');
      pickOption(backdrop(), 'Humanoid');
      expect(ctx().bodies[0]).toEqual(dragged);
    });

    it('drops the last box when capacity falls, and clears a selection on it', () => {
      const { ctx } = renderWorldEditorBench(WORLD, 'simple');
      openEquipment();
      fireEvent.keyDown(boxButton('Hand 1'), { key: 'ArrowRight' });
      const kept = ctx().bodies[0].entries[0].boxes[0];
      fireEvent.focus(boxButton('Hand 2'));
      fireEvent.change(within(humanoidFields()).getByLabelText('Hand Capacity'), { target: { value: '1' } });
      fireEvent.blur(within(humanoidFields()).getByLabelText('Hand Capacity'));
      expect(ctx().bodies[0].entries[0].boxes).toEqual([kept]);
      expect(within(humanoidFields()).queryAllByRole('button', { pressed: true })).toEqual([]);
      expect(humanoidFields().querySelector('[data-editor-row-selected]')).toBeNull();
    });

    it('sets the aspect from an outline and keeps it on Plain, with the boxes in place', () => {
      const { ctx } = renderWorldEditorBench(WORLD, 'simple');
      openEquipment();
      const boxes = ctx().bodies[0].entries;
      const backdrop = () => within(humanoidFields()).getByRole('combobox', { name: 'Backdrop' });
      pickOption(backdrop(), 'Quadruped');
      expect(ctx().bodies[0]).toMatchObject({ backdrop: { kind: 'quadruped' }, aspect: 1.6, entries: boxes });
      pickOption(backdrop(), 'Plain');
      expect(ctx().bodies[0]).toMatchObject({ backdrop: { kind: 'plain' }, aspect: 1.6, entries: boxes });
    });

    describe('Custom Image', () => {
      const backdrop = () => within(humanoidFields()).getByRole('combobox', { name: 'Backdrop' });
      const link = async (url: string) => {
        fireEvent.change(within(humanoidFields()).getByLabelText('Image URL'), { target: { value: url } });
        await act(async () => { fireEvent.click(within(humanoidFields()).getByRole('button', { name: 'Use this image URL' })); });
      };

      it('is the fourth Backdrop', () => {
        renderWorldEditorBench(WORLD, 'simple');
        openEquipment();
        expect(options(backdrop())).toEqual(['Humanoid', 'Quadruped', 'Plain', 'Custom Image']);
      });

      it('leaves the Backdrop alone until a file lands, then draws it at the image\'s aspect with no edge drag', async () => {
        readImageAspect.mockResolvedValue(1.25);
        const { ctx } = renderWorldEditorBench(WORLD, 'simple');
        openEquipment();
        const before = ctx().bodies[0];
        pickOption(backdrop(), 'Custom Image');
        expect(ctx().bodies[0]).toEqual(before);
        expect(within(humanoidFields()).getByLabelText('Image URL')).toBeInTheDocument();

        await link('https://host/imp.png');
        expect(ctx().bodies[0]).toEqual({ ...before, backdrop: { kind: 'image', image: { data: 'https://host/imp.png' } }, aspect: 1.25 });
        expect(humanoidFields().querySelector('[data-body-layout-stage]')).toHaveStyle({ aspectRatio: '1.25' });
        expect(humanoidFields().querySelector('[data-body-layout-stage] img')).toHaveClass('object-contain');
        expect(within(humanoidFields()).queryByRole('slider', { name: 'Backdrop Height' })).toBeNull();
      });

      it('clamps an extreme image to the drag range', async () => {
        readImageAspect.mockResolvedValue(8);
        const { ctx } = renderWorldEditorBench(WORLD, 'simple');
        openEquipment();
        pickOption(backdrop(), 'Custom Image');
        await link('https://host/strip.png');
        expect(ctx().bodies[0].aspect).toBe(MAX_ASPECT);
      });

      it('keeps the boxes when it leaves for an outline, drops the image, and follows Q53 for the aspect', async () => {
        readImageAspect.mockResolvedValue(1.25);
        const { ctx } = renderWorldEditorBench(WORLD, 'simple');
        openEquipment();
        const entries = ctx().bodies[0].entries;
        pickOption(backdrop(), 'Custom Image');
        await link('https://host/imp.png');
        pickOption(backdrop(), 'Plain');
        expect(ctx().bodies[0]).toMatchObject({ backdrop: { kind: 'plain' }, aspect: 1.25, entries });
        pickOption(backdrop(), 'Custom Image');
        await link('https://host/imp.png');
        pickOption(backdrop(), 'Quadruped');
        expect(ctx().bodies[0]).toMatchObject({ backdrop: { kind: 'quadruped' }, aspect: 1.6, entries });
      });

      it('goes back to Humanoid when its image is removed', async () => {
        readImageAspect.mockResolvedValue(1.25);
        const { ctx } = renderWorldEditorBench(WORLD, 'simple');
        openEquipment();
        pickOption(backdrop(), 'Custom Image');
        await link('https://host/imp.png');
        fireEvent.click(within(humanoidFields()).getByRole('button', { name: /remove image/i }));
        expect(ctx().bodies[0]).toMatchObject({ backdrop: { kind: 'humanoid' }, aspect: 0.5 });
      });

      it('abandons a pick that never got a file when another Backdrop is chosen', () => {
        const { ctx } = renderWorldEditorBench(WORLD, 'simple');
        openEquipment();
        pickOption(backdrop(), 'Custom Image');
        pickOption(backdrop(), 'Quadruped');
        expect(within(humanoidFields()).queryByLabelText('Image URL')).toBeNull();
        expect(ctx().bodies[0]).toMatchObject({ backdrop: { kind: 'quadruped' } });
      });
    });

    it('changes the aspect from the bottom edge by keyboard, and leaves the boxes alone', () => {
      const { ctx } = renderWorldEditorBench(WORLD, 'simple');
      openEquipment();
      const entries = ctx().bodies[0].entries;
      fireEvent.keyDown(within(humanoidFields()).getByRole('slider', { name: 'Backdrop Height' }), { key: 'ArrowDown' });
      expect(ctx().bodies[0].aspect).toBeLessThan(0.5);
      expect(ctx().bodies[0].entries).toEqual(entries);
    });

    it('duplicates a Body after itself, with its Backdrop and boxes', () => {
      const { ctx } = renderWorldEditorBench(WORLD, 'simple');
      openEquipment();
      fireEvent.keyDown(boxButton('Ring'), { key: 'ArrowRight' });
      pickOption(within(humanoidFields()).getByRole('combobox', { name: 'Backdrop' }), 'Plain');
      fireEvent.click(screen.getByRole('button', { name: 'Duplicate Humanoid' }));
      const [source, copy, next] = ctx().bodies;
      expect(next.id).toBe('imp');
      expect(copy).toEqual({ ...source, id: expect.any(String), name: 'Humanoid (Copy)' });
      expect(copy.id).not.toBe(source.id);
    });

    it('remembers Snap to Others for the next visit, off the world', () => {
      const { unmount, ctx } = renderWorldEditorBench(WORLD, 'simple');
      openEquipment();
      const toggle = () => within(humanoidFields()).getByRole('checkbox');
      expect(toggle().getAttribute('data-state')).toBe('checked');
      fireEvent.click(toggle());
      expect(localStorage.getItem('FORMAMORPH_bodyLayoutSnap')).toBe('false');
      expect(JSON.stringify(ctx().bodies)).not.toContain('snap');
      unmount();
      renderWorldEditorBench(WORLD, 'simple');
      openEquipment();
      expect(toggle().getAttribute('data-state')).toBe('unchecked');
    });
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

  it('undoes a capacity drop', () => {
    const bench = renderWorldEditorBench(WORLD, 'simple');
    openEquipment();
    fireEvent.change(screen.getAllByLabelText('Hand Capacity')[0], { target: { value: '1' } });
    fireEvent.blur(screen.getAllByLabelText('Hand Capacity')[0]);
    act(() => bench.history().undo());
    expect(bench.ctx().bodies[0].entries[0]).toEqual({ slotId: 'hand', capacity: 2, boxes: [centerBox(0.5), centerBox(0.5)] });
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

  it('deletes a Body no entity picks at once', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openEquipment();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Humanoid' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(ctx().bodies.map((b) => b.id)).toEqual(['imp']);
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
