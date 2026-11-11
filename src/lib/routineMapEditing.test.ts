import { describe, expect, it } from 'vitest';
import type { Connection, Entity, ScheduleAction, ScheduleRow, Traversable } from '@/types';
import { placesOf } from './positionEngine';
import { routineDragSources, routineMapClick, routineMapDrag, routineMapStatus, routineShownStatus } from './routineMapEditing';
import { rangeText } from './routineTime';

// A village of sibling places, a ridge one Far Connection away, and an island nothing reaches.
const locations = [
  { id: 'village', parentId: null },
  ...['smithy', 'inn', 'market', 'square', 'wall', 'gate'].map((id) => ({ id, parentId: 'village' })),
  { id: 'ridge', parentId: null },
  { id: 'island', parentId: null },
];
const connections = [{ id: 'road', a: 'village', b: 'ridge', aToB: {}, bToA: {}, distance: 'far' }] as Connection[];
const graph = { locations, connections };

const timed = (id: string, from: number, to: number, action: ScheduleAction): ScheduleRow =>
  ({ id, time: { start: from * 60, end: to * 60 }, action });
const day: ScheduleRow[] = [
  timed('stay', 6, 10, { kind: 'stay', place: 'inn' }),
  timed('wander', 10, 14, { kind: 'wander', places: [{ place: 'market', weight: 3 }, { place: 'square', weight: 1 }], idle: 60 }),
  timed('patrol', 14, 18, { kind: 'patrol', stops: [{ place: 'wall', idle: 30 }, { place: 'gate', idle: 30 }, { place: 'wall', idle: 30 }] }),
  timed('emptyWander', 18, 20, { kind: 'wander', places: [], idle: 60 }),
  timed('emptyPatrol', 20, 22, { kind: 'patrol', stops: [] }),
];
const farrier = (traversable: Traversable = 'anywhere', schedule = day): Entity => ({
  id: 'farrier', name: 'Farrier', playerDescription: '', aiDescription: '', kind: 'unique', traversable,
  starts: [
    { id: 's1', place: 'smithy', weight: 1, schedule },
    { id: 's2', place: 'gate', weight: 1, schedule: [] },
  ],
} as Entity);

const at = (rowId: string | null) => ({ startId: null, rowId });
const rowOf = (e: Entity | undefined, rowId: string) => e?.starts?.[0].schedule.find((r) => r.id === rowId);
const placesAfter = (e: Entity | undefined, rowId: string) => {
  const row = rowOf(e, rowId);
  return row ? placesOf(row.action) : undefined;
};
const click = (rowId: string | null, place: string, entity = farrier()) => routineMapClick(entity, at(rowId), place, graph);
const drag = (rowId: string, from: string, to: string, entity = farrier()) => routineMapDrag(entity, at(rowId), from, to, graph);

describe('a click with a row selected', () => {
  it('moves a Stay to the place', () => {
    const edit = click('stay', 'market');
    expect(placesAfter(edit?.entity, 'stay')).toEqual(['market']);
    expect(edit?.label).toBe('Edit Routine');
  });

  it('adds a place to a Wander, and removes one already in it', () => {
    expect(placesAfter(click('wander', 'inn')?.entity, 'wander')).toEqual(['market', 'square', 'inn']);
    expect(placesAfter(click('wander', 'market')?.entity, 'wander')).toEqual(['square']);
  });

  it('gives a new Wander place weight 1', () => {
    const row = rowOf(click('wander', 'inn')?.entity, 'wander');
    expect(row?.action.kind === 'wander' && row.action.places.at(-1)?.weight).toBe(1);
  });

  it('adds a Patrol stop at the end, repeating a place it already visits', () => {
    expect(placesAfter(click('patrol', 'gate')?.entity, 'patrol')).toEqual(['wall', 'gate', 'wall', 'gate']);
  });

  it('removes the last Patrol stop on a click on it', () => {
    expect(placesAfter(click('patrol', 'wall')?.entity, 'patrol')).toEqual(['wall', 'gate']);
  });

  it('refuses a Patrol click on stop 1, which would follow itself around the loop', () => {
    const one = farrier('anywhere', [timed('p', 6, 10, { kind: 'patrol', stops: ['wall', 'gate'].map((place) => ({ place, idle: 30 })) })]);
    expect(click('p', 'wall', one)).toBeNull();
  });

  it('removes a lone Patrol stop on a click on it', () => {
    const one = farrier('anywhere', [timed('p', 6, 10, { kind: 'patrol', stops: [{ place: 'wall', idle: 30 }] })]);
    expect(placesAfter(click('p', 'wall', one)?.entity, 'p')).toEqual([]);
  });

  it('gives an empty row its first place from one click', () => {
    expect(placesAfter(click('emptyWander', 'inn')?.entity, 'emptyWander')).toEqual(['inn']);
    expect(placesAfter(click('emptyPatrol', 'inn')?.entity, 'emptyPatrol')).toEqual(['inn']);
  });

  it('lets a click empty a row, as the Routine tab remove does', () => {
    const one = farrier('anywhere', [timed('w', 6, 10, { kind: 'wander', places: [{ place: 'inn', weight: 1 }], idle: 60 })]);
    expect(placesAfter(click('w', 'inn', one)?.entity, 'w')).toEqual([]);
  });

  it('changes nothing on a place not connected to the Start', () => {
    for (const row of ['stay', 'wander', 'patrol', 'emptyWander']) expect(click(row, 'island')).toBeNull();
  });

  it('takes a place reached only through a Far Connection', () => {
    expect(placesAfter(click('stay', 'ridge')?.entity, 'stay')).toEqual(['ridge']);
  });

  it('changes nothing when a Stay is clicked on its own place', () => {
    expect(click('stay', 'inn')).toBeNull();
  });

  it('edits only the selected row and keeps the derived locations current', () => {
    const next = click('stay', 'ridge')?.entity;
    expect(placesAfter(next, 'wander')).toEqual(['market', 'square']);
    expect(next?.locations).toContain('ridge');
  });

  it('edits the Start on show', () => {
    const edit = routineMapClick(
      farrier('anywhere'),
      { startId: 's2', rowId: null },
      'inn',
      graph,
    );
    expect(edit).toBeNull();
    const withRow: Entity = { ...farrier(), starts: [farrier().starts![0], { id: 's2', place: 'gate', weight: 1, schedule: [timed('g', 6, 10, { kind: 'stay', place: 'gate' })] }] };
    const moved = routineMapClick(withRow, { startId: 's2', rowId: 'g' }, 'inn', graph);
    expect(moved?.entity.starts?.[1].schedule[0].action).toEqual({ kind: 'stay', place: 'inn' });
  });
});

