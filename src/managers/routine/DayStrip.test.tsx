import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGameData } from '@/contexts/GameDataContext';
import { KEEPS_ROUTINE_SELECTION, resetRoutineSelections } from '@/lib/routineSelection';
import { panelWorld, renderPanelBench } from '@/test/panelBench';
import type { Entity, GameLocation, ScheduleRow } from '@/types';
import { RoutineTab } from './RoutineTab';

// Daypart edges in minutes: dawn 360, morning 475, midday 662, afternoon 778, evening 1022, night 1195.
const DAWN = 360; const MORNING = 475; const MIDDAY = 662; const AFTERNOON = 778; const EVENING = 1022; const NIGHT = 1195;

const LOCATIONS = [{ id: 'smithy', name: 'Smithy' }, { id: 'inn', name: 'Inn' }] as GameLocation[];
const stay = (id: string, time: ScheduleRow['time'], place = 'smithy'): ScheduleRow => ({ id, time, action: { kind: 'stay', place } });
const mira = (schedule: ScheduleRow[]): Entity => ({
  id: 'mira', name: 'Mira', playerDescription: '', aiDescription: '', kind: 'individual', traversable: 'anywhere',
  starts: [{ id: 's1', place: 'smithy', weight: 1, schedule }],
} as Entity);

function Host() {
  const { entities, updateEntity } = useGameData();
  const entity = entities.find((e) => e.id === 'mira');
  return entity ? <RoutineTab entity={entity} onChange={updateEntity} /> : null;
}
const mount = (schedule: ScheduleRow[]) => renderPanelBench(panelWorld({ locations: LOCATIONS, entities: [mira(schedule)] }), 'simple', <Host />);
const schedule = (bench: ReturnType<typeof mount>) => bench.ctx().entities.find((e) => e.id === 'mira')!.starts![0].schedule;
const timeOf = (bench: ReturnType<typeof mount>, id: string) => schedule(bench).find((r) => r.id === id)?.time;

const bands = (id: string) => document.querySelectorAll(`[data-band="${id}"]`);
const handle = (id: string, edge: 'start' | 'end') => document.querySelector<HTMLElement>(`[data-row="${id}"][data-edge="${edge}"]`)!;
const sentence = (id: string) => document.querySelector<HTMLElement>(`[data-routine-row="${id}"]`)!;
const isSelected = (id: string) => sentence(id).getAttribute('aria-current') === 'true' && bands(id)[0].getAttribute('aria-pressed') === 'true';

/** Where clock minute `m` sits on the strip, in pixels. The strip is 1440 px wide and its left edge is Dawn. */
const px = (m: number) => (m - DAWN + 1440) % 1440;

/** Drags a handle to clock minute `to`, through each minute in `via`. */
function drag(el: HTMLElement, to: number, via: number[] = []) {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 0 });
  for (const m of [...via, to]) fireEvent.pointerMove(el, { pointerId: 1, clientX: px(m) });
  fireEvent.pointerUp(el, { pointerId: 1, clientX: px(to) });
}

beforeEach(() => {
  resetRoutineSelections();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, right: 1440, bottom: 24, width: 1440, height: 24, x: 0, y: 0, toJSON: () => ({}),
  });
});
afterEach(() => vi.restoreAllMocks());

describe('the day strip', () => {
  it('draws each row of the Start on show from Dawn, with Night as one band at the right end', () => {
    mount([
      { id: 'base', time: 'allDay', action: { kind: 'wander', places: [{ place: 'inn', weight: 1 }], idle: 240 } },
      stay('day', { start: MORNING, end: EVENING }),
      stay('late', { start: NIGHT, end: DAWN }, 'inn'),
    ]);
    expect(bands('base')).toHaveLength(1);
    expect(bands('day')).toHaveLength(1);
    expect(bands('late')).toHaveLength(1);
    expect(bands('late')[0]).toHaveStyle({ left: `${(px(NIGHT) / 1440) * 100}%`, width: `${((1440 - px(NIGHT)) / 1440) * 100}%` });
    expect(bands('day')[0]).toHaveStyle({ left: `${(px(MORNING) / 1440) * 100}%` });
    // Under an All-day row no time is free.
    expect(screen.queryByRole('button', { name: /^Add a Stay for / })).toBeNull();
    // The All-day row has no handles; each timed row has two.
    expect(document.querySelectorAll('[data-row="base"]')).toHaveLength(0);
    expect(within(screen.getByRole('group', { name: 'Day' })).getAllByRole('slider')).toHaveLength(4);
  });

  it('splits a row that runs across Dawn over both ends of the strip', () => {
    mount([stay('early', { start: 4 * 60, end: 7 * 60 })]);
    expect(bands('early')).toHaveLength(2);
    expect(bands('early')[0]).toHaveStyle({ left: `${(px(4 * 60) / 1440) * 100}%` });
    expect(bands('early')[1]).toHaveStyle({ left: '0%' });
  });

  it('marks each daypart once with its icon and full name', () => {
    mount([]);
    for (const name of ['Dawn', 'Morning', 'Midday', 'Afternoon', 'Evening', 'Night']) expect(screen.getAllByRole('img', { name })).toHaveLength(1);
  });
});

