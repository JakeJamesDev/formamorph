import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import type { World } from '@/types';

/** The Nearby / Far choice in the canvas's Connection panel. */

vi.mock('@/lib/authoringTour/tourImages', () => ({
  loadTourImage: async (name: string) => `data:image/webp;base64,${name}`,
}));

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
  locations: [
    { id: 'harbor', name: 'Harbor Steps', isStarting: true },
    { id: 'docks', name: 'Docks' },
  ],
  connections: [{ id: 'c1', a: 'harbor', b: 'docks', aToB: { hint: 'by ferry' }, bToA: {} }],
});

const step = async (action: () => void) => { await act(async () => { action(); }); await new Promise((r) => setTimeout(r, 5)); };
const undo = () => step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });

beforeEach(() => {
  localStorage.clear();
  reloadTourProgress();
});

/** Opens the canvas with the Connection's panel showing: an undone hint edit reveals it selected. */
async function openConnectionPanel({ ctx }: ReturnType<typeof renderWorldEditorBench>) {
  openEditorTab(/Locations/);
  fireEvent.click(screen.getByRole('radio', { name: 'Canvas' }));
  await step(() => ctx().updateConnection({ ...ctx().connections[0], aToB: {} }));
  await undo();
  expect(screen.getByRole('radiogroup', { name: /^Distance between/ })).toBeTruthy();
}

describe('the Connection panel on the Locations Canvas', () => {
  it('shows a Connection as Nearby, sets it to Far, and stores only Far', async () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    const { ctx } = bench;
    await openConnectionPanel(bench);
    expect(screen.getByRole('radio', { name: 'Nearby' }).getAttribute('aria-checked')).toBe('true');

    await step(() => fireEvent.click(screen.getByRole('radio', { name: 'Far' })));
    expect(ctx().connections[0].distance).toBe('far');

    await step(() => fireEvent.click(screen.getByRole('radio', { name: 'Nearby' })));
    expect(ctx().connections[0]).not.toHaveProperty('distance');
  });

  it('undoes a distance change in one step', async () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    const { ctx } = bench;
    await openConnectionPanel(bench);
    await step(() => fireEvent.click(screen.getByRole('radio', { name: 'Far' })));

    await undo();
    expect(ctx().connections[0]).toEqual(WORLD.connections![0]);
  });
});
