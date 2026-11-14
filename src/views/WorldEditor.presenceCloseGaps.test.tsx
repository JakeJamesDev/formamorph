import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { resetRoutineSelections } from '@/lib/routineSelection';
import type { World } from '@/types';
import { oneRoutine } from '@/test/routines';
import { startsOf } from '@/lib/entityKind';

/** The Presence tab's Start on a change of location, Add Entity's mode, and Picked Locations beside the panel. */

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
    // Start 1 begins at the tavern, Start 2 at the yard.
    {
      id: 'twin', name: 'Twin', kind: 'unique', locations: ['tavern', 'yard'],
      routines: oneRoutine([
        { id: 'a', place: 'tavern', weight: 1, schedule: [{ id: 'r1', time: 'allDay', action: { kind: 'stay', place: 'tavern' } }] },
        { id: 'b', place: 'yard', weight: 1, schedule: [] },
      ]),
    },
    { id: 'crowd', name: 'Crowd', kind: 'generic', locations: ['tavern'], routines: oneRoutine([{ id: 'c1', place: 'tavern', weight: 1, schedule: [] }]) },
    { id: 'moths', name: 'Moths', kind: 'generic' },
  ],
} as Partial<World>);

const step = async (action: () => void) => { await act(async () => { action(); }); await new Promise((r) => setTimeout(r, 5)); };
const undo = () => step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });

beforeEach(() => { localStorage.clear(); resetRoutineSelections(); });

const openTreeRow = (name: string) => step(() => fireEvent.click(
  screen.getAllByText(name).map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]')).find(Boolean)!,
));
const openPresenceTab = () => step(() => fireEvent.mouseDown(
  within(screen.getByRole('tablist', { name: 'Location Fields' })).getByRole('tab', { name: 'Presence' }),
));
const presenceList = () => within(screen.getByTestId('entities-here'));
const selectRow = (name: RegExp) => step(() => fireEvent.click(presenceList().getByRole('button', { name })));
const editor = () => within(screen.getByTestId('presence-editor'));
const startButton = (n: number) => within(screen.getByRole('group', { name: 'Starts' })).getByRole('button', { name: new RegExp(`^Start ${n}`) });
const startOnShow = () => [1, 2].find((n) => startButton(n).getAttribute('aria-pressed') === 'true');
const chooseMode = (name: 'Routine' | 'Known In') => step(() => fireEvent.click(editor().getByRole('radio', { name })));
const clickCanvasLocation = (id: string) => step(() => fireEvent.click(document.querySelector(`.react-flow__node[data-id="${id}"]`)!));
const deleteRoutineRow = () => step(() => fireEvent.click(
  within(screen.getByRole('list', { name: 'Routine' })).getByRole('button', { name: /^Delete / }),
));

async function selectTwinAtTavern() {
  openEditorTab(/Locations/);
  await openTreeRow('Tavern');
  await openPresenceTab();
  await selectRow(/^Twin, /);
}

describe('a pick kept across a change of location', () => {
  it('shows the Start that names the new location, after a click on the canvas', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await selectTwinAtTavern();
    expect(startOnShow()).toBe(1);
    await step(() => fireEvent.click(screen.getByRole('radio', { name: 'Canvas' })));
    await clickCanvasLocation('yard');

    expect(presenceList().getByRole('button', { current: true }).getAttribute('aria-label')).toMatch(/^Twin, /);
    expect(startOnShow()).toBe(2);
  });

  it('shows the Start that names the new location, after a click in the tree', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await selectTwinAtTavern();
    expect(startOnShow()).toBe(1);
    await openTreeRow('Yard');

    expect(presenceList().getByRole('button', { current: true }).getAttribute('aria-label')).toMatch(/^Twin, /);
    expect(startOnShow()).toBe(2);
  });

  it('keeps the Start of an undo that arrives at a location the Start does not name', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    // The edit is on Start 1 at the yard's Presence tab; Start 1 names the tavern only.
    openEditorTab(/Locations/);
    await openTreeRow('Yard');
    await openPresenceTab();
    await selectRow(/^Twin, /);
    expect(startOnShow()).toBe(2);
    await step(() => fireEvent.click(startButton(1)));
    await deleteRoutineRow();
    expect(startsOf(ctx().entities.find((e) => e.id === 'twin')!)![0].schedule).toHaveLength(0);
    await openTreeRow('Tavern');
    expect(startOnShow()).toBe(1);

    await undo();
    expect(startsOf(ctx().entities.find((e) => e.id === 'twin')!)![0].schedule).toHaveLength(1);
    expect(presenceList().getByRole('button', { current: true }).getAttribute('aria-label')).toMatch(/^Twin, /);
    expect(startOnShow()).toBe(1);
  });
});

describe('the mode of a Presence selection', () => {
  it('opens an entity added with Add Entity in Routine mode on its new Start', async () => {
    const user = userEvent.setup();
    renderWorldEditorBench(WORLD, 'advanced');
    await selectTwinAtTavern();
    await chooseMode('Known In');
    await user.click(screen.getByRole('combobox', { name: 'Add an entity here' }));
    await user.click(await screen.findByRole('option', { name: 'Moths' }));

    expect(presenceList().getByRole('button', { current: true }).getAttribute('aria-label')).toMatch(/^Moths, /);
    expect(editor().getByRole('radio', { name: 'Routine' }).getAttribute('aria-checked')).toBe('true');
    expect(startOnShow()).toBe(1);
  });

  it('keeps Known In mode on a row click', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await selectTwinAtTavern();
    await chooseMode('Known In');
    await selectRow(/^Crowd, /);
    expect(editor().getByRole('radio', { name: 'Known In' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('the editor hints beside the panel', () => {
  const pickPickedLocations = async (user: ReturnType<typeof userEvent.setup>) => {
    await chooseMode('Known In');
    await user.click(editor().getByRole('combobox', { name: 'Known In' }));
    await user.click(await screen.findByRole('option', { name: 'Picked Locations' }));
  };

  it('sends Picked Locations to full screen, which opens on the same entity in Known In mode', async () => {
    const user = userEvent.setup();
    renderWorldEditorBench(WORLD, 'advanced');
    await selectTwinAtTavern();
    await pickPickedLocations(user);
    expect(editor().getByText('Pick its locations in full screen')).toBeInTheDocument();
    expect(editor().queryByText(/^Click a location/)).toBeNull();

    // From the list view: the button puts the canvas on screen and opens it full screen.
    await step(() => fireEvent.click(editor().getByRole('button', { name: 'Edit Full Screen' })));
    const card = within(screen.getByTestId('entity-pick-card'));
    expect(card.getByRole('combobox', { name: 'Entity' }).textContent).toBe('Twin');
    expect(card.getByRole('radio', { name: 'Known In' }).getAttribute('aria-checked')).toBe('true');
    expect(card.getByText('Click a location to pick it. A pick covers every location inside it.')).toBeInTheDocument();
    expect(card.queryByText('Pick its locations in full screen')).toBeNull();
  });

  it('gives no hint to click a location, in either mode', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);
    await openTreeRow('Tavern');
    await openPresenceTab();
    for (const row of [/^Twin, /, /^Crowd, /]) {
      await selectRow(row);
      for (const mode of ['Routine', 'Known In'] as const) {
        await chooseMode(mode);
        expect(editor().queryByText(/click a location/i)).toBeNull();
      }
    }
  });
});
