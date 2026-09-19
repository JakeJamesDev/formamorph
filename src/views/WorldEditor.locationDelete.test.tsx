import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';

/**
 * Guards what a location delete leaves behind, through the editor's own delete buttons.
 *
 * `GameDataContext.test.tsx` covers `removeLocation` in isolation. These cases fail when a delete button
 * writes the locations array alone, which leaves the dead id on entities and Connections.
 */

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

const WORLD = benchEditorWorld({
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
    { id: 'c1', from: 'harbor', to: 'wood', twoWay: true },
    { id: 'c2', from: 'hollow', to: 'harbor', twoWay: true },
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
  fireEvent.mouseDown(await screen.findByRole('tab', { name: /^Locations/ }));
  await screen.findAllByText('The Veilwood');
};

const deleteRow = (name: string) => fireEvent.click(within(row(name)).getByRole('button', { name: 'Delete' }));

const expectCleanDelete = (ctx: ReturnType<ReturnType<typeof renderWorldEditorBench>['ctx']>) => {
  expect(ctx.locations.map((l) => l.id)).toEqual(['harbor', 'hollow']);
  // The sub-location moves up to the deleted location's parent.
  expect(ctx.locations.find((l) => l.id === 'hollow')?.parentId ?? null).toBeNull();
  expect(ctx.entities[0].locations).toEqual(['harbor']);
  expect(ctx.connections.map((c) => c.id)).toEqual(['c2']);
  expect(JSON.stringify(ctx.getWorldData())).not.toContain('"wood"');
};

describe('World Editor — deleting a location', () => {
  it('drops the id from entities and Connections when deleted from the tree', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await openLocations();

    deleteRow('The Veilwood');

    expectCleanDelete(ctx());
  });

  it('does the same when deleted from the filtered list', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await openLocations();
    fireEvent.change(screen.getByPlaceholderText('Search or add new locations'), { target: { value: 'Veil' } });

    deleteRow('The Veilwood');

    expectCleanDelete(ctx());
  });

  it('restores the location, its membership, and its Connections on Exit Without Saving', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await openLocations();
    deleteRow('The Veilwood');

    fireEvent.click(document.querySelector('.lucide-arrow-left')!.closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Exit Without Saving' }));

    expect(ctx().locations.map((l) => l.id)).toEqual(['harbor', 'wood', 'hollow']);
    expect(ctx().locations.find((l) => l.id === 'hollow')?.parentId).toBe('wood');
    expect(ctx().entities[0].locations).toEqual(['harbor', 'wood']);
    expect(ctx().connections.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(ctx().isWorldDirty).toBe(false);
  });
});
