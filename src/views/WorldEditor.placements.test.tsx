import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { blankItem } from '@/lib/items';
import type { Placement, World } from '@/types';

/** Starting items: the Persona Items section on the Overview, and the Items tab on entities and locations. */

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

const WORLD: World = benchEditorWorld({
  items: [blankItem('lamp', 'Lamp'), blankItem('rope', 'Rope')],
  placements: [
    { id: 'p-wick', where: { kind: 'entity', id: 'resident' }, quantity: 2, source: { kind: 'item', itemId: 'rope' } },
    { id: 'p-steps', where: { kind: 'location', id: 'harbor' }, quantity: 1, hidden: true, source: { kind: 'item', itemId: 'lamp' } },
  ],
} as Partial<World>);

const section = (label: string) => screen.getByText(label, { selector: 'label' }).parentElement as HTMLElement;

const panelTab = (strip: string, name: string) =>
  fireEvent.mouseDown(within(screen.getByRole('tablist', { name: strip })).getByRole('tab', { name }));

const openEntityItems = () => {
  openEditorTab(/Entities/);
  fireEvent.click(screen.getByText('Odd Wick'));
  panelTab('Entity Fields', 'Items');
};

const openLocationItems = () => {
  fireEvent.mouseDown(screen.getByRole('tab', { name: /^Locations/ }));
  const row = screen.getAllByText('Harbor Steps').map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]')).find(Boolean);
  fireEvent.click(row as HTMLElement);
  panelTab('Location Fields', 'Items');
};

/** Open a Radix select by keyboard: a click needs pointer capture, which jsdom has not got. */
const pickOption = (combobox: HTMLElement, option: string) => {
  act(() => { fireEvent.keyDown(combobox, { key: 'Enter' }); });
  fireEvent.keyDown(screen.getByRole('option', { name: option }), { key: 'Enter' });
};

const placedAt = (placements: Placement[], kind: string) => placements.filter((p) => p.where.kind === kind);

beforeEach(() => { localStorage.clear(); });

describe('Persona Items on the Overview', () => {
  it('adds a starting item for the player, sets its quantity, item and Hidden, and exports it', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openEditorTab(/Overview/);
    const persona = section('Persona Items');
    fireEvent.click(within(persona).getByRole('button', { name: 'Add Item' }));
    fireEvent.change(within(persona).getByLabelText('Lamp Quantity'), { target: { value: '3' } });
    pickOption(within(persona).getByRole('combobox', { name: 'Item' }), 'Rope');
    fireEvent.click(within(persona).getByRole('checkbox', { name: 'Rope Hidden' }));

    const [placed] = placedAt(ctx().getWorldData().placements ?? [], 'you');
    expect(placed).toMatchObject({ where: { kind: 'you' }, quantity: 3, hidden: true, source: { kind: 'item', itemId: 'rope' } });

    fireEvent.click(within(persona).getByRole('checkbox', { name: 'Rope Hidden' }));
    expect(placedAt(ctx().getWorldData().placements ?? [], 'you')[0]).not.toHaveProperty('hidden');
    fireEvent.click(within(persona).getByRole('button', { name: 'Delete Rope' }));
    expect(placedAt(ctx().getWorldData().placements ?? [], 'you')).toEqual([]);
  });

  it('asks for items first in a world without any', () => {
    renderWorldEditorBench(benchEditorWorld({}), 'simple');
    openEditorTab(/Overview/);
    const persona = section('Persona Items');
    expect(persona.textContent).toContain('Add items on the Items tab first');
    expect(within(persona).getByRole('button', { name: 'Add Item' })).toHaveProperty('disabled', true);
  });
});

describe('the Items tab', () => {
  it("lists only that entity's starting items and adds to them", () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openEntityItems();
    expect(screen.getByLabelText('Rope Quantity')).toHaveProperty('value', '2');
    expect(screen.queryByLabelText('Lamp Quantity')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(placedAt(ctx().placements, 'entity').map((p) => [p.source.itemId, p.quantity])).toEqual([['rope', 2], ['lamp', 1]]);
  });

  it("lists only that location's starting items, Hidden and all", () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openLocationItems();
    expect(screen.getByRole('checkbox', { name: 'Lamp Hidden' })).toHaveProperty('ariaChecked', 'true');
    fireEvent.change(screen.getByLabelText('Lamp Quantity'), { target: { value: '4' } });
    expect(placedAt(ctx().placements, 'location')).toMatchObject([{ quantity: 4, hidden: true }]);
  });
});

describe('placements of a deleted owner', () => {
  it('go with the entity or location they were on', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    act(() => { ctx().removeEntity('resident'); });
    expect(ctx().placements.map((p) => p.id)).toEqual(['p-steps']);
    act(() => { ctx().removeLocation('harbor'); });
    expect(ctx().placements).toEqual([]);
  });
});
