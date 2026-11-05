import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { blankItem } from '@/lib/items';
import type { Body, Entity, Item, Placement, Slot, World } from '@/types';
import { renderEntitiesTab } from '@/test/entitiesTabBench';
import { panelWorld } from '@/test/panelBench';

/** The entity Body select on the Items tab. */

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

const WORLD: World = panelWorld({ items: ITEMS, slots: SLOTS, bodies: BODIES, placements: PLACEMENTS, entities: ENTITIES } as Partial<World>);

const section = (label: string) => screen.getByText(label, { selector: 'label' }).closest('[data-history-field]') as HTMLElement;

const openEntityItems = (name: string) => {
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



describe('the entity Body select', () => {
  const bodySelect = () => screen.getByRole('combobox', { name: 'Body' });

  it('lists Default with the first Body, None, then each Body, and saves the pick', () => {
    const { ctx } = renderEntitiesTab(WORLD, 'simple');
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
    renderEntitiesTab(WORLD, 'simple');
    openEntityItems('Custom Persona');
    expect(section('Body').textContent).toContain("Also sets the player's Body under None or a library persona");
    expect(bodySelect()).toBeTruthy();
  });

  it('points at Equipment in a world without Bodies', () => {
    renderEntitiesTab(panelWorld({}), 'simple');
    openEntityItems('Odd Wick');
    expect(screen.queryByRole('combobox', { name: 'Body' })).toBeNull();
    expect(section('Body').textContent).toContain('Add a Body in Equipment Settings');
  });
});
