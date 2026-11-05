import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderLocationsTab } from '@/test/locationsTabBench';
import { panelWorld } from '@/test/panelBench';

/** Deleting a location from the tree and from the filtered list: its id leaves entities and Connections. */

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

const WORLD = panelWorld({
  locations: [
    { id: 'harbor', name: 'Harbor Steps', isStarting: true },
    { id: 'wood', name: 'The Veilwood' },
    { id: 'hollow', name: 'The Hollow', parentId: 'wood' },
  ],
  entities: [{
    id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.',
    aiDescription: 'Keeps the harbor lamps lit.', locations: ['harbor', 'wood'],
  }],
  connections: [
    { id: 'c1', a: 'harbor', b: 'wood', aToB: {}, bToA: {} },
    { id: 'c2', a: 'hollow', b: 'harbor', aToB: {}, bToA: {} },
  ],
} as never);

const row = (name: string) => {
  const found = screen.getAllByText(name)
    .map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]'))
    .find(Boolean);
  if (!found) throw new Error(`No row named ${name}`);
  return found;
};

const openLocations = async () => {
  await screen.findAllByText('The Veilwood');
};

const deleteRow = (name: string) => fireEvent.click(within(row(name)).getByRole('button', { name: 'Delete' }));

const expectCleanDelete = (ctx: ReturnType<ReturnType<typeof renderLocationsTab>['ctx']>) => {
  expect(ctx.locations.map((l) => l.id)).toEqual(['harbor', 'hollow']);
  // The sub-location moves up to the deleted location's parent.
  expect(ctx.locations.find((l) => l.id === 'hollow')?.parentId ?? null).toBeNull();
  expect(ctx.entities[0].locations).toEqual(['harbor']);
  expect(ctx.connections.map((c) => c.id)).toEqual(['c2']);
  expect(JSON.stringify(ctx.getWorldData())).not.toContain('"wood"');
};

describe('World Editor — deleting a location', () => {
  it('drops the id from entities and Connections when deleted from the tree', async () => {
    const { ctx } = renderLocationsTab(WORLD, 'advanced');
    await openLocations();

    deleteRow('The Veilwood');

    expectCleanDelete(ctx());
  });

  it('does the same when deleted from the filtered list', async () => {
    const { ctx } = renderLocationsTab(WORLD, 'advanced');
    await openLocations();
    fireEvent.change(screen.getByPlaceholderText('Filter Locations'), { target: { value: 'Veil' } });

    deleteRow('The Veilwood');

    expectCleanDelete(ctx());
  });

});
