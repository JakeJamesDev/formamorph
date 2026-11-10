import { isGeneric } from '@/lib/entityKind';
import { placesOf, startReach, type PlaceGraph } from '@/lib/positionEngine';
import type { ActionKind } from '@/lib/routineEditing';
import type { RoutineSelection } from '@/lib/routineSelection';
import { chancePercent, freeRanges, rangeText, rowClockKey, strip } from '@/lib/routineTime';
import { MINUTES_PER_DAY } from '@/lib/gameClock';
import type { Entity, EntityStart, ScheduleRange, ScheduleRow } from '@/types';

/**
 * The canvas's Routine view of one entity: how each location draws and which movement lines run between them,
 * for the Start on show and its selected row.
 */

/** `routine`: a place the routine uses. `here`: where another Start of a Generic entity begins. `reach`: a listed place it
 *  can be led to. `plain`: reachable under Anywhere. `faded`: it can never get there. */
export type RoutinePlaceKind = 'routine' | 'here' | 'reach' | 'plain' | 'faded';

/** A stretch of the day the entity can be at a place. `free`: time no row covers, at the Start's location. */
export interface RoutineSpan {
  tone: ActionKind | 'free';
  /** In words, as its row's sentence says it. */
  time: string;
  /** Where it sits on the Dawn-to-Dawn strip, in minutes: two pieces when it runs across Dawn. */
  pieces: [number, number][];
}

export interface RoutineMark {
  kind: RoutinePlaceKind;
  /** Where the Start on show begins. */
  begin?: true;
  /** The place's color: the selected row's action, or the one action every row here shares. Absent is the neutral ring. */
  tone?: ActionKind;
  /** Wander chances or Patrol stop numbers of the selected row. */
  badge?: string;
  /** When the entity can be here, in clock order: the whole day's rows, or only the selected row. */
  spans?: RoutineSpan[];
}

/** A Patrol's leg with an arrowhead, or the dashed link between two places of the selected Wander row. */
export interface RoutineLine {
  id: string;
  source: string;
  target: string;
  tone: ActionKind;
  arrow: boolean;
  dashed: boolean;
}

export interface RoutineView {
  marks: Map<string, RoutineMark>;
  lines: RoutineLine[];
}

/** One stretch of the day in clock order: a timed row, or time between them under the All-day row or at the Start. */
interface Block {
  row: ScheduleRow | null;
  span: Omit<RoutineSpan, 'tone'>;
  places: string[];
}

function blocks(start: EntityStart): Block[] {
  const base = start.schedule.find((r) => r.time === 'allDay') ?? null;
  const timed = start.schedule.filter((r): r is ScheduleRow & { time: ScheduleRange } => r.time !== 'allDay').sort((a, b) => rowClockKey(a) - rowClockKey(b));
  const gaps = freeRanges(timed).map((g) => {
    const range = { start: g.start, end: g.end % MINUTES_PER_DAY };
    return {
      at: g.start,
      block: {
        row: base,
        span: g.wholeDay ? { time: 'All day', pieces: [[0, MINUTES_PER_DAY]] as [number, number][] } : { time: rangeText(range), pieces: strip(range) },
        places: base ? placesOf(base.action) : [start.place],
      },
    };
  });
  const rows = timed.map((r) => ({
    at: rowClockKey(r),
    block: { row: r, span: { time: rangeText(r.time), pieces: strip(r.time) }, places: placesOf(r.action) },
  }));
  return [...gaps, ...rows].sort((a, b) => a.at - b.at).map((x) => x.block).filter((b) => b.places.length > 0);
}

function badgeOf(row: ScheduleRow, place: string): string | undefined {
  const a = row.action;
  if (a.kind === 'patrol') {
    const stops = a.stops.flatMap((s, i) => (s.place === place ? [String(i + 1)] : []));
    return stops.length ? stops.join(', ') : undefined;
  }
  if (a.kind === 'wander' && a.places.length > 1) {
    const at = a.places.find((p) => p.place === place);
    return at ? `${chancePercent(at.weight, a.places.map((p) => p.weight))}%` : undefined;
  }
  return undefined;
}

