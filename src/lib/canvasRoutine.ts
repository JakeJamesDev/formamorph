import { connectedPlaces, placesOf, type PlaceGraph } from '@/lib/positionEngine';
import type { ActionKind } from '@/lib/routineEditing';
import type { RoutineSelection } from '@/lib/routineSelection';
import { chancePercent, freeRanges, rangeText, rowClockKey } from '@/lib/routineTime';
import { MINUTES_PER_DAY } from '@/lib/gameClock';
import type { Entity, EntityStart, ScheduleRange, ScheduleRow } from '@/types';

/**
 * The canvas's Routine view of one entity: how each location draws and which movement lines run between them,
 * for the Start on show and its selected row.
 */

/** `routine`: a place the routine uses. `reach`: a listed place it can be led to. `plain`: reachable under
 *  Anywhere. `faded`: it can never get there. */
export type RoutinePlaceKind = 'routine' | 'reach' | 'plain' | 'faded';

export interface RoutineMark {
  kind: RoutinePlaceKind;
  /** Where the Start on show begins. */
  begin?: true;
  /** The selected row's action, on that row's places. Absent is the neutral ring. */
  tone?: ActionKind;
  /** Wander chances or Patrol stop numbers of the selected row. */
  badge?: string;
}

export interface RoutineLine {
  id: string;
  source: string;
  target: string;
  /** `free`: a move into time no row covers. */
  tone: ActionKind | 'free';
  arrow: boolean;
  dashed: boolean;
  label?: string;
}

export interface RoutineView {
  marks: Map<string, RoutineMark>;
  lines: RoutineLine[];
}

/** One stretch of the day in clock order: a timed row, or time between them under the All-day row or at the Start. */
interface Block {
  row: ScheduleRow | null;
  label: string;
  places: string[];
}

function blocks(start: EntityStart): Block[] {
  const base = start.schedule.find((r) => r.time === 'allDay') ?? null;
  const timed = start.schedule.filter((r): r is ScheduleRow & { time: ScheduleRange } => r.time !== 'allDay').sort((a, b) => rowClockKey(a) - rowClockKey(b));
  const gaps = freeRanges(timed).map((g) => ({
    at: g.start,
    block: {
      row: base,
      label: rangeText({ start: g.start, end: g.end % MINUTES_PER_DAY }),
      places: base ? placesOf(base.action) : [start.place],
    },
  }));
  const rows = timed.map((r) => ({
    at: rowClockKey(r),
    block: { row: r, label: rangeText(r.time), places: placesOf(r.action) },
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

/** The Routine view of `entity` on a map of `graph`. A Group lights its places and draws no lines. */
export function routineView(entity: Entity, selection: RoutineSelection, graph: PlaceGraph): RoutineView {
  const marks = new Map<string, RoutineMark>(graph.locations.map((l) => [l.id, { kind: 'faded' }]));
  const lines: RoutineLine[] = [];
  const mark = (id: string, next: RoutineMark) => { if (marks.has(id)) marks.set(id, next); };

  if (entity.kind === 'group') {
    for (const id of entity.locations ?? []) mark(id, { kind: 'routine' });
    return { marks, lines };
  }
  const starts = entity.starts ?? [];
  const start = starts.find((s) => s.id === selection.startId) ?? starts[0];
  if (!start) return { marks, lines };
  const selected = start.schedule.find((r) => r.id === selection.rowId) ?? null;

  const traversable = entity.traversable ?? 'anywhere';
  if (traversable === 'anywhere') {
    for (const id of connectedPlaces(start.place, graph)) mark(id, { kind: 'plain' });
  } else {
    for (const id of traversable) mark(id, { kind: 'reach' });
  }

  const day = blocks(start);
  const focused = (row: ScheduleRow | null) => !!selected && row?.id === selected.id;
  // The selected row marks last, so its color wins a place it shares.
  for (const b of [...day].sort((x, y) => Number(focused(x.row)) - Number(focused(y.row)))) {
    for (const id of b.places) {
      mark(id, focused(b.row) && b.row
        ? { kind: 'routine', tone: b.row.action.kind, badge: badgeOf(b.row, id) }
        : { kind: 'routine' });
    }
  }
  const at = marks.get(start.place);
  if (at) marks.set(start.place, { ...at, kind: 'routine', begin: true });

  const byId = new Map<string, RoutineLine>();
  const line = (source: string, target: string, row: ScheduleRow | null, o: { arrow: boolean; dashed: boolean; label?: string }) => {
    if (source === target || !marks.has(source) || !marks.has(target)) return;
    if (selected && !focused(row)) return;
    const key = row?.id ?? 'free';
    const id = `routine:${source}>${target}:${key}:${o.arrow ? 'go' : 'roam'}`;
    if (!o.arrow && byId.has(`routine:${target}>${source}:${key}:roam`)) return;
    // A move that runs along a line already drawn, like a Patrol's own leg, adds its time to that line.
    const drawn = byId.get(id);
    if (drawn) {
      if (o.label) drawn.label = drawn.label ? `${drawn.label}, ${o.label}` : o.label;
      return;
    }
    const next: RoutineLine = { id, source, target, tone: row?.action.kind ?? 'free', ...o };
    byId.set(id, next);
    lines.push(next);
  };

  day.forEach((b, i) => {
    const r = b.row;
    const a = r?.action;
    if (a?.kind === 'patrol') b.places.forEach((p, j) => line(p, b.places[(j + 1) % b.places.length], r, { arrow: true, dashed: false }));
    if (a?.kind === 'wander' && focused(r)) {
      b.places.forEach((p, j) => b.places.slice(j + 1).forEach((q) => line(p, q, r, { arrow: false, dashed: true })));
    }
    if (day.length < 2) return;
    // Into this stretch, from where the one before it leaves the entity.
    const prev = day[(i + day.length - 1) % day.length];
    const from = prev.row?.action.kind === 'wander' ? prev.places : [prev.places[0]];
    const to = a?.kind === 'wander' ? b.places : [b.places[0]];
    const many = from.length > 1 || to.length > 1;
    from.forEach((s, si) => to.forEach((t, ti) => line(s, t, r, { arrow: true, dashed: many, label: si === 0 && ti === 0 ? b.label : undefined })));
  });
  return { marks, lines };
}