describe('selecting a row', () => {
  const rows = [stay('day', { start: MORNING, end: EVENING }), stay('late', { start: EVENING, end: NIGHT }, 'inn')];

  it('selects the sentence from its band, and the band from its sentence', async () => {
    mount(rows);
    await userEvent.click(bands('late')[0] as HTMLElement);
    expect(isSelected('late')).toBe(true);
    expect(isSelected('day')).toBe(false);
    await userEvent.click(within(sentence('day')).getByRole('button', { name: /^Action:/ }));
    expect(isSelected('day')).toBe(true);
    expect(isSelected('late')).toBe(false);
  });

  it('scrolls the sentence of a picked band into view', async () => {
    mount(rows);
    const scroll = vi.fn();
    sentence('late').scrollIntoView = scroll;
    await userEvent.click(bands('late')[0] as HTMLElement);
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('keeps the selection through a press in the row’s open editor, and clears it on a press elsewhere', async () => {
    mount(rows);
    await userEvent.click(within(sentence('day')).getByRole('button', { name: /^Action:/ }));
    fireEvent.pointerDown(await screen.findByRole('radio', { name: 'Patrol' }));
    expect(isSelected('day')).toBe(true);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Add Start' }));
    expect(isSelected('day')).toBe(false);
  });

  it('keeps the selection through a press on the map that shows the routine', async () => {
    mount(rows);
    const map = document.createElement('div');
    map.setAttribute(KEEPS_ROUTINE_SELECTION, '');
    const box = map.appendChild(document.createElement('div'));
    document.body.appendChild(map);
    await userEvent.click(bands('late')[0] as HTMLElement);
    fireEvent.pointerDown(box);
    expect(isSelected('late')).toBe(true);
    map.remove();
  });
});

describe('dragging a handle', () => {
  it('stops at a neighbor’s edge, snapped to dayparts, with the handle naming its place', () => {
    const bench = mount([stay('am', { start: MORNING, end: MIDDAY }), stay('pm', { start: AFTERNOON, end: EVENING }, 'inn')]);
    drag(handle('am', 'end'), 1100);
    expect(timeOf(bench, 'am')).toEqual({ start: MORNING, end: AFTERNOON });
    expect(timeOf(bench, 'pm')).toEqual({ start: AFTERNOON, end: EVENING });
    expect(handle('am', 'end')).toHaveAttribute('aria-valuetext', 'Through Midday');
  });

  it('stops at a neighbor’s edge even when the pointer jumps past it', () => {
    const bench = mount([stay('am', { start: 8 * 60, end: 10 * 60 }), stay('pm', { start: 13 * 60, end: 15 * 60 }, 'inn')]);
    drag(handle('am', 'end'), 20 * 60);
    expect(timeOf(bench, 'am')).toEqual({ start: 8 * 60, end: 13 * 60 });
  });

  it('snaps an hours row to whole hours and labels it in hours', () => {
    const bench = mount([stay('am', { start: 8 * 60 + 30, end: 10 * 60 })]);
    drag(handle('am', 'end'), 14 * 60 + 20);
    expect(timeOf(bench, 'am')).toEqual({ start: 8 * 60 + 30, end: 14 * 60 });
    expect(handle('am', 'end')).toHaveAttribute('aria-valuetext', 'To 14:00');
  });

  it('drags a row’s end through Night, and a Night row’s start back out of it', () => {
    const bench = mount([stay('day', { start: MORNING, end: EVENING })]);
    // Night is long: the end snaps to its far edge once the pointer is past its middle.
    drag(handle('day', 'end'), 3 * 60);
    expect(timeOf(bench, 'day')).toEqual({ start: MORNING, end: DAWN });
    expect(handle('day', 'end')).toHaveAttribute('aria-valuetext', 'Through Night');
    drag(handle('day', 'end'), EVENING);
    expect(timeOf(bench, 'day')).toEqual({ start: MORNING, end: EVENING });
  });

  it('turns a row dragged over the whole strip into All Day, and back into a timed row when dragged inward', () => {
    const bench = mount([stay('day', { start: DAWN, end: EVENING })]);
    drag(handle('day', 'end'), 5 * 60);
    expect(timeOf(bench, 'day')).toBe('allDay');
    expect(handle('day', 'end')).toHaveAttribute('aria-valuetext', 'Through Night');
    drag(handle('day', 'end'), AFTERNOON);
    expect(timeOf(bench, 'day')).toEqual({ start: DAWN, end: AFTERNOON });
    // The start handle fills the day the same way, from the other side.
    drag(handle('day', 'end'), 5 * 60);
    drag(handle('day', 'start'), MIDDAY);
    expect(timeOf(bench, 'day')).toEqual({ start: MIDDAY, end: DAWN });
    drag(handle('day', 'start'), DAWN);
    expect(timeOf(bench, 'day')).toBe('allDay');
  });

  it('keeps one snap short of the whole strip over an All-day row, which already covers the rest', () => {
    const bench = mount([
      { id: 'base', time: 'allDay', action: { kind: 'stay', place: 'inn' } },
      stay('day', { start: DAWN, end: EVENING }),
    ]);
    drag(handle('day', 'end'), 5 * 60);
    expect(timeOf(bench, 'day')).toEqual({ start: DAWN, end: NIGHT });
    expect(timeOf(bench, 'base')).toBe('allDay');
  });

  it('never drags past its own other end', () => {
    const bench = mount([stay('am', { start: 8 * 60, end: 10 * 60 })]);
    drag(handle('am', 'start'), 12 * 60);
    expect(timeOf(bench, 'am')).toEqual({ start: 9 * 60, end: 10 * 60 });
  });

  it('moves only the selected row on a shared edge', async () => {
    const bench = mount([stay('am', { start: MORNING, end: AFTERNOON }), stay('pm', { start: AFTERNOON, end: NIGHT }, 'inn')]);
    await userEvent.click(bands('pm')[0] as HTMLElement);
    // The selected row's handle sits on top where both meet.
    expect(handle('pm', 'start')).toHaveClass('z-20');
    expect(handle('am', 'end')).toHaveClass('z-10');
    drag(handle('pm', 'start'), EVENING);
    expect(timeOf(bench, 'pm')).toEqual({ start: EVENING, end: NIGHT });
    expect(timeOf(bench, 'am')).toEqual({ start: MORNING, end: AFTERNOON });
  });

  it('makes each drag one undo step', async () => {
    const bench = mount([stay('am', { start: 8 * 60, end: 10 * 60 })]);
    const before = bench.historyState().steps.length;
    // A real drag spreads its moves over many tasks, and the author may hold still mid-drag for seconds.
    let clock = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const el = handle('am', 'end');
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: px(10 * 60) });
    for (const m of [11 * 60, 12 * 60, 13 * 60, 15 * 60]) {
      fireEvent.pointerMove(el, { pointerId: 1, clientX: px(m) });
      await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
      clock += 5000;
    }
    fireEvent.pointerUp(el, { pointerId: 1, clientX: px(15 * 60) });
    expect(timeOf(bench, 'am')).toEqual({ start: 8 * 60, end: 15 * 60 });
    await waitFor(() => expect(bench.historyState().steps.length).toBe(before + 1));
    await act(async () => { bench.history().undo(); });
    expect(timeOf(bench, 'am')).toEqual({ start: 8 * 60, end: 10 * 60 });
  });

  it('takes focus on a press, so arrow keys follow a click, and a press that moves nothing adds no step', async () => {
    const bench = mount([stay('am', { start: MORNING, end: MIDDAY })]);
    const before = bench.historyState().steps.length;
    fireEvent.pointerDown(handle('am', 'end'), { pointerId: 1, button: 0, clientX: MIDDAY });
    fireEvent.pointerUp(handle('am', 'end'), { pointerId: 1, clientX: MIDDAY });
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(bench.historyState().steps.length).toBe(before);
    await userEvent.keyboard('{ArrowRight}');
    expect(timeOf(bench, 'am')).toEqual({ start: MORNING, end: AFTERNOON });
  });

  it('moves by keyboard one snap at a time, each press its own step', async () => {
    const bench = mount([stay('am', { start: MORNING, end: MIDDAY })]);
    const before = bench.historyState().steps.length;
    const end = handle('am', 'end');
    end.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(timeOf(bench, 'am')).toEqual({ start: MORNING, end: AFTERNOON });
    expect(handle('am', 'end')).toHaveAttribute('aria-valuetext', 'Through Midday');
    expect(handle('am', 'end')).toHaveAccessibleName('End of Morning – Midday');
    await userEvent.keyboard('{ArrowLeft}');
    expect(timeOf(bench, 'am')).toEqual({ start: MORNING, end: MIDDAY });
    await waitFor(() => expect(bench.historyState().steps.length).toBe(before + 2));
  });
});

describe('filling a gap', () => {
  it('adds one Stay at the start location over exactly that gap, and selects it', async () => {
    const bench = mount([stay('day', { start: MORNING, end: EVENING }, 'inn')]);
    // The gap wraps midnight, so it is two pieces of one button name; either fills all of it.
    const pieces = screen.getAllByRole('button', { name: 'Add a Stay for Evening – Dawn' });
    expect(pieces).toHaveLength(2);
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined);
    await userEvent.click(pieces[1]);
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: 'nearest' }));
    const added = schedule(bench).filter((r) => r.id !== 'day');
    expect(added).toEqual([expect.objectContaining({ time: { start: EVENING, end: MORNING }, action: { kind: 'stay', place: 'smithy' } })]);
    expect(isSelected(added[0].id)).toBe(true);
  });

  it('fills a whole free day with an All-day row', async () => {
    const bench = mount([]);
    await userEvent.click(screen.getByRole('button', { name: 'Add a Stay for the whole day' }));
    expect(schedule(bench)).toEqual([expect.objectContaining({ time: 'allDay', action: { kind: 'stay', place: 'smithy' } })]);
  });
});
