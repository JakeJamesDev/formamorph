import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench, shownEditorTab } from '@/test/worldEditorBench';
import type { World } from '@/types';

/** The location Presence tab: the Generic entities-only picker, and who can be here and why. */

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
    // At the tavern only through Can Also Go.
    { id: 'courier', name: 'Courier', kind: 'unique', locations: ['yard'], traversable: ['tavern'], starts: [{ id: 'k1', place: 'yard', weight: 1, schedule: [] }] },
    { id: 'me', name: 'Me', customPersona: true, locations: ['tavern'], starts: [{ id: 'm1', place: 'tavern', weight: 1, schedule: [] }] },
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

describe('the Presence tab: Add Entity', () => {
  it('offers each Unique and Generic entity with no row here, and adding one is one undo step', async () => {
    const user = userEvent.setup();
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    await user.click(screen.getByRole('combobox', { name: 'Add an entity here' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Moths', 'Rats', 'Queen']);

    await user.click(await screen.findByRole('option', { name: 'Moths' }));
    expect(ctx().entities.find((e) => e.id === 'moths')!.locations).toEqual(['tavern']);

    await undo();
    expect(ctx().entities.find((e) => e.id === 'moths')!.locations).toBeUndefined();
  });

  it('does not offer a Generic entity that only a row brings here, and adds no Start to it when another entity is added', async () => {
    const user = userEvent.setup();
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Cellar');
    await user.click(screen.getByRole('combobox', { name: 'Add an entity here' }));
    expect(screen.queryByRole('option', { name: 'Rats' })).toBeNull();
    await user.click(await screen.findByRole('option', { name: 'Moths' }));
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
  it('holds no Connections; they have a tab of their own', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    expect(screen.queryByRole('combobox', { name: 'Connect To' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('connection-row')).not.toBeInTheDocument();
  });
});

const list = () => within(screen.getByTestId('entities-here'));
const row = (name: string) => list().getByRole('button', { name: new RegExp(`^${name}, `) });
const selectedRows = () => list().queryAllByRole('button', { current: true }).map((b) => b.getAttribute('aria-label')!.split(',')[0]);
const editor = () => screen.queryByTestId('presence-editor');
/** Opens another location from the tree, as a click on its row does. */
const openLocation = (name: string) => {
  fireEvent.click(screen.getAllByText(name).map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]')).find(Boolean)!);
};
const openLocationTab = (name: string) =>
  fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Location Fields' })).getByRole('tab', { name }));

describe('the Presence tab: the list and its editor', () => {
  it('has a row for a Unique entity that begins here, a Generic entity with a Start here and one here through Can Also Go, and none for the Custom Persona', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    expect(list().getAllByTestId('presence-row').map((r) => r.textContent)).toEqual([
      'CrowdBegins here',
      'FarrierBegins here (25%), wanders here (All day)',
      'CourierCan be led here',
    ]);
    expect(list().queryByText('Me')).toBeNull();
  });

  it('opens with no row selected and a hint in place of the editor', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    expect(selectedRows()).toEqual([]);
    expect(editor()).toBeNull();
    expect(list().getByText('Select an entity to edit its Routine and Known In')).toBeTruthy();
  });

  it('shows the selected entity’s Routine editor under the list, and the switch changes it to Known In', async () => {
    const user = userEvent.setup();
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    await user.click(row('Farrier'));
    expect(selectedRows()).toEqual(['Farrier']);
    const region = within(editor()!);
    expect(region.getByText('Farrier')).toBeTruthy();
    expect(region.getByRole('group', { name: 'Starts' })).toBeTruthy();
    expect(region.queryByRole('combobox', { name: 'Known In' })).toBeNull();

    await user.click(region.getByRole('radio', { name: 'Known In' }));
    expect(region.getByRole('combobox', { name: 'Known In' })).toBeTruthy();
    expect(region.queryByRole('group', { name: 'Starts' })).toBeNull();
  });

  it('writes a Routine edit made in the editor to the entity', async () => {
    const user = userEvent.setup();
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    await user.click(row('Farrier'));
    await user.click(within(editor()!).getAllByRole('button', { name: 'Delete Start' })[0]);
    expect(ctx().entities.find((e) => e.id === 'farrier')!.starts!.length).toBe(1);
  });

  it('replaces the selection with a second row, and clears it from the selected row or the close button', async () => {
    const user = userEvent.setup();
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    await user.click(row('Crowd'));
    await user.click(row('Farrier'));
    expect(selectedRows()).toEqual(['Farrier']);
    expect(within(editor()!).getByText('Farrier')).toBeTruthy();

    await user.click(row('Farrier'));
    expect(selectedRows()).toEqual([]);
    expect(editor()).toBeNull();

    await user.click(row('Courier'));
    await user.click(within(editor()!).getByRole('button', { name: 'Close Entity' }));
    expect(selectedRows()).toEqual([]);
    expect(editor()).toBeNull();
  });

  it('moves through the rows with the arrow keys, and Enter or Space selects', async () => {
    const user = userEvent.setup();
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    row('Crowd').focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(row('Farrier'));
    await user.keyboard('{Enter}');
    expect(selectedRows()).toEqual(['Farrier']);
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(document.activeElement).toBe(row('Crowd'));
    await user.keyboard(' ');
    expect(selectedRows()).toEqual(['Crowd']);
    // One stop in the tab order: the selected row.
    expect(list().getAllByTestId('presence-row').map((r) => r.querySelector('button')!.tabIndex)).toEqual([0, -1, -1]);
  });

  it('keeps the entity selected at another location where it has a row, and clears it where it has none', async () => {
    const user = userEvent.setup();
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    await user.click(row('Farrier'));
    await step(() => openLocation('Yard'));
    expect(selectedRows()).toEqual(['Farrier']);

    await step(() => openLocation('Tavern'));
    await user.click(row('Crowd'));
    await step(() => openLocation('Yard'));
    expect(selectedRows()).toEqual([]);
    // Cleared, not only hidden: back where it has a row, it is not selected.
    await step(() => openLocation('Tavern'));
    expect(selectedRows()).toEqual([]);
  });

  it('clears the selection on a change to another tab', async () => {
    const user = userEvent.setup();
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    await user.click(row('Farrier'));
    await step(() => openLocationTab('Connections'));
    await step(() => openLocationTab('Presence'));
    expect(selectedRows()).toEqual([]);
    expect(editor()).toBeNull();
  });

  it('clears the selection when the Locations section leaves the screen', async () => {
    const user = userEvent.setup();
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    await user.click(row('Farrier'));
    await step(() => fireEvent.click(screen.getByRole('button', { name: 'Open Farrier’s Routine' })));
    await step(() => openEditorTab(/Locations/));
    expect(within(screen.getByRole('tablist', { name: 'Location Fields' })).getByRole('tab', { selected: true }).textContent).toMatch(/Presence/);
    expect(selectedRows()).toEqual([]);
  });
});
