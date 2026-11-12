import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGameData } from '@/contexts/GameDataContext';
import { panelWorld, renderPanelBench } from '@/test/panelBench';
import { PLAYER_START, type Connection, type Entity, type EntityStart, type GameLocation, type ScheduleRow } from '@/types';
import { RoutineTab } from './RoutineTab';

// Daypart edges in minutes: dawn 360, morning 480, midday 660, afternoon 780, evening 1020, night 1200.
const MORNING = 480; const AFTERNOON_END = 1020; const NIGHT = 1200;

const LOCATIONS: GameLocation[] = [
  { id: 'village', name: 'Village' },
  ...['smithy', 'inn', 'market', 'wall', 'gate'].map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), parentId: 'village' })),
  { id: 'farm', name: 'Farm' },
] as GameLocation[];
const ROAD: Connection = { id: 'road', a: 'village', b: 'farm', aToB: {}, bToA: {} };

const stay = (id: string, place: string, time: ScheduleRow['time'], strict?: boolean): ScheduleRow =>
  ({ id, time, action: { kind: 'stay', place }, ...(strict && { strict }) });

const mira = (starts: EntityStart[], over: Partial<Entity> = {}): Entity => ({
  id: 'mira', name: 'Mira', playerDescription: '', aiDescription: '', kind: 'unique', starts, traversable: 'anywhere', ...over,
} as Entity);

const oneStart = (schedule: ScheduleRow[], place = 'smithy'): EntityStart[] => [{ id: 's1', place, weight: 1, schedule }];

function Host() {
  const { entities, updateEntity } = useGameData();
  const entity = entities.find((e) => e.id === 'mira');
  return entity ? <RoutineTab entity={entity} onChange={updateEntity} /> : null;
}

const mount = (entity: Entity, connections: Connection[] = []) =>
  renderPanelBench(panelWorld({ locations: LOCATIONS, connections, entities: [entity] }), 'simple', <Host />);

const lines = () => within(screen.getByRole('list', { name: 'Routine' })).getAllByRole('listitem').map((li) => li.textContent);
const stored = (bench: ReturnType<typeof mount>) => bench.ctx().entities.find((e) => e.id === 'mira')!;
const schedule = (bench: ReturnType<typeof mount>) => stored(bench).starts![0].schedule;

afterEach(() => vi.restoreAllMocks());

describe('the routine as sentences', () => {
  it('reads the rows in clock order, with the free hours where they fall', () => {
    mount(mira(oneStart([
      stay('late', 'inn', { start: AFTERNOON_END, end: NIGHT }),
      stay('day', 'smithy', { start: MORNING, end: AFTERNOON_END }),
    ])));
    expect(lines()).toEqual([
      'Morning – Afternoon, stays at Smithy.',
      'Evening, stays at Inn.',
      'Night – Dawn, stays at Smithy.',
    ]);
  });

  it('reads an empty schedule as staying at the start location all day', () => {
    mount(mira(oneStart([])));
    expect(lines()).toEqual(['All day, stays at Smithy.']);
  });

  it('reads an All-day row as the rest of the day beside timed rows, and has no free hours', () => {
    mount(mira(oneStart([
      { id: 'base', time: 'allDay', action: { kind: 'wander', places: [{ place: 'market', weight: 1 }], idle: 240 } },
      stay('day', 'smithy', { start: MORNING, end: AFTERNOON_END }),
    ])));
    expect(lines()).toEqual([
      'The rest of the day, wanders Market, waiting 1 part of the day between moves.',
      'Morning – Afternoon, stays at Smithy.',
      'Busy all day.',
    ]);
  });

  it('says Busy all day and closes the add buttons when timed rows fill the day', () => {
    mount(mira(oneStart([stay('am', 'smithy', { start: 0, end: 720 }), stay('pm', 'inn', { start: 720, end: 0 })])));
    expect(lines()).toContain('Busy all day.');
    for (const name of ['Add Stay', 'Add Wander', 'Add Patrol']) expect(screen.getByRole('button', { name })).toBeDisabled();
    expect(screen.getByText('Shorten a row to add another')).toBeInTheDocument();
  });
});

