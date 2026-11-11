import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { resetRoutineSelections } from '@/lib/routineSelection';
import type { World } from '@/types';

/** The marks on a location's Presence tab: what in an entity's routine names the location. */

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

const DAWN = 360; const MORNING = 480; const MIDDAY = 660; const AFTERNOON = 780; const EVENING = 1020;

const WORLD: World = benchEditorWorld({
  locations: [
    { id: 'tavern', name: 'Tavern' },
    { id: 'yard', name: 'Yard' },
    { id: 'cellar', name: 'Cellar' },
  ],
  connections: [{ id: 'c1', a: 'tavern', b: 'yard', aToB: {}, bToA: {} }],
  entities: [
    // Only the second Start names the tavern: a Stay, a Wander and a Patrol row; one more row names the yard.
    {
      id: 'twin', name: 'Twin', kind: 'unique', locations: ['yard', 'tavern'],
      starts: [
        { id: 'a', place: 'yard', weight: 1, schedule: [] },
        { id: 'b', place: 'yard', weight: 1, schedule: [
          { id: 'r1', time: { start: DAWN, end: MORNING }, action: { kind: 'stay', place: 'tavern' } },
          { id: 'r2', time: { start: MORNING, end: MIDDAY }, action: { kind: 'wander', places: [{ place: 'tavern', weight: 1 }, { place: 'yard', weight: 1 }], idle: 60 } },
          { id: 'r3', time: { start: MIDDAY, end: AFTERNOON }, action: { kind: 'patrol', stops: [{ place: 'yard', idle: 30 }, { place: 'tavern', idle: 30 }] } },
          { id: 'r4', time: { start: AFTERNOON, end: EVENING }, action: { kind: 'stay', place: 'yard' } },
        ] },
      ],
    },
    // Here only through Can Also Go.
    {
      id: 'courier', name: 'Courier', kind: 'unique', locations: ['yard'], traversable: ['tavern', 'cellar'],
      starts: [{ id: 'k1', place: 'yard', weight: 1, schedule: [] }],
    },
  ],
} as Partial<World>);

const step = async (action: () => void) => { await act(async () => { action(); }); await new Promise((r) => setTimeout(r, 5)); };

beforeEach(() => { localStorage.clear(); resetRoutineSelections(); });

function openPresence(name: string) {
  openEditorTab(/Locations/);
  const row = screen.getAllByText(name).map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]')).find(Boolean)!;
  fireEvent.click(row);
  fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Location Fields' })).getByRole('tab', { name: 'Presence' }));
}

const selectRow = (name: RegExp) => step(() => fireEvent.click(within(screen.getByTestId('entities-here')).getByRole('button', { name })));
const marksIn = (el: HTMLElement) => within(el).queryAllByRole('img', { name: 'Names Tavern' });
const startButton = (n: number) => within(screen.getByRole('group', { name: 'Starts' })).getByRole('button', { name: new RegExp(`^Start ${n}`) });

describe('the Presence tab: marks for this location', () => {
  it('marks the Start that names the location, and opens on it', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    await selectRow(/^Twin/);
    expect(startButton(2).getAttribute('aria-pressed')).toBe('true');
    expect(marksIn(startButton(2))).toHaveLength(1);
    expect(marksIn(startButton(1))).toHaveLength(0);
  });

  it('marks a Stay, a Wander and a Patrol row that name the location, and no other row', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    await selectRow(/^Twin/);
    const rows = within(screen.getByRole('list', { name: 'Routine' })).getAllByRole('listitem');
    const row = (verb: RegExp) => rows.find((li) => verb.test(li.textContent ?? ''))!;
    expect(marksIn(row(/stays at Tavern/))).toHaveLength(1);
    expect(marksIn(row(/wanders Tavern, Yard/))).toHaveLength(1);
    expect(marksIn(row(/patrols Yard → Tavern/))).toHaveLength(1);
    expect(marksIn(row(/stays at Yard/))).toHaveLength(0);
  });

  it('marks the location in Can Also Go, and opens on the first Start when no Start names it', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    await selectRow(/^Courier/);
    expect(startButton(1).getAttribute('aria-pressed')).toBe('true');
    expect(marksIn(startButton(1))).toHaveLength(0);
    const field = screen.getByText('Can Also Go', { selector: 'label' }).parentElement!;
    const chips = within(field).getAllByRole('button', { name: /^Remove / }).map((b) => b.parentElement!);
    expect(chips.map((c) => [c.textContent, marksIn(c).length])).toEqual([['Tavern', 1], ['Cellar', 0]]);
  });

  it('keeps the Start on show when it names the location, and shows no mark outside the Presence tab', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    await selectRow(/^Twin/);
    await step(() => fireEvent.click(within(screen.getByTestId('entities-here')).getByRole('button', { name: 'Open Twin’s Routine' })));
    expect(screen.queryAllByRole('img', { name: /^Names / })).toHaveLength(0);
    expect(startButton(2).getAttribute('aria-pressed')).toBe('true');
  });

  it('draws no mark on the full-screen entity card', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openPresence('Tavern');
    await selectRow(/^Twin/);
    expect(marksIn(startButton(2))).toHaveLength(1);
    await step(() => fireEvent.click(screen.getByRole('radio', { name: 'Canvas' })));
    await step(() => fireEvent.click(screen.getByRole('button', { name: 'Edit Full Screen' })));
    const card = screen.getByTestId('entity-pick-card');
    expect(within(card).getByRole('group', { name: 'Starts' })).toBeInTheDocument();
    expect(within(card).queryAllByRole('img', { name: /^Names / })).toHaveLength(0);
  });
});
