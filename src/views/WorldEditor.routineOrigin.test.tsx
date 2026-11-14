import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench, shownEditorTab } from '@/test/worldEditorBench';
import { resetRoutineSelections } from '@/lib/routineSelection';
import type { World } from '@/types';
import { oneRoutine } from '@/test/routines';
import { startsOf } from '@/lib/entityKind';

/** An undo of a Routine editor edit returns to where the author made it. */

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
  ],
  connections: [{ id: 'c1', a: 'tavern', b: 'yard', aToB: {}, bToA: {} }],
  entities: [
    // Both Starts name the tavern, so a fresh pick shows Start 1.
    {
      id: 'twin', name: 'Twin', kind: 'unique', locations: ['tavern'],
      routines: oneRoutine([
        { id: 'a', place: 'tavern', weight: 1, schedule: [{ id: 'a1', time: 'allDay', action: { kind: 'stay', place: 'yard' } }] },
        { id: 'b', place: 'tavern', weight: 1, schedule: [{ id: 'b1', time: 'allDay', action: { kind: 'stay', place: 'yard' } }] },
      ]),
    },
  ],
} as Partial<World>);

const step = async (action: () => void) => { await act(async () => { action(); }); await new Promise((r) => setTimeout(r, 5)); };
const undo = () => step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });

beforeEach(() => { localStorage.clear(); resetRoutineSelections(); });

const openTreeRow = (name: string) =>
  fireEvent.click(screen.getAllByText(name).map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]')).find(Boolean)!);
const panelTab = (strip: string, name: string) => within(screen.getByRole('tablist', { name: strip })).getByRole('tab', { name });
const openPanelTab = (strip: string, name: string) => step(() => fireEvent.mouseDown(panelTab(strip, name)));
const isSelected = (tab: HTMLElement) => tab.getAttribute('aria-selected') === 'true';

const presenceList = () => within(screen.getByTestId('entities-here'));
const selectedRows = () => presenceList().queryAllByRole('button', { current: true }).map((b) => b.getAttribute('aria-label')!.split(',')[0]);
const startButton = (n: number) => within(screen.getByRole('group', { name: 'Starts' })).getByRole('button', { name: new RegExp(`^Start ${n}`) });
const pressStart = (n: number) => step(() => fireEvent.click(startButton(n)));
const deleteRoutineRow = () => step(() => fireEvent.click(
  within(screen.getByRole('list', { name: 'Routine' })).getByRole('button', { name: /^Delete / }),
));
const scheduleOf = (ctx: () => { entities: World['entities'] }, startId: string) =>
  startsOf(ctx().entities.find((e) => e.id === 'twin')!)!.find((s) => s.id === startId)!.schedule;

async function openPresenceOnTwin() {
  openEditorTab(/Locations/);
  openTreeRow('Tavern');
  await openPanelTab('Location Fields', 'Presence');
  await step(() => fireEvent.click(presenceList().getByRole('button', { name: /^Twin, / })));
}

describe('an undo of a Routine edit made on a location’s Presence tab', () => {
  it('returns to the Presence tab with the entity selected', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await openPresenceOnTwin();
    await deleteRoutineRow();
    expect(scheduleOf(ctx, 'a')).toHaveLength(0);
    await openPanelTab('Location Fields', 'Connections');

    await undo();
    expect(scheduleOf(ctx, 'a')).toHaveLength(1);
    expect(shownEditorTab()).toMatch(/Locations/);
    expect(isSelected(panelTab('Location Fields', 'Presence'))).toBe(true);
    expect(selectedRows()).toEqual(['Twin']);
  });

  it('shows the second Start when the edit was on it', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await openPresenceOnTwin();
    await pressStart(2);
    await deleteRoutineRow();
    expect(scheduleOf(ctx, 'b')).toHaveLength(0);
    await pressStart(1);
    await openPanelTab('Location Fields', 'Connections');

    await undo();
    expect(scheduleOf(ctx, 'b')).toHaveLength(1);
    expect(isSelected(panelTab('Location Fields', 'Presence'))).toBe(true);
    expect(selectedRows()).toEqual(['Twin']);
    expect(startButton(2).getAttribute('aria-pressed')).toBe('true');
  });
});

const openFullScreenCard = async () => {
  await step(() => fireEvent.click(screen.getByRole('radio', { name: 'Canvas' })));
  await step(() => fireEvent.click(screen.getByRole('button', { name: 'Edit Full Screen' })));
  return screen.getByTestId('entity-pick-card');
};

describe('an undo of a Routine edit made on the full-screen entity card', () => {
  // Ctrl+Z in full screen belongs to the canvas, so the world undo comes after full screen closes.
  it('returns to the Presence tab the card opened over', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await openPresenceOnTwin();
    const card = await openFullScreenCard();
    await step(() => fireEvent.click(within(within(card).getByRole('list', { name: 'Routine' })).getByRole('button', { name: /^Delete / })));
    expect(scheduleOf(ctx, 'a')).toHaveLength(0);
    // The first Escape leaves picking, the second full screen.
    await step(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }); });
    await step(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }); });
    expect(screen.queryByTestId('entity-pick-card')).not.toBeInTheDocument();
    await openPanelTab('Location Fields', 'Connections');

    await undo();
    expect(scheduleOf(ctx, 'a')).toHaveLength(1);
    expect(shownEditorTab()).toMatch(/Locations/);
    expect(isSelected(panelTab('Location Fields', 'Presence'))).toBe(true);
    expect(selectedRows()).toEqual(['Twin']);
  });
});

describe('an undo of a Routine edit made on the entity panel', () => {
  it('returns to that entity’s Routine tab from another section', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);
    openTreeRow('Twin');
    await openPanelTab('Entity Fields', 'Presence');
    await deleteRoutineRow();
    expect(scheduleOf(ctx, 'a')).toHaveLength(0);
    await openPanelTab('Entity Fields', 'Profile');
    openEditorTab(/Locations/);

    await undo();
    expect(scheduleOf(ctx, 'a')).toHaveLength(1);
    expect(shownEditorTab()).toMatch(/Entities/);
    expect(isSelected(panelTab('Entity Fields', 'Presence'))).toBe(true);
  });
});