describe('On Map', () => {
  it('sits below Placement, shows Always for an entity with no field, and writes the field on change', async () => {
    const bench = mount(mira(oneStart([])));
    const placement = screen.getByRole('radiogroup', { name: 'Placement' });
    const onMap = screen.getByRole('radiogroup', { name: 'On Map' });
    expect(placement.compareDocumentPosition(onMap) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(onMap).getByRole('radio', { name: 'Always' })).toBeChecked();
    expect(screen.getByText('Shows it on the player’s map wherever it stands')).toBeInTheDocument();

    await userEvent.click(within(onMap).getByRole('radio', { name: 'When Nearby' }));
    expect(stored(bench).onMap).toBe('whenNearby');
    expect(screen.getByText('Shows it only in the player’s location and Nearby locations')).toBeInTheDocument();

    await userEvent.click(within(onMap).getByRole('radio', { name: 'Once Met' }));
    expect(stored(bench).onMap).toBe('onceMet');

    await userEvent.click(within(onMap).getByRole('radio', { name: 'Never' }));
    expect(stored(bench).onMap).toBe('never');

    await userEvent.click(within(onMap).getByRole('radio', { name: 'Always' }));
    expect(stored(bench)).not.toHaveProperty('onMap');
  });

  it('is absent for a custom persona', () => {
    mount(mira(oneStart([]), { customPersona: true }));
    expect(screen.queryByRole('radiogroup', { name: 'On Map' })).toBeNull();
  });
});