describe('a click with no row selected', () => {
  it('adds a place to the Can Also Go list and removes it again, connected or not', () => {
    const added = click(null, 'island', farrier(['inn']));
    expect(added?.entity.traversable).toEqual(['inn', 'island']);
    expect(added?.label).toBe('Change Can Also Go');
    expect(click(null, 'inn', farrier(['inn']))?.entity.traversable).toEqual([]);
  });

  it('reads a missing Can Also Go as an empty list, as play does', () => {
    const { traversable: _absent, ...migrated } = farrier();
    expect(click(null, 'inn', migrated as Entity)?.entity.traversable).toEqual(['inn']);
  });

  it('does nothing under Anywhere', () => {
    expect(click(null, 'inn', farrier('anywhere'))).toBeNull();
  });
});

describe('a Generic entity on the map', () => {
  // The farrier's two Starts, run at once; its Can Also Go list stays in the data and plays no part.
  const herd = (starts = farrier().starts!): Entity => ({ ...farrier(['inn']), kind: 'generic', starts });
  const startPlaces = (e: Entity | undefined) => e?.starts?.map((s) => s.place);

  it('edits a selected row by a Unique entity’s rules, clicks and drags alike', () => {
    const clicks: [string, string][] = [
      ['stay', 'market'], ['stay', 'inn'], ['wander', 'inn'], ['wander', 'market'], ['patrol', 'gate'], ['patrol', 'wall'],
      ['emptyPatrol', 'inn'], ['stay', 'island'], ['stay', 'ridge'],
    ];
    for (const [row, place] of clicks) {
      expect(click(row, place, herd())?.entity.starts).toEqual(click(row, place)?.entity.starts);
    }
    const drags: [string, string, string][] = [['wander', 'market', 'inn'], ['patrol', 'wall', 'market'], ['patrol', 'wall', 'island'], ['stay', 'inn', 'market']];
    for (const [row, from, to] of drags) {
      expect(drag(row, from, to, herd())?.entity.starts).toEqual(drag(row, from, to)?.entity.starts);
    }
    expect([...routineDragSources(herd(), at('patrol'))].sort()).toEqual(['gate', 'wall']);
  });

  it('adds a Start with no rows at any place, unconnected ones included, with no row selected', () => {
    const edit = click(null, 'island', herd());
    expect(startPlaces(edit?.entity)).toEqual(['smithy', 'gate', 'island']);
    expect(edit?.entity.starts?.[2].schedule).toEqual([]);
    expect(edit?.entity.traversable).toEqual(['inn']);
    expect(edit?.label).toBe('Change Locations');
  });

  it('removes every Start that begins at the place, the one on show included', () => {
    const twice = herd([...farrier().starts!, { id: 's3', place: 'smithy', weight: 1, schedule: [] }]);
    expect(startPlaces(click(null, 'smithy', twice)?.entity)).toEqual(['gate']);
  });

  it('keeps the last Start', () => {
    expect(click(null, 'smithy', herd([farrier().starts![0]]))).toBeNull();
  });
});

