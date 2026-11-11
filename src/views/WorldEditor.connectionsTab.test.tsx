import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench, searchWorldField } from '@/test/worldEditorBench';
import { frames } from '@/test/landing';
import { LANDING_PULSE_CLASS, landingTarget } from '@/lib/landingPulse';
import type { World } from '@/types';

/** The location Connections tab: its place in the strip, its folding rows, and the search and undo that land in one. */

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
    { id: 'tavern', name: 'Tavern' },
    { id: 'yard', name: 'Yard' },
    { id: 'cellar', name: 'Cellar' },
  ],
  connections: [
    { id: 'c1', a: 'tavern', b: 'yard', aToB: {}, bToA: {} },
    { id: 'c2', a: 'tavern', b: 'cellar', aToB: { hint: 'down the trapdoor ladder' } },
  ],
} as Partial<World>);

const step = async (action: () => void) => { await act(async () => { action(); }); await new Promise((r) => setTimeout(r, 5)); };
const undo = async () => {
  await step(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'z', ctrlKey: true }); });
  await frames(2);
};

const strip = () => screen.getByRole('tablist', { name: 'Location Fields' });
const header = (name: string) => screen.getByRole('button', { name });

/** Opens a location's Connections tab from the tree. */
function openConnections(name: string) {
  openEditorTab(/Locations/);
  const row = screen.getAllByText(name).map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]')).find(Boolean)!;
  fireEvent.click(row);
  fireEvent.mouseDown(within(strip()).getByRole('tab', { name: 'Connections' }));
}

beforeEach(() => { localStorage.clear(); });

describe('the Connections tab', () => {
  it.each(['simple', 'advanced'] as const)('follows Presence in %s mode', async (mode) => {
    renderWorldEditorBench(WORLD, mode);
    openEditorTab(/Locations/);
    fireEvent.click(screen.getAllByText('Tavern').map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]')).find(Boolean)!);
    const labels = within(strip()).getAllByRole('tab').map((tab) => tab.textContent);
    expect(labels.indexOf('Connections')).toBe(labels.indexOf('Presence') + 1);
  });

  it('lists the Connections closed, with the picker under them', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openConnections('Tavern');
    expect(header('Yard, Both Ways')).toHaveAttribute('aria-expanded', 'false');
    expect(header('Cellar, To There')).toHaveAttribute('aria-expanded', 'false');
    const rows = screen.getAllByTestId('connection-row');
    const picker = screen.getByRole('combobox', { name: 'Connect To' });
    expect(rows.at(-1)!.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sets a Connection to Far, stores only Far, and undoes in one step', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openConnections('Tavern');
    fireEvent.click(header('Yard, Both Ways'));
    expect(screen.getByRole('radio', { name: 'Nearby' }).getAttribute('aria-checked')).toBe('true');

    await step(() => fireEvent.click(screen.getByRole('radio', { name: 'Far' })));
    expect(ctx().connections[0].distance).toBe('far');

    await undo();
    expect(ctx().connections[0]).toEqual(WORLD.connections![0]);
  });

  it('shows a Far Connection as Far from either end', () => {
    const far = { ...WORLD, connections: [{ ...WORLD.connections![0], distance: 'far' }] } as World;
    renderWorldEditorBench(far, 'advanced');
    openConnections('Yard');
    const row = screen.getByTestId('connection-row');
    expect(row.querySelector('[data-distance-mark]')).toHaveAttribute('data-distance-mark', 'far');
    fireEvent.click(header('Tavern, Both Ways'));
    expect(screen.getByRole('radio', { name: 'Far' }).getAttribute('aria-checked')).toBe('true');
  });

  it('lands a Travel Hint search on the Connections tab with its row open and the hint marked', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    fireEvent.change(searchWorldField(), { target: { value: 'trapdoor' } });
    await waitFor(() => expect(within(strip()).getByRole('tab', { name: 'Connections', selected: true })).toBeInTheDocument());
    await waitFor(() => expect(header('Cellar, To There')).toHaveAttribute('aria-expanded', 'true'));
    expect(header('Yard, Both Ways')).toHaveAttribute('aria-expanded', 'false');
    const box = screen.getByLabelText('Travel Hint to Cellar');
    await waitFor(() => expect(box.closest('.editor-find-target')).not.toBeNull());
  });

  it('opens a closed row when an undo lands on its field', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openConnections('Tavern');
    fireEvent.click(header('Yard, Both Ways'));
    const far = screen.getByRole('radio', { name: 'Far' });
    await step(() => far.focus());
    await step(() => fireEvent.click(far));
    expect(ctx().connections[0].distance).toBe('far');
    fireEvent.click(header('Yard, Both Ways'));
    expect(screen.queryByRole('radiogroup', { name: 'Distance to Yard' })).not.toBeInTheDocument();

    await undo();
    expect(ctx().connections[0]).toEqual(WORLD.connections![0]);
    await waitFor(() => expect(header('Yard, Both Ways')).toHaveAttribute('aria-expanded', 'true'));
    await waitFor(() => expect(document.querySelectorAll(`.${LANDING_PULSE_CLASS}`)).toHaveLength(1));
    const pulsed = landingTarget(document.querySelector<HTMLElement>(`.${LANDING_PULSE_CLASS}`)!);
    expect(pulsed).toBe(screen.getByRole('radiogroup', { name: 'Distance to Yard' }));

    // The reveal's request is spent: a later visit to the tab finds the row as the author left it.
    fireEvent.click(header('Yard, Both Ways'));
    fireEvent.mouseDown(within(strip()).getByRole('tab', { name: 'Presence' }));
    fireEvent.mouseDown(within(strip()).getByRole('tab', { name: 'Connections' }));
    expect(header('Yard, Both Ways')).toHaveAttribute('aria-expanded', 'false');
  });
});
