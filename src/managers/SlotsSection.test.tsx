import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { screen, fireEvent, within } from '@testing-library/react';
import { panelWorld, renderPanelBench } from '@/test/panelBench';
import SlotsSection from './SlotsSection';
import type { EditorMode } from '@/lib/editorMode';
import { blankItem } from '@/lib/items';
import type { Body, Entity, Item, Placement, Slot, World } from '@/types';

/** The Equipment Settings entry's slots: adding one, and what deleting one clears. */

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

const WORLD: World = panelWorld({ items: ITEMS, slots: SLOTS, bodies: BODIES, placements: PLACEMENTS, entities: ENTITIES } as Partial<World>);

const renderSlotsSection = (world: World, mode: EditorMode) => renderPanelBench(world, mode, <SlotsSection />);

beforeEach(() => { localStorage.clear(); });

describe('the Slots section', () => {
  it('adds and renames a slot, which has a name only', () => {
    const { ctx } = renderSlotsSection(panelWorld({}), 'advanced');
    fireEvent.click(screen.getByRole('button', { name: 'Add Slot' }));
    fireEvent.change(screen.getByLabelText('Slot Name'), { target: { value: 'Head' } });
    expect(ctx().slots).toEqual([{ id: expect.any(String), name: 'Head' }]);
  });

  it('counts the items and Body entries a slot in use has, then clears them', () => {
    const { ctx } = renderSlotsSection(WORLD, 'advanced');
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
    renderSlotsSection(WORLD, 'advanced');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ring' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('This also deletes its Body entry.');
  });

  it('deletes an unused slot at once', () => {
    const { ctx } = renderSlotsSection(WORLD, 'advanced');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Tail' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(ctx().slots.map((s) => s.id)).toEqual(['hand', 'ring']);
  });
});