describe('a drag', () => {
  it('starts only on the places of a selected Wander or Patrol row', () => {
    expect([...routineDragSources(farrier(), at('wander'))].sort()).toEqual(['market', 'square']);
    expect([...routineDragSources(farrier(), at('patrol'))].sort()).toEqual(['gate', 'wall']);
    expect(routineDragSources(farrier(), at('stay')).size).toBe(0);
    expect(routineDragSources(farrier(), at(null)).size).toBe(0);
  });

  it('puts the new Patrol stop right after the stop it left', () => {
    const one = farrier('anywhere', [timed('p', 6, 10, { kind: 'patrol', stops: ['wall', 'gate', 'inn'].map((place) => ({ place, idle: 30 })) })]);
    expect(placesAfter(drag('p', 'gate', 'market', one)?.entity, 'p')).toEqual(['wall', 'gate', 'market', 'inn']);
  });

  it('goes after the last occurrence of a repeated place', () => {
    expect(placesAfter(drag('patrol', 'wall', 'market')?.entity, 'patrol')).toEqual(['wall', 'gate', 'wall', 'market']);
  });

  it('refuses a drag from the last stop back to stop 1', () => {
    const one = farrier('anywhere', [timed('p', 6, 10, { kind: 'patrol', stops: ['wall', 'gate'].map((place) => ({ place, idle: 30 })) })]);
    expect(drag('p', 'gate', 'wall', one)).toBeNull();
  });

  it('never puts two equal stops in a row', () => {
    expect(drag('patrol', 'wall', 'wall')).toBeNull();
    const one = farrier('anywhere', [timed('p', 6, 10, { kind: 'patrol', stops: ['wall', 'gate', 'inn'].map((place) => ({ place, idle: 30 })) })]);
    expect(drag('p', 'wall', 'gate', one)).toBeNull();
  });

  it('refuses a drag from a place outside the row', () => {
    expect(drag('patrol', 'inn', 'market')).toBeNull();
    expect(drag('wander', 'inn', 'smithy')).toBeNull();
  });

  it('adds the target to a Wander, and refuses a place already in the set', () => {
    expect(placesAfter(drag('wander', 'market', 'inn')?.entity, 'wander')).toEqual(['market', 'square', 'inn']);
    expect(drag('wander', 'market', 'square')).toBeNull();
  });

  it('refuses a place not connected to the Start', () => {
    expect(drag('wander', 'market', 'island')).toBeNull();
    expect(drag('patrol', 'wall', 'island')).toBeNull();
  });

  it('has no Stay drag', () => {
    expect(drag('stay', 'inn', 'market')).toBeNull();
  });
});

describe('the status line', () => {
  const status = (rowId: string | null, entity = farrier()) => routineMapStatus(entity, at(rowId));

  it('names the action and its time for each row, apart from what a click does', () => {
    expect(status('stay')).toEqual({ row: `Stay, ${rangeText({ start: 360, end: 600 })}`, text: 'Click a location to stay there' });
    expect(status('wander').row).toMatch(/^Wander, /);
    expect(status('wander').text).toBe('Click a location to add or remove it. Drag from one to add another.');
    expect(status('patrol').row).toMatch(/^Patrol, /);
    expect(status('patrol').text).toBe('Click the next stop, or the last stop to remove it. Drag from a stop to add one after it.');
  });

  it('asks for the first place of an empty row', () => {
    expect(status('emptyWander').text).toBe('Click a location to add it');
    expect(status('emptyPatrol').text).toBe('Click the first stop');
  });

  it('reads the All-day row as the rest of the day next to timed rows', () => {
    const allDay: ScheduleRow = { id: 'base', time: 'allDay', action: { kind: 'stay', place: 'inn' } };
    expect(status('base', farrier('anywhere', [allDay, ...day])).row).toBe('Stay, the rest of the day');
    expect(status('base', farrier('anywhere', [allDay])).row).toBe('Stay, all day');
  });

  it('says what a click does with no row selected', () => {
    expect(status(null, farrier(['inn']))).toEqual({ text: 'Click a location to add or remove it from "Can Also Go"' });
    expect(status(null, farrier('anywhere'))).toEqual({ text: 'Select a row to edit its locations here' });
  });

  it('speaks to a Generic entity, and reads its selected row as a Unique entity’s', () => {
    const herd: Entity = { ...farrier(), kind: 'generic' };
    expect(status(null, herd)).toEqual({ text: 'Click a location to add or remove it' });
    expect(status('patrol', herd)).toEqual(status('patrol'));
  });
});

describe('the status line of a routine that is only shown', () => {
  const shown = (rowId: string | null, entity = farrier()) => routineShownStatus(entity, at(rowId), 'Old Farrier');

  it('names whose routine it is with no row selected, and offers no click', () => {
    expect(shown(null)).toEqual({ text: 'Routine of Old Farrier' });
    expect(shown(null, { ...farrier(), kind: 'generic' })).toEqual({ text: 'Routine of Old Farrier' });
  });

  it('keeps the selected row and says the map shows its locations', () => {
    expect(shown('wander')).toEqual({ row: routineMapStatus(farrier(), at('wander')).row, text: 'Locations of this row' });
  });
});