/** The one action every span shares, when there is one. */
function sharedTone(spans: readonly RoutineSpan[]): ActionKind | undefined {
  const tones = new Set(spans.map((s) => s.tone));
  const [only] = tones;
  return tones.size === 1 && only !== 'free' ? only : undefined;
}

/** The Routine view of `entity` on a map of `graph`. A Generic entity has no Traversable, and its other Starts' places
 *  show as `here`. */
export function routineView(entity: Entity, selection: RoutineSelection, graph: PlaceGraph): RoutineView {
  const marks = new Map<string, RoutineMark>(graph.locations.map((l) => [l.id, { kind: 'faded' }]));
  const lines: RoutineLine[] = [];
  const mark = (id: string, next: RoutineMark) => { if (marks.has(id)) marks.set(id, next); };

  const generic = isGeneric(entity);
  const starts = entity.starts ?? [];
  const start = starts.find((s) => s.id === selection.startId) ?? starts[0];
  if (!start) return { marks, lines };
  const selected = start.schedule.find((r) => r.id === selection.rowId) ?? null;

  const traversable = generic ? 'anywhere' : entity.traversable ?? 'anywhere';
  if (traversable === 'anywhere') {
    for (const id of startReach(start.place, graph)) mark(id, { kind: 'plain' });
  } else {
    for (const id of traversable) mark(id, { kind: 'reach' });
  }

  const day = blocks(start);
  const focused = (row: ScheduleRow | null) => !!selected && row?.id === selected.id;

  // Each place's day: every stretch it is used in, or only the selected row's.
  const spansAt = new Map<string, RoutineSpan[]>();
  for (const b of day) {
    for (const id of new Set(b.places)) {
      if (!marks.has(id)) continue;
      const here = spansAt.get(id) ?? [];
      spansAt.set(id, here);
      if (!selected || focused(b.row)) here.push({ ...b.span, tone: b.row?.action.kind ?? 'free' });
    }
  }
  for (const [id, spans] of spansAt) {
    if (selected) {
      const badge = spans.length ? badgeOf(selected, id) : undefined;
      mark(id, spans.length ? { kind: 'routine', tone: selected.action.kind, badge, spans } : { kind: 'routine' });
    } else {
      mark(id, { kind: 'routine', tone: sharedTone(spans), spans });
    }
  }
  const at = marks.get(start.place);
  if (at) marks.set(start.place, { ...at, kind: 'routine', begin: true });
  if (generic) {
    for (const other of starts) {
      if (other !== start && marks.get(other.place)?.kind !== 'routine') mark(other.place, { kind: 'here' });
    }
  }

  const drawn = new Set<string>();
  const line = (source: string, target: string, row: ScheduleRow, arrow: boolean) => {
    if (source === target || !marks.has(source) || !marks.has(target)) return;
    const id = `routine:${source}>${target}:${row.id}:${arrow ? 'go' : 'roam'}`;
    if (drawn.has(id) || (!arrow && drawn.has(`routine:${target}>${source}:${row.id}:roam`))) return;
    drawn.add(id);
    lines.push({ id, source, target, tone: row.action.kind, arrow, dashed: !arrow });
  };

  // Only a Patrol moves in a set order, so only it draws arrows. No line joins one row to the next: the entity is
  // simply where its row puts it when the time comes.
  for (const b of day) {
    const r = b.row;
    if (!r || (selected && !focused(r))) continue;
    if (r.action.kind === 'patrol') b.places.forEach((p, j) => line(p, b.places[(j + 1) % b.places.length], r, true));
    if (r.action.kind === 'wander' && focused(r)) b.places.forEach((p, j) => b.places.slice(j + 1).forEach((q) => line(p, q, r, false)));
  }
  return { marks, lines };
}
