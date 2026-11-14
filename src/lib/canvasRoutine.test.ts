import { describe, expect, it } from 'vitest';
import { PLAYER_START, type Connection, type Entity, type ScheduleAction, type ScheduleRow, type Traversable } from '@/types';
import { routineFlowEdge } from './canvasEdges';
import { routineKeyEntries } from './canvasKey';
import { routineView, type RoutineLine } from './canvasRoutine';
import { rangeText } from './routineTime';
import { withFirstStarts } from '@/lib/entityKind';
import { oneRoutine, withoutTraversable } from '@/test/routines';

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
];
const farrier = (traversable: Traversable = 'anywhere', schedule = day): Entity => ({
  id: 'farrier', name: 'Farrier', playerDescription: '', aiDescription: '', kind: 'unique',
  routines: oneRoutine([
    { id: 's1', place: 'smithy', weight: 1, schedule },
    { id: 's2', place: 'gate', weight: 1, schedule: [] },
  ], traversable),
} as Entity);

const view = (entity: Entity, rowId: string | null = null, startId: string | null = null) =>
  routineView(entity, { routineId: null, startId, rowId }, graph);
const markOf = (v: ReturnType<typeof view>, id: string) => v.marks.get(id);
const pairs = (lines: RoutineLine[]) => lines.map((l) => `${l.source}>${l.target}:${l.tone}${l.arrow ? '' : ':roam'}`).sort();
const label = (from: number, to: number) => rangeText({ start: from * 60, end: to * 60 });

describe("a Start at the player's starting location", () => {
  const companion = (kind: 'unique' | 'generic'): Entity => ({
    ...withFirstStarts(farrier(), [{ id: 'p', place: PLAYER_START, weight: 1, schedule: [timed('stay', 6, 10, { kind: 'stay', place: 'island' })] }]), kind,
  });

  it('draws no Starts Here flag, so the key lists none, and offers every place', () => {
    for (const kind of ['unique', 'generic'] as const) {
      const v = view(companion(kind));
      expect([...v.marks.values()].some((m) => m.kind === 'routine' && m.begin)).toBe(false);
      expect(routineKeyEntries(v)).not.toContain('start');
      expect(markOf(v, 'ridge')?.kind).toBe('plain');
      expect(markOf(v, 'island')?.kind).toBe('routine');
    }
  });
});

describe('the overview, with no row selected', () => {
  const v = view(farrier());

  it('colors each place by its row’s action and says when the entity is there, with no badges', () => {
    expect(markOf(v, 'inn')).toEqual({ kind: 'routine', tone: 'stay', spans: [{ tone: 'stay', time: label(6, 10), pieces: [[0, 240]] }] });
    for (const id of ['market', 'square']) {
      expect(markOf(v, id)).toEqual({ kind: 'routine', tone: 'wander', spans: [{ tone: 'wander', time: label(10, 14), pieces: [[240, 480]] }] });
    }
    for (const id of ['wall', 'gate']) {
      expect(markOf(v, id)).toEqual({ kind: 'routine', tone: 'patrol', spans: [{ tone: 'patrol', time: label(14, 18), pieces: [[480, 720]] }] });
    }
  });

  it('flags where the Start begins and marks the free time there, with no action color', () => {
    expect(markOf(v, 'smithy')).toEqual({
      kind: 'routine', begin: true, tone: undefined, spans: [{ tone: 'free', time: label(18, 6), pieces: [[720, 1440]] }],
    });
    expect([...v.marks.values()].filter((m) => m.begin)).toHaveLength(1);
  });

  it('gives a place two actions share the neutral ring and both times, in clock order', () => {
    const shared = view(farrier('anywhere', [
      timed('walk', 10, 14, { kind: 'wander', places: [{ place: 'inn', weight: 1 }, { place: 'market', weight: 1 }], idle: 60 }),
      timed('rest', 6, 10, { kind: 'stay', place: 'inn' }),
    ]));
    expect(markOf(shared, 'inn')?.tone).toBeUndefined();
    expect(markOf(shared, 'inn')?.spans?.map((s) => [s.tone, s.time])).toEqual([['stay', label(6, 10)], ['wander', label(10, 14)]]);
    expect(markOf(shared, 'market')?.tone).toBe('wander');
  });

  it('splits a time that runs across Dawn over both ends of the day', () => {
    const late = view(farrier('anywhere', [timed('sleep', 22, 8, { kind: 'stay', place: 'inn' })]));
    expect(markOf(late, 'inn')?.spans).toEqual([{ tone: 'stay', time: label(22, 8), pieces: [[960, 1440], [0, 120]] }]);
  });

  it('marks the whole day at the Start’s location when the schedule is empty', () => {
    expect(markOf(view(farrier(), null, 's2'), 'gate')?.spans).toEqual([{ tone: 'free', time: 'All day', pieces: [[0, 1440]] }]);
  });

  it('draws only the Patrol’s legs as arrows, one each way for A, B, A, and no line from one row to the next', () => {
    expect(pairs(v.lines)).toEqual(['gate>wall:patrol', 'wall>gate:patrol']);
    expect(v.lines.every((l) => l.arrow && !l.dashed)).toBe(true);
  });

  it('shows the Start on show, and an unknown row as the overview', () => {
    const second = view(farrier(), 'nope', 's2');
    expect(markOf(second, 'gate')).toMatchObject({ kind: 'routine', begin: true });
    expect(markOf(second, 'smithy')?.kind).toBe('plain');
    expect(second.lines).toEqual([]);
  });
});