describe('editing rows', () => {
  it('adds a row in the free time at the start location, as one undo step', async () => {
    const bench = mount(mira(oneStart([])));
    const before = bench.historyState().steps.length;
    await userEvent.click(screen.getByRole('button', { name: 'Add Stay' }));
    expect(schedule(bench)).toEqual([expect.objectContaining({ time: { start: MORNING, end: AFTERNOON_END }, action: { kind: 'stay', place: 'smithy' } })]);
    expect(stored(bench)).not.toHaveProperty('locations');
    await waitFor(() => expect(bench.historyState().steps.length).toBe(before + 1));

    await act(async () => { bench.history().undo(); });
    expect(schedule(bench)).toEqual([]);
  });

  it('locks the free time as one locked All-day Stay, as one undo step', async () => {
    const shift = stay('shift', 'smithy', { start: MORNING, end: AFTERNOON_END });
    const bench = mount(mira(oneStart([shift])));
    const before = bench.historyState().steps.length;
    // Free time before and after the shift: either line's lock writes the one row.
    await userEvent.click(screen.getAllByRole('button', { name: 'Lock Free Time' })[0]);
    expect(schedule(bench)).toEqual([shift, expect.objectContaining({ time: 'allDay', strict: true, action: { kind: 'stay', place: 'smithy' } })]);
    expect(lines()).toContain('Busy all day.');
    await waitFor(() => expect(bench.historyState().steps.length).toBe(before + 1));

    await act(async () => { bench.history().undo(); });
    expect(schedule(bench)).toEqual([shift]);
  });

  it('keeps two quick picks as two undo steps', async () => {
    const bench = mount(mira(oneStart([])));
    const before = bench.historyState().steps.length;
    await userEvent.click(screen.getByRole('button', { name: 'Add Stay' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add Wander' }));
    await waitFor(() => expect(bench.historyState().steps.length).toBe(before + 2));
    await act(async () => { bench.history().undo(); });
    expect(schedule(bench).map((r) => r.action.kind)).toEqual(['stay']);
  });

  it('deletes a row as one undo step', async () => {
    const bench = mount(mira(oneStart([stay('day', 'inn', { start: MORNING, end: AFTERNOON_END })])));
    const before = bench.historyState().steps.length;
    await userEvent.click(screen.getByRole('button', { name: 'Delete Morning – Afternoon' }));
    expect(schedule(bench)).toEqual([]);
    expect(stored(bench)).not.toHaveProperty('locations');
    await waitFor(() => expect(bench.historyState().steps.length).toBe(before + 1));
  });

  it('locks and unlocks a row', async () => {
    const bench = mount(mira(oneStart([stay('day', 'inn', { start: MORNING, end: AFTERNOON_END })])));
    await userEvent.click(screen.getByRole('button', { name: 'Locked' }));
    expect(schedule(bench)[0].strict).toBe(true);
    expect(screen.getByRole('button', { name: 'Locked' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches the action and keeps the location', async () => {
    const bench = mount(mira(oneStart([stay('day', 'inn', { start: MORNING, end: AFTERNOON_END })])));
    await userEvent.click(screen.getByRole('button', { name: 'Action: stays at' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Patrol' }));
    expect(schedule(bench)[0].action).toEqual({ kind: 'patrol', stops: [{ place: 'inn', idle: 60 }] });
  });
});

const openTime = (text: string) => userEvent.click(screen.getByRole('button', { name: `Time: ${text}` }));
const selectOptions = async (name: string) => {
  fireEvent.click(screen.getByRole('combobox', { name }));
  return within(await screen.findByRole('listbox')).getAllByRole('option');
};
const optionNamed = (options: HTMLElement[], name: string) => options.find((o) => o.textContent === name)!;

describe('the time editor', () => {
  it('disables a daypart another timed row holds, in both ends', async () => {
    mount(mira(oneStart([
      stay('day', 'smithy', { start: MORNING, end: AFTERNOON_END }),
      stay('late', 'inn', { start: AFTERNOON_END, end: NIGHT }),
    ])));
    await openTime('Evening');
    const from = await selectOptions('From');
    expect(optionNamed(from, 'Midday')).toHaveAttribute('data-disabled');
    expect(optionNamed(from, 'Night')).not.toHaveAttribute('data-disabled');
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

    const to = await selectOptions('To');
    expect(optionNamed(to, 'Dawn')).not.toHaveAttribute('data-disabled');
    // Evening to Morning wraps through Dawn into the day row.
    expect(optionNamed(to, 'Morning')).toHaveAttribute('data-disabled');
  });

  it('offers All Day only while no other row is All day', async () => {
    mount(mira(oneStart([
      { id: 'base', time: 'allDay', action: { kind: 'stay', place: 'inn' } },
      stay('day', 'smithy', { start: MORNING, end: AFTERNOON_END }),
    ])));
    await openTime('Morning – Afternoon');
    expect(optionNamed(await selectOptions('From'), 'All Day')).toHaveAttribute('data-disabled');
  });

  it('swaps to hours and back without changing the stored minutes', async () => {
    const bench = mount(mira(oneStart([stay('day', 'smithy', { start: MORNING, end: AFTERNOON_END })])));
    await openTime('Morning – Afternoon');
    await userEvent.click(screen.getByRole('button', { name: 'Use Hours' }));
    expect(screen.getByRole('button', { name: 'Time: 08:00 – 17:00' })).toBeInTheDocument();
    expect(schedule(bench)[0].time).toEqual({ start: MORNING, end: AFTERNOON_END });

    await userEvent.click(screen.getByRole('button', { name: 'Use Time of Day' }));
    expect(schedule(bench)[0].time).toEqual({ start: MORNING, end: AFTERNOON_END });
    expect(screen.queryByText('Snapped to the parts of the day that cover those hours')).toBeNull();
  });

  it('snaps odd hours to the dayparts that cover them, and says so', async () => {
    const bench = mount(mira(oneStart([stay('day', 'smithy', { start: 510, end: 1020 })])));
    await openTime('08:30 – 17:00');
    await userEvent.click(screen.getByRole('button', { name: 'Use Time of Day' }));
    expect(schedule(bench)[0].time).toEqual({ start: MORNING, end: AFTERNOON_END });
    expect(screen.getByText('Snapped to the parts of the day that cover those hours')).toBeInTheDocument();
  });

  it('refuses typed hours that overlap another row, and greys out the hours that would', async () => {
    const bench = mount(mira(oneStart([
      stay('am', 'smithy', { start: 510, end: 720 }),
      stay('pm', 'inn', { start: 720, end: 840 }),
    ])));
    await openTime('08:30 – 12:00');
    fireEvent.change(screen.getByLabelText('To time'), { target: { value: '13:00' } });
    expect(screen.getByText('Those hours overlap another row')).toBeInTheDocument();
    expect(schedule(bench)[0].time).toEqual({ start: 510, end: 720 });

    await userEvent.click(screen.getByRole('button', { name: 'To time picker' }));
    // 12-hour clock in the PM half: 1 is 13:00, inside the other row.
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled();
  });
});

describe('locations', () => {
  const openLocations = (text: string) => userEvent.click(screen.getByRole('button', { name: `Locations: ${text}` }));
  const pickerRows = async (name: string) => {
    await userEvent.click(screen.getByRole('combobox', { name }));
    return screen.getAllByRole('option').map((o) => o.textContent);
  };

  it('lists only locations connected to the start location', async () => {
    mount(mira(oneStart([stay('day', 'inn', { start: MORNING, end: AFTERNOON_END })])));
    await openLocations('Inn');
    const names = await pickerRows('Location');
    expect(names.some((n) => n?.startsWith('Market'))).toBe(true);
    expect(names.some((n) => n?.startsWith('Farm'))).toBe(false);
  });

  it('flags a listed location a link removal disconnects, and clears the flag on undo', async () => {
    const bench = mount(mira(oneStart([stay('day', 'farm', { start: MORNING, end: AFTERNOON_END })])), [ROAD]);
    expect(screen.queryByRole('img', { name: /Not connected/ })).toBeNull();

    act(() => { bench.ctx().removeConnection('road'); });
    expect(await screen.findByRole('img', { name: /Not connected/ })).toBeInTheDocument();
    expect(schedule(bench)[0].action).toEqual({ kind: 'stay', place: 'farm' });

    await act(async () => { bench.history().undo(); });
    await waitFor(() => expect(screen.queryByRole('img', { name: /Not connected/ })).toBeNull());
  });

  it('reorders Patrol stops by drag, and the stored order is the walk', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const row = this.closest<HTMLElement>('[data-routine-place]');
      if (!row) return DOMRect.fromRect({ x: 0, y: 0, width: 300, height: 10000 });
      return DOMRect.fromRect({ x: 0, y: [...row.parentElement!.children].indexOf(row) * 100, width: 300, height: 90 });
    });
    const user = userEvent.setup();
    const bench = mount(mira(oneStart([{
      id: 'round', time: { start: MORNING, end: AFTERNOON_END },
      action: { kind: 'patrol', stops: [{ place: 'wall', idle: 60 }, { place: 'gate', idle: 30 }, { place: 'inn', idle: 60 }] },
    }])));
    await user.click(screen.getByRole('button', { name: 'Locations: Wall → Gate → Inn' }));
    screen.getAllByRole('button').find((el) => el.getAttribute('aria-roledescription') === 'sortable')!.focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowDown]');
    await user.keyboard('[Space]');
    await waitFor(() => expect(schedule(bench)[0].action).toEqual({
      kind: 'patrol', stops: [{ place: 'gate', idle: 30 }, { place: 'wall', idle: 60 }, { place: 'inn', idle: 60 }],
    }));
  });

  it('shows each Wander location’s chance beside its weight', async () => {
    mount(mira(oneStart([{
      id: 'drift', time: { start: MORNING, end: AFTERNOON_END },
      action: { kind: 'wander', places: [{ place: 'market', weight: 3 }, { place: 'inn', weight: 1 }], idle: 60 },
    }])));
    await openLocations('Market, Inn');
    expect(screen.getByRole('spinbutton', { name: 'Weight of Market' })).toHaveValue(3);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });
});

describe('starts', () => {
  const two: EntityStart[] = [
    { id: 's1', place: 'smithy', weight: 3, schedule: [] },
    { id: 's2', place: 'inn', weight: 1, schedule: [] },
  ];

  it('shows each start’s chance on its tab and in its sentence', () => {
    mount(mira(two));
    const tabs = within(screen.getByRole('group', { name: 'Starts' }));
    expect(tabs.getByRole('button', { name: 'Start 1 75%' })).toHaveAttribute('aria-pressed', 'true');
    expect(tabs.getByRole('button', { name: 'Start 2 25%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chance: 75%' })).toBeInTheDocument();
  });

  it('deletes the shown start, but never the last one', async () => {
    const bench = mount(mira(two));
    await userEvent.click(screen.getByRole('button', { name: 'Start 2 25%' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Start' }));
    expect(stored(bench).starts!.map((s) => s.id)).toEqual(['s1']);
    expect(stored(bench)).not.toHaveProperty('locations');
    expect(screen.queryByRole('button', { name: 'Delete Start' })).toBeNull();
  });

  it('adds a start at a picked location and shows it', async () => {
    const bench = mount(mira(oneStart([])));
    await userEvent.click(screen.getByRole('button', { name: 'Add Start' }));
    await userEvent.click(screen.getByRole('option', { name: /^Inn/ }));
    expect(stored(bench).starts!.map((s) => s.place)).toEqual(['smithy', 'inn']);
    expect(stored(bench)).not.toHaveProperty('locations');
    expect(screen.getByRole('button', { name: 'Start location: Inn' })).toBeInTheDocument();
  });
});

describe("the player's starting location", () => {
  const beside = (over: Partial<EntityStart> = {}, schedule: ScheduleRow[] = []): EntityStart[] =>
    [{ id: 's1', place: PLAYER_START, weight: 1, schedule, ...over }];
  const follows = () => screen.queryByRole('checkbox', { name: 'Follows the Player' });

  it('is a choice in the start picker, adds no location, and offers Follows the Player', async () => {
    const bench = mount(mira(oneStart([])));
    expect(follows()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Start location: Smithy' }));
    await userEvent.click(screen.getByRole('option', { name: "Player's Starting Location" }));
    expect(stored(bench).starts![0].place).toBe(PLAYER_START);
    expect(stored(bench)).not.toHaveProperty('locations');
    expect(lines()).toEqual(["All day, stays at the player's starting location."]);
    await userEvent.click(follows()!);
    expect(stored(bench).starts![0].beginsFollowing).toBe(true);
  });

  it('clears Follows the Player when the start moves to a fixed location', async () => {
    const bench = mount(mira(beside({ beginsFollowing: true })));
    expect(follows()).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: "Start location: the player's starting location" }));
    await userEvent.click(screen.getByRole('option', { name: /^Inn/ }));
    expect(stored(bench).starts![0]).toEqual({ id: 's1', place: 'inn', weight: 1, schedule: [] });
    expect(follows()).toBeNull();
  });

  it('shows no Follows the Player for a Generic entity', () => {
    mount(mira(beside({ beginsFollowing: true }), { kind: 'generic' }));
    expect(follows()).toBeNull();
  });

  it('offers every location to its rows, and a new row begins at the first', async () => {
    const bench = mount(mira(beside({}, [stay('day', 'inn', { start: MORNING, end: AFTERNOON_END })])));
    await userEvent.click(screen.getByRole('button', { name: 'Locations: Inn' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Location' }));
    expect(screen.getAllByRole('option').some((o) => o.textContent?.startsWith('Farm'))).toBe(true);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Add Stay' }));
    expect(schedule(bench).at(-1)?.action).toEqual({ kind: 'stay', place: 'village' });
  });
});

describe('placement', () => {
  it('tells a persona author where the player can start, for each placement', () => {
    mount(mira(oneStart([]), { persona: true }));
    expect(screen.getByText('Lets the player start at any start location as this entity')).toBeInTheDocument();
  });

  it('turns a Unique entity Generic, keeping its Starts and rows', async () => {
    const starts = oneStart([stay('day', 'inn', { start: MORNING, end: AFTERNOON_END })]);
    const bench = mount(mira(starts));
    await userEvent.click(screen.getByRole('radio', { name: 'Generic' }));
    expect(stored(bench)).toEqual(expect.objectContaining({ kind: 'generic', starts, traversable: 'anywhere' }));
    expect(stored(bench)).not.toHaveProperty('locations');
  });

  it('tells a persona author of a Generic entity that any start can be the start', () => {
    mount(mira(oneStart([], 'inn'), { persona: true, kind: 'generic' }));
    expect(screen.getByText('Lets the player start at any start location as this entity')).toBeInTheDocument();
  });

  it('keeps every Start, row, weight, lock and Can Also Go through a switch to Generic and back', async () => {
    const starts: EntityStart[] = [
      { id: 's1', place: 'smithy', weight: 3, schedule: [stay('day', 'inn', { start: MORNING, end: AFTERNOON_END }, true)] },
      { id: 's2', place: 'market', weight: 1, schedule: [] },
    ];
    const original = mira(starts, { traversable: ['farm'] });
    const bench = mount(original);
    await userEvent.click(screen.getByRole('radio', { name: 'Generic' }));
    expect(stored(bench).kind).toBe('generic');
    await userEvent.click(screen.getByRole('radio', { name: 'Unique' }));
    expect(stored(bench)).toEqual(original);
    expect(screen.getByRole('button', { name: 'Start 1 75%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Locked' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Farm')).toBeInTheDocument();
  });

  describe('a Generic entity\'s routine', () => {
    const herd = (starts: EntityStart[]) => mira(starts, { kind: 'generic', traversable: ['farm'] });
    const twoStarts: EntityStart[] = [
      { id: 'g1', place: 'smithy', weight: 3, schedule: [stay('day', 'inn', { start: MORNING, end: AFTERNOON_END }, true)] },
      { id: 'g2', place: 'smithy', weight: 1, schedule: [stay('night', 'market', 'allDay')] },
    ];

    it('shows Start tabs, the sentence, the rows and the day strip, and says every start runs at once', () => {
      mount(herd(twoStarts));
      const tabs = within(screen.getByRole('group', { name: 'Starts' }));
      expect(tabs.getByRole('button', { name: 'Start 1' })).toHaveAttribute('aria-pressed', 'true');
      expect(tabs.getByRole('button', { name: 'Start 2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start location: Smithy' })).toBeInTheDocument();
      expect(lines()).toEqual(['Morning – Afternoon, stays at Inn.', 'Evening – Dawn, stays at Smithy.']);
      expect(screen.getByRole('button', { name: 'Morning – Afternoon: Stay' })).toBeInTheDocument();
      expect(screen.getByText('Runs every start at the same time, each on its own routine')).toBeInTheDocument();
      expect(screen.queryByText('Picks one start at random in each new game')).toBeNull();
    });

    it('shows no chance chip and no weight', () => {
      mount(herd(twoStarts));
      expect(screen.queryByText(/%$/)).toBeNull();
      expect(screen.queryByRole('button', { name: /^Chance:/ })).toBeNull();
      expect(screen.queryByText(/of new games/)).toBeNull();
    });

    it('shows no lock on a row, on free time or on the strip, and keeps the stored flag', () => {
      const bench = mount(herd(twoStarts));
      expect(screen.queryByRole('button', { name: 'Locked' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Lock Free Time' })).toBeNull();
      expect(document.querySelector('[data-band="day"] svg')).toBeNull();
      expect(stored(bench).starts![0].schedule[0].strict).toBe(true);
    });

    it('shows no Can Also Go, and keeps the stored list', () => {
      const bench = mount(herd(twoStarts));
      expect(screen.queryByRole('combobox', { name: 'Can Also Go' })).toBeNull();
      expect(stored(bench).traversable).toEqual(['farm']);
    });

    it('edits a row of the shown start', async () => {
      const bench = mount(herd(twoStarts));
      await userEvent.click(screen.getByRole('button', { name: 'Action: stays at' }));
      await userEvent.click(screen.getByRole('radio', { name: 'Patrol' }));
      expect(stored(bench).starts![0].schedule[0].action).toEqual({ kind: 'patrol', stops: [{ place: 'inn', idle: 60 }] });
      await userEvent.click(screen.getByRole('button', { name: 'Add Wander' }));
      expect(stored(bench).starts![0].schedule.map((r) => r.action.kind)).toEqual(['patrol', 'wander']);
      expect(stored(bench).starts![1]).toEqual(twoStarts[1]);
    });

    it('adds a start with no rows at a picked location and shows it', async () => {
      const bench = mount(herd(twoStarts));
      await userEvent.click(screen.getByRole('button', { name: 'Add Start' }));
      await userEvent.click(screen.getByRole('option', { name: /^Farm/ }));
      expect(stored(bench).starts!.map((s) => [s.place, s.schedule.length])).toEqual([['smithy', 1], ['smithy', 1], ['farm', 0]]);
      expect(screen.getByRole('button', { name: 'Start location: Farm' })).toBeInTheDocument();
    });

    it('deletes only the shown start when another begins at the same location, and never the last one', async () => {
      const bench = mount(herd(twoStarts));
      await userEvent.click(screen.getByRole('button', { name: 'Start 2' }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete Start' }));
      expect(stored(bench).starts).toEqual([twoStarts[0]]);
      expect(stored(bench)).not.toHaveProperty('locations');
      expect(screen.queryByRole('button', { name: 'Delete Start' })).toBeNull();
    });
  });

  it('gives a custom persona only its locations, with no placement or routine', () => {
    mount(mira([], { customPersona: true, kind: undefined, starts: undefined, locations: ['inn'] }));
    expect(screen.getByText('Locations')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Generic' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Routine' })).toBeNull();
  });

  it('limits where it can also go to listed locations', async () => {
    const bench = mount(mira(oneStart([])));
    fireEvent.click(screen.getByRole('combobox', { name: 'Can Also Go' }));
    fireEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Only Listed Locations' }));
    expect(stored(bench).traversable).toEqual([]);
  });
});
