import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGameData } from '@/contexts/GameDataContext';
import { panelWorld, renderPanelBench } from '@/test/panelBench';
import type { Entity, EntityRoutine, EntityStart, GameLocation, ScheduleRow } from '@/types';
import { resetRoutineSelections } from '@/lib/routineSelection';
import { RoutineTab } from './RoutineTab';

const LOCATIONS = [
  { id: 'village', name: 'Village' },
  ...['smithy', 'inn', 'market'].map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), parentId: 'village' })),
  { id: 'farm', name: 'Farm' },
] as GameLocation[];

const stay = (id: string, place: string): ScheduleRow => ({ id, time: 'allDay', action: { kind: 'stay', place } });
const start = (id: string, place: string, schedule: ScheduleRow[] = []): EntityStart => ({ id, place, weight: 1, schedule });
const SEX_FUTA = [{ all: [{ kind: 'trait' as const, id: 'futa', name: 'Futanari' }] }];

const day: EntityRoutine = { id: 'day', name: 'Day Job', traversable: 'anywhere', starts: [start('d1', 'smithy', [stay('dr', 'inn')])] };
const night: EntityRoutine = { id: 'night', name: 'Night Life', requires: SEX_FUTA, traversable: ['farm'], starts: [start('n1', 'market')] };

const mira = (routines: EntityRoutine[], over: Partial<Entity> = {}): Entity => ({
  id: 'mira', name: 'Mira', playerDescription: '', aiDescription: '', kind: 'unique', routines, ...over,
} as Entity);

function Host() {
  const { entities, updateEntity } = useGameData();
  const entity = entities.find((e) => e.id === 'mira');
  return entity ? <RoutineTab entity={entity} onChange={updateEntity} /> : null;
}

const mount = (entity: Entity) => renderPanelBench(panelWorld({ locations: LOCATIONS, entities: [entity] }), 'simple', <Host />);
const stored = (bench: ReturnType<typeof mount>) => bench.ctx().entities.find((e) => e.id === 'mira')!;
const names = (bench: ReturnType<typeof mount>) => stored(bench).routines?.map((r) => r.name);
const strip = () => screen.getByRole('group', { name: 'Routines' });
const list = () => screen.getByRole('list', { name: 'Routines' });
const routineButton = (name: string) => within(list()).getByRole('button', { name: new RegExp(`^${name},`) });
const routineRow = (name: string) => routineButton(name).closest('li')!;
const rowAction = (action: string, name: string) => screen.getByRole('button', { name: `${action}: ${name}` });
const startPlace = () => screen.getByRole('button', { name: /^Start location:/ }).textContent;

afterEach(() => resetRoutineSelections());