describe('the detail, with a row selected', () => {
  it('colors and badges the Wander row’s places and joins them without arrowheads', () => {
    const v = view(farrier(), 'wander');
    expect(markOf(v, 'market')).toMatchObject({ kind: 'routine', tone: 'wander', badge: '75%', spans: [{ tone: 'wander', time: label(10, 14) }] });
    expect(markOf(v, 'square')).toMatchObject({ kind: 'routine', tone: 'wander', badge: '25%' });
    for (const id of ['inn', 'wall', 'gate']) expect(markOf(v, id)).toEqual({ kind: 'routine' });
    expect(markOf(v, 'smithy')).toEqual({ kind: 'routine', begin: true });
    expect(pairs(v.lines)).toEqual(['market>square:wander:roam']);
    expect(v.lines[0]).toMatchObject({ arrow: false, dashed: true });
  });

  it('numbers the Patrol stops, a repeated place carrying each of its numbers', () => {
    const v = view(farrier(), 'patrol');
    expect(markOf(v, 'wall')).toMatchObject({ tone: 'patrol', badge: '1, 3' });
    expect(markOf(v, 'gate')).toMatchObject({ tone: 'patrol', badge: '2' });
    expect(markOf(v, 'market')).toEqual({ kind: 'routine' });
    expect(pairs(v.lines)).toEqual(['gate>wall:patrol', 'wall>gate:patrol']);
  });

  it('colors a Stay row’s place with no badge and no line', () => {
    const v = view(farrier(), 'stay');
    expect(markOf(v, 'inn')).toEqual({ kind: 'routine', tone: 'stay', badge: undefined, spans: [{ tone: 'stay', time: label(6, 10), pieces: [[0, 240]] }] });
    expect(v.lines).toEqual([]);
  });
});

describe('reach', () => {
  it('leaves every connected place plain under Anywhere, Far links included, and fades the rest', () => {
    const v = view(farrier());
    expect(markOf(v, 'village')?.kind).toBe('plain');
    expect(markOf(v, 'ridge')?.kind).toBe('plain');
    expect(markOf(v, 'island')?.kind).toBe('faded');
  });

  it('reads a missing Can Also Go as an empty list, as play does', () => {
    const migrated = withoutTraversable(farrier());
    const v = view(migrated as Entity);
    expect(markOf(v, 'village')?.kind).toBe('faded');
    expect(markOf(v, 'inn')?.kind).toBe('routine');
  });

  it('outlines a listed place and fades every place outside the routine and the list', () => {
    const v = view(farrier(['ridge']));
    expect(markOf(v, 'ridge')?.kind).toBe('reach');
    expect(markOf(v, 'village')?.kind).toBe('faded');
    expect(markOf(v, 'island')?.kind).toBe('faded');
    expect(markOf(v, 'inn')?.kind).toBe('routine');
  });
});

describe('a Generic entity with two Starts', () => {
  // The farrier's routine on its first Start, a second Start on the ridge, and a Can Also Go list a Generic entity ignores.
  const herd = (secondPlace = 'ridge'): Entity => ({
    ...withFirstStarts(farrier(['island']), [{ id: 's1', place: 'smithy', weight: 1, schedule: day }, { id: 's2', place: secondPlace, weight: 1, schedule: [] }]), id: 'herd', kind: 'generic',
  });
  const unique = view(farrier());

  it('draws the Start on show as a Unique entity’s, spans, tones, flag and Patrol arrows alike', () => {
    const v = view(herd());
    for (const id of ['smithy', 'inn', 'market', 'square', 'wall', 'gate']) expect(markOf(v, id)).toEqual(markOf(unique, id));
    expect(pairs(v.lines)).toEqual(pairs(unique.lines));
  });

  it('marks where the other Start begins as Is Here, and nothing of its routine', () => {
    expect(markOf(view(herd()), 'ridge')).toEqual({ kind: 'here' });
    const second = view(herd(), null, 's2');
    expect(markOf(second, 'ridge')).toMatchObject({ kind: 'routine', begin: true });
    expect(markOf(second, 'smithy')).toEqual({ kind: 'here' });
    expect(markOf(second, 'inn')?.kind).toBe('plain');
  });

  it('falls back to the first Start once the Start on show is gone', () => {
    expect(view(herd(), null, 'removed')).toEqual(view(herd()));
  });

  it('keeps the routine look where the other Start begins at a place the Start on show uses', () => {
    expect(markOf(view(herd('gate')), 'gate')).toEqual(markOf(unique, 'gate'));
  });

  it('draws no Can Also Go mark and reaches what an Anywhere Unique entity reaches', () => {
    const v = view(herd());
    expect([...v.marks.values()].some((m) => m.kind === 'reach')).toBe(false);
    expect(markOf(v, 'village')?.kind).toBe('plain');
    expect(markOf(v, 'island')?.kind).toBe('faded');
  });

  it('keeps the selected row’s detail', () => {
    const v = view(herd(), 'patrol');
    expect(markOf(v, 'wall')).toMatchObject({ tone: 'patrol', badge: '1, 3' });
    expect(markOf(v, 'ridge')).toEqual({ kind: 'here' });
  });
});

it('draws movement lines straight and at full strength', () => {
  for (const line of view(farrier()).lines) {
    const edge = routineFlowEdge(line);
    expect(edge.data?.connectionStyle).toBe('straight');
    expect(edge.style?.opacity).toBeUndefined();
    expect(edge.style?.stroke).toBe(`hsl(var(--routine-${line.tone}))`);
  }
});
