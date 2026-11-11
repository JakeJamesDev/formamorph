import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench, shownEditorTab } from '@/test/worldEditorBench';
import type { World } from '@/types';

/** The location Presence tab: the Generic entities-only picker, who can be here and why, and the Connection distance. */

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
  connections: [{ id: 'c1', a: 'tavern', b: 'yard', aToB: {}, bToA: {} }],
  entities: [
    { id: 'crowd', name: 'Crowd', kind: 'generic', locations: ['tavern'], starts: [{ id: 's1', place: 'tavern', weight: 1, schedule: [] }] },
    { id: 'moths', name: 'Moths', kind: 'generic' },
    // Begins in the yard and only visits the cellar on a row.
    {
      id: 'rats', name: 'Rats', kind: 'generic', locations: ['yard', 'cellar'],
      starts: [{ id: 'r1', place: 'yard', weight: 1, schedule: [{ id: 'dig', time: 'allDay', action: { kind: 'stay', place: 'cellar' } }] }],
    },
    {
      id: 'farrier', name: 'Farrier', kind: 'unique', locations: ['yard', 'tavern', 'cellar'], traversable: ['cellar'],
      starts: [
        { id: 's1', place: 'yard', weight: 3, schedule: [
          { id: 'r1', time: 'allDay', action: { kind: 'wander', places: [{ place: 'yard', weight: 1 }, { place: 'tavern', weight: 1 }], idle: 60 } },
        ] },
        { id: 's2', place: 'tavern', weight: 1, schedule: [] },
      ],
    },
    { id: 'queen', name: 'Queen', kind: 'unique', locations: ['yard'], traversable: 'anywhere', starts: [{ id: 'q1', place: 'yard', weight: 1, schedule: [] }] },
  ],
} as Partial<World>);

const step = async (action: () => void) => { await act(async () => { action(); }); await new Promise((r) => setTimeout(r, 5)); };
const undo = () => step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });

beforeEach(() => { localStorage.clear(); });

/** Opens a location's Presence tab from the tree. */
function openPresence(name: string) {
  openEditorTab(/Locations/);
  const row = screen.getAllByText(name).map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]')).find(Boolean)!;
  fireEvent.click(row);
  fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Location Fields' })).getByRole('tab', { name: 'Presence' }));
}

describe('the Presence tab: Entities', () => {
  it('offers Generic entities only, and adding one is one undo step', async () => {
    const user = userEvent.setup();
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    await user.click(screen.getByRole('combobox', { name: /Select entities/ }));
    const names = screen.getAllByRole('option').map((o) => o.getAttribute('aria-label') ?? o.textContent ?? '');
    expect(names.filter((n) => /, (not )?selected$/.test(n))).toEqual(['Crowd, selected', 'Moths, not selected', 'Rats, not selected']);

    await user.click(await screen.findByRole('option', { name: 'Moths, not selected' }));
    await user.keyboard('{Escape}');
    expect(ctx().entities.find((e) => e.id === 'moths')!.locations).toEqual(['tavern']);

    await undo();
    expect(ctx().entities.find((e) => e.id === 'moths')!.locations).toBeUndefined();
  });
});

describe('the Presence tab: Entities, for a Generic entity that only visits', () => {
  it('leaves a Generic entity unticked when only a row brings it here, and adds it no Start when another Generic entity is picked', async () => {
    const user = userEvent.setup();
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Cellar');
    await user.click(screen.getByRole('combobox', { name: /Select entities/ }));
    expect(screen.getByRole('option', { name: 'Rats, not selected' })).toBeTruthy();
    await user.click(await screen.findByRole('option', { name: 'Moths, not selected' }));
    await user.keyboard('{Escape}');
    expect(ctx().entities.find((e) => e.id === 'rats')!.starts?.map((s) => s.place)).toEqual(['yard']);
    expect(ctx().entities.find((e) => e.id === 'moths')!.starts?.map((s) => s.place)).toEqual(['cellar']);
  });
});

describe('the Presence tab: Entities Here', () => {
  it('lists each entity that can be here with its reasons, and no other', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    const list = within(screen.getByTestId('entities-here'));
    expect(list.getByText('Crowd').parentElement!.textContent).toBe('CrowdBegins here');
    // Two Starts (3:1), the Start at the tavern, and the Wander row.
    expect(list.getByText('Farrier').parentElement!.textContent).toBe('FarrierBegins here (25%), wanders here (All day)');
    expect(list.queryByText('Queen')).toBeNull();
    expect(list.queryByText('Moths')).toBeNull();
  });

  it('gives a listed Traversable place as the only reason, and Anywhere none', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Cellar');
    const list = within(screen.getByTestId('entities-here'));
    expect(list.getByText('Farrier').parentElement!.textContent).toBe('FarrierCan be led here');
    expect(list.queryByText('Queen')).toBeNull();
  });

  it('says so when no entity can be here', () => {
    const empty = { ...WORLD, entities: [] } as World;
    renderWorldEditorBench(empty, 'advanced');
    openPresence('Tavern');
    expect(within(screen.getByTestId('entities-here')).getByText('No entity can be here')).toBeTruthy();
  });

  it('opens the entity’s Routine tab from its line', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    await step(() => fireEvent.click(screen.getByRole('button', { name: 'Open Farrier’s Routine' })));
    expect(shownEditorTab()).toMatch(/Entities/);
    expect(within(screen.getByRole('tablist', { name: /Entity/ })).getByRole('tab', { selected: true }).textContent).toMatch(/Routine/);
  });
});

describe('the Presence tab: Connections', () => {
  it('sets a Connection to Far, stores only Far, and undoes in one step', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    const near = screen.getByRole('radio', { name: 'Nearby' });
    expect(near.getAttribute('aria-checked')).toBe('true');

    await step(() => fireEvent.click(screen.getByRole('radio', { name: 'Far' })));
    expect(ctx().connections[0].distance).toBe('far');

    await undo();
    expect(ctx().connections[0]).toEqual(WORLD.connections![0]);
  });

  it('shows a Far Connection as Far from either end', () => {
    const far = { ...WORLD, connections: [{ ...WORLD.connections![0], distance: 'far' }] } as World;
    renderWorldEditorBench(far, 'advanced');
    openPresence('Yard');
    expect(screen.getByRole('radio', { name: 'Far' }).getAttribute('aria-checked')).toBe('true');
  });
});