describe('one ungated Routine', () => {
  it('looks as before plus Add Routine: no strip buttons, no name, no Requires', () => {
    mount(mira([{ ...day, requires: undefined }]));
    expect(within(strip()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Add Routine']);
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.queryByText('Requires')).toBeNull();
    expect(screen.getByRole('group', { name: 'Starts' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Can Also Go' })).toBeInTheDocument();
  });

  it('shows the strip for a lone Routine that has a gate', () => {
    mount(mira([{ ...day, requires: SEX_FUTA }]));
    expect(routineButton('Day Job')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Requires')).toBeInTheDocument();
  });
});

describe('the Routine list', () => {
  it('reads each gate as a muted line beside the name', () => {
    mount(mira([day, night]));
    expect(routineButton('Day Job')).toHaveAccessibleName('Day Job, Always applies');
    expect(routineButton('Night Life')).toHaveAccessibleName('Night Life, Applies while Futanari');
  });

  it('moves focus between rows with the arrow keys', async () => {
    mount(mira([day, night]));
    routineButton('Day Job').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(routineButton('Night Life')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(routineButton('Day Job')).toHaveFocus();
  });

  it('puts Can Also Go below the Schedule', () => {
    mount(mira([day, night]));
    const schedule = screen.getByRole('group', { name: 'Starts' });
    const canAlsoGo = screen.getByRole('combobox', { name: 'Can Also Go' });
    expect(schedule.compareDocumentPosition(canAlsoGo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText('Name').compareDocumentPosition(canAlsoGo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('adds a Routine with no Starts, named past the ones in use, and shows it, as one undo step', async () => {
    const bench = mount(mira([{ ...day, name: 'Routine 2' }]));
    const before = bench.historyState().steps.length;
    await userEvent.click(screen.getByRole('button', { name: 'Add Routine' }));
    expect(names(bench)).toEqual(['Routine 2', 'Routine 3']);
    expect(stored(bench).routines?.[1]).toEqual(expect.objectContaining({ starts: [], traversable: 'anywhere' }));
    expect(stored(bench).routines?.[1]).not.toHaveProperty('requires');
    expect(routineButton('Routine 3')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Add Start' })).toBeInTheDocument();
    await waitFor(() => expect(bench.historyState().steps.length).toBe(before + 1));

    await act(async () => { bench.history().undo(); });
    expect(names(bench)).toEqual(['Routine 2']);
  });

  it('switches the shown Routine, with its own Starts and Can Also Go', async () => {
    mount(mira([day, night]));
    expect(startPlace()).toBe('Smithy');
    await userEvent.click(routineButton('Night Life'));
    expect(routineButton('Night Life')).toHaveAttribute('aria-current', 'true');
    expect(startPlace()).toBe('Market');
    expect(screen.getByRole('button', { name: 'Remove Farm' })).toBeInTheDocument();
  });

  it('renames the shown Routine, and a blank name shows its default name in the list', async () => {
    const bench = mount(mira([day, night]));
    await userEvent.click(routineButton('Night Life'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Evenings' } });
    expect(names(bench)).toEqual(['Day Job', 'Evenings']);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } });
    expect(routineButton('Routine 2')).toHaveAttribute('aria-current', 'true');
  });

  it('keeps typing in the name as one undo step', async () => {
    const bench = mount(mira([day, night]));
    const before = bench.historyState().steps.length;
    await userEvent.type(screen.getByLabelText('Name'), ' Shift');
    expect(names(bench)).toEqual(['Day Job Shift', 'Night Life']);
    await waitFor(() => expect(bench.historyState().steps.length).toBe(before + 1));
    await act(async () => { bench.history().undo(); });
    expect(names(bench)).toEqual(['Day Job', 'Night Life']);
  });

  it('moves the shown Routine earlier and later, each move one undo step', async () => {
    const bench = mount(mira([day, night]));
    await userEvent.click(routineButton('Night Life'));
    expect(rowAction('Move Later', 'Night Life')).toBeDisabled();
    const before = bench.historyState().steps.length;
    await userEvent.click(rowAction('Move Earlier', 'Night Life'));
    expect(names(bench)).toEqual(['Night Life', 'Day Job']);
    expect(routineButton('Night Life')).toHaveAttribute('aria-current', 'true');
    expect(rowAction('Move Earlier', 'Night Life')).toBeDisabled();
    await waitFor(() => expect(bench.historyState().steps.length).toBe(before + 1));

    await act(async () => { bench.history().undo(); });
    expect(names(bench)).toEqual(['Day Job', 'Night Life']);
  });

  it('deletes the shown Routine and shows the first, but never the last one', async () => {
    const bench = mount(mira([day, night]));
    await userEvent.click(routineButton('Night Life'));
    await userEvent.click(rowAction('Delete Routine', 'Night Life'));
    expect(names(bench)).toEqual(['Day Job']);
    expect(startPlace()).toBe('Smithy');
    // Day Job has no gate, so the tab falls back to the one-Routine look, with nothing to delete.
    expect(screen.queryByRole('button', { name: /^Delete Routine/ })).toBeNull();
  });

  it('writes the Requires rows of the shown Routine only', async () => {
    const bench = mount(mira([day, night]));
    await userEvent.click(routineButton('Night Life'));
    await userEvent.click(screen.getByRole('button', { name: /Delete row|Remove row/ }));
    expect(stored(bench).routines?.[1]).not.toHaveProperty('requires');
    expect(stored(bench).routines?.[0]).toEqual(day);
  });

  it('adds a Start to the shown Routine', async () => {
    const bench = mount(mira([day, night]));
    await userEvent.click(routineButton('Night Life'));
    await userEvent.click(screen.getByRole('button', { name: 'Add Start' }));
    await userEvent.click(await screen.findByRole('option', { name: /Inn/ }));
    expect(stored(bench).routines?.[1].starts.map((s) => s.place)).toEqual(['market', 'inn']);
    expect(stored(bench).routines?.[0]).toEqual(day);
  });
});

describe('the empty-Routine warning', () => {
  const warning = 'This Routine has no starts, so it never applies.';

  it('shows on a Routine with no Starts while there are two, and clears once it has one', async () => {
    mount(mira([day, { ...night, starts: [] }]));
    expect(within(routineRow('Night Life')).getByRole('img', { name: warning })).toBeInTheDocument();
    await userEvent.click(routineButton('Night Life'));
    expect(screen.getByText(warning, { selector: 'p' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add Start' }));
    await userEvent.click(await screen.findByRole('option', { name: /Inn/ }));
    expect(screen.queryByText(warning, { selector: 'p' })).toBeNull();
    expect(within(list()).queryByRole('img', { name: warning })).toBeNull();
  });

  it('does not show on a lone empty Routine', () => {
    mount(mira([{ ...night, starts: [] }]));
    expect(screen.queryByText(warning)).toBeNull();
  });
});

describe('every Routine through a kind switch and a location delete', () => {
  it('keeps every Routine through a switch to Generic and back', async () => {
    const original = mira([day, night]);
    const bench = mount(original);
    await userEvent.click(screen.getByRole('radio', { name: 'Generic' }));
    expect(stored(bench).routines).toEqual(original.routines);
    await userEvent.click(screen.getByRole('radio', { name: 'Unique' }));
    expect(stored(bench)).toEqual(original);
  });

  it('drops a deleted location from every Routine', async () => {
    const bench = mount(mira([day, { ...night, starts: [start('n1', 'market', [stay('nr', 'inn')]), start('n2', 'inn')], traversable: ['inn', 'farm'] }]));
    await act(async () => { bench.ctx().removeLocation('inn'); });
    const [first, second] = stored(bench).routines!;
    expect(first.starts).toEqual([start('d1', 'smithy')]);
    expect(second.starts).toEqual([start('n1', 'market')]);
    expect(second.traversable).toEqual(['farm']);
  });
});
