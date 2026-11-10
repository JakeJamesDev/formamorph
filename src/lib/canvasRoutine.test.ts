import { describe, expect, it } from 'vitest';
import type { Connection, Entity, ScheduleAction, ScheduleRow, Traversable } from '@/types';
import { routineFlowEdge } from './canvasEdges';
import { routineView, type RoutineLine } from './canvasRoutine';
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
];
const farrier = (traversable: Traversable = 'anywhere', schedule = day): Entity => ({
  id: 'farrier', name: 'Farrier', playerDescription: '', aiDescription: '', kind: 'individual', traversable,
  starts: [
    { id: 's1', place: 'smithy', weight: 1, schedule },
    { id: 's2', place: 'gate', weight: 1, schedule: [] },
  ],
} as Entity);

const view = (entity: Entity, rowId: string | null = null, startId: string | null = null) =>
  routineView(entity, { startId, rowId }, graph);
const markOf = (v: ReturnType<typeof view>, id: string) => v.marks.get(id);
const pairs = (lines: RoutineLine[]) => lines.map((l) => `${l.source}>${l.target}:${l.tone}${l.arrow ? '' : ':roam'}`).sort();
const label = (from: number, to: number) => rangeText({ start: from * 60, end: to * 60 });

describe('the overview, with no row selected', () => {
  const v = view(farrier());

  it('rings every routine place the same, flags where the Start begins, and gives no badges', () => {
    for (const id of ['smithy', 'inn', 'market', 'square', 'wall', 'gate']) {
      expect(markOf(v, id)).toMatchObject({ kind: 'routine' });
      expect(markOf(v, id)?.tone).toBeUndefined();
      expect(markOf(v, id)?.badge).toBeUndefined();
    }
    expect(markOf(v, 'smithy')?.begin).toBe(true);
    expect([...v.marks.values()].filter((m) => m.begin)).toHaveLength(1);
  });

  it('draws each move at a set time as an arrow in its action color, labeled with its time', () => {
    const moves = v.lines.filter((l) => l.label);
    expect(moves.map((l) => [l.source, l.target, l.tone, l.label])).toEqual([
      ['smithy', 'inn', 'stay', label(6, 10)],
      ['inn', 'market', 'wander', label(10, 14)],
      ['market', 'wall', 'patrol', label(14, 18)],
      ['wall', 'smithy', 'free', label(18, 6)],
    ]);
    expect(v.lines.every((l) => l.arrow)).toBe(true);
  });

  it('draws one arrow per Wander place in and out, dashed, and no lines between Wander places', () => {
    expect(pairs(v.lines)).toEqual([
      'gate>wall:patrol', 'inn>market:wander', 'inn>square:wander', 'market>wall:patrol', 'smithy>inn:stay',
      'square>wall:patrol', 'wall>gate:patrol', 'wall>smithy:free',
    ]);
    expect(v.lines.filter((l) => l.dashed).map((l) => `${l.source}>${l.target}`).sort())
      .toEqual(['inn>market', 'inn>square', 'market>wall', 'square>wall']);
  });

  it('draws a Patrol that goes A, B, A as two arrows, one each way', () => {
    const patrol = v.lines.filter((l) => l.tone === 'patrol' && !l.label && !l.dashed);
    expect(patrol.map((l) => `${l.source}>${l.target}`).sort()).toEqual(['gate>wall', 'wall>gate']);
  });

  it('keeps a move’s time when it runs along a Patrol leg', () => {
    const v = view(farrier('anywhere', [
      timed('watch', 6, 10, { kind: 'stay', place: 'gate' }),
      timed('round', 10, 14, { kind: 'patrol', stops: [{ place: 'wall', idle: 30 }, { place: 'gate', idle: 30 }] }),
    ]));
    const leg = v.lines.find((l) => l.source === 'gate' && l.target === 'wall');
    expect(leg).toMatchObject({ tone: 'patrol', label: label(10, 14) });
    expect(v.lines.filter((l) => l.source === 'gate' && l.target === 'wall')).toHaveLength(1);
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
    expect(markOf(v, 'market')).toMatchObject({ kind: 'routine', tone: 'wander', badge: '75%' });
    expect(markOf(v, 'square')).toMatchObject({ kind: 'routine', tone: 'wander', badge: '25%' });
    for (const id of ['inn', 'wall', 'gate']) expect(markOf(v, id)).toEqual({ kind: 'routine' });
    expect(pairs(v.lines)).toEqual(['inn>market:wander', 'inn>square:wander', 'market>square:wander:roam']);
  });

  it('numbers the Patrol stops, a repeated place carrying each of its numbers', () => {
    const v = view(farrier(), 'patrol');
    expect(markOf(v, 'wall')).toMatchObject({ tone: 'patrol', badge: '1, 3' });
    expect(markOf(v, 'gate')).toMatchObject({ tone: 'patrol', badge: '2' });
    expect(markOf(v, 'market')).toEqual({ kind: 'routine' });
    expect(v.lines.every((l) => l.tone === 'patrol')).toBe(true);
    expect(pairs(v.lines)).toEqual(['gate>wall:patrol', 'market>wall:patrol', 'square>wall:patrol', 'wall>gate:patrol']);
  });

  it('colors a Stay row’s place with no badge, keeping the Start flag elsewhere', () => {
    const v = view(farrier(), 'stay');
    expect(markOf(v, 'inn')).toEqual({ kind: 'routine', tone: 'stay', badge: undefined });
    expect(markOf(v, 'smithy')).toEqual({ kind: 'routine', begin: true });
    expect(pairs(v.lines)).toEqual(['smithy>inn:stay']);
  });
});

describe('reach', () => {
  it('leaves every connected place plain under Anywhere, Far links included, and fades the rest', () => {
    const v = view(farrier());
    expect(markOf(v, 'village')?.kind).toBe('plain');
    expect(markOf(v, 'ridge')?.kind).toBe('plain');
    expect(markOf(v, 'island')?.kind).toBe('faded');
  });

  it('outlines a listed place and fades every place outside the routine and the list', () => {
    const v = view(farrier(['ridge']));
    expect(markOf(v, 'ridge')?.kind).toBe('reach');
    expect(markOf(v, 'village')?.kind).toBe('faded');
    expect(markOf(v, 'island')?.kind).toBe('faded');
    expect(markOf(v, 'inn')?.kind).toBe('routine');
  });
});

it('lights a Group’s places and draws no lines', () => {
  const herd = { id: 'herd', name: 'Herd', kind: 'group', locations: ['inn', 'market'] } as Entity;
  const v = view(herd);
  expect(markOf(v, 'inn')).toEqual({ kind: 'routine' });
  expect(markOf(v, 'market')).toEqual({ kind: 'routine' });
  expect(markOf(v, 'smithy')?.kind).toBe('faded');
  expect(v.lines).toEqual([]);
});

it('draws movement lines straight and at full strength', () => {
  for (const line of view(farrier()).lines) {
    const edge = routineFlowEdge(line);
    expect(edge.data?.connectionStyle).toBe('straight');
    expect(edge.style?.opacity).toBeUndefined();
    expect(edge.style?.stroke).toBe(line.tone === 'free' ? 'hsl(var(--muted-foreground))' : `hsl(var(--routine-${line.tone}))`);
  }
});
