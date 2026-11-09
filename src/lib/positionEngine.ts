import type {
  Connection, DiscoveredEntity, EntityPositions, EntityStart, IndividualState, IndividualStates, PatrolStop, PositionHold,
  ScheduleRange, ScheduleRow, Traversable, WanderPlace,
} from "@/types";
import { reachableFrom, type LocationLink } from "@/lib/locationGraph";
import { MINUTES_PER_DAY, nextDaypartEdge } from "@/lib/gameClock";

/**
 * The position engine: where every Individual is now. Pure: the same routines, book, scene and random source
 * give the same result. Times are story minutes (`storyMinute`). Moves jump straight to their target and are
 * silent; the caller decides what to show.
 */

/** What the engine reads of an Individual. */
export interface Routine {
  id: string;
  starts: readonly EntityStart[];
  traversable: Traversable;
}

/** The places and links travel runs over. */
export interface PlaceGraph {
  locations: readonly LocationLink[];
  connections: readonly Connection[];
}

/** The world as one engine call sees it. */
export interface PositionScene extends PlaceGraph {
  now: number;
  playerAt: string | undefined;
}

/** Where each character stands, and each Individual's engine state. */
export interface PositionBook {
  positions: EntityPositions;
  individuals: IndividualStates;
}

/** The wait lengths a follower can be given (Q8). */
export type WaitLength = "hour" | "thisDaypart" | "nextDaypart";

/** The places travel can reach from `from` through any path, Far links included. Holds `from`. */
export const connectedPlaces = (from: string, graph: PlaceGraph): Set<string> =>
  reachableFrom([from], graph.locations, graph.connections);

/** A Patrol stop that survived the connected filter, with its index in the authored list. */
interface LiveStop extends PatrolStop {
  index: number;
}

/** A row as it plays: unconnected places dropped, and a row with none left staying at the Start's place. */
type LiveAction =
  | { kind: "stay"; place: string }
  | { kind: "wander"; places: WanderPlace[]; idle: number }
  | { kind: "patrol"; stops: LiveStop[] };

interface LiveRow {
  /** Absent in free time and with an empty schedule. */
  rowId?: string;
  strict: boolean;
  action: LiveAction;
}

const dayMinute = (t: number) => ((t % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

const covers = ({ start, end }: ScheduleRange, m: number) =>
  start < end ? m >= start && m < end : start > end && (m >= start || m < end);

/** The row in force at `t`: the timed row covering it, else the All-day row. */
function rowAt(start: EntityStart, t: number): ScheduleRow | undefined {
  const m = dayMinute(t);
  return start.schedule.find((r) => r.time !== "allDay" && covers(r.time, m))
    ?? start.schedule.find((r) => r.time === "allDay");
}

function liveRow(start: EntityStart, row: ScheduleRow | undefined, connected: ReadonlySet<string>): LiveRow {
  const atStart: LiveAction = { kind: "stay", place: start.place };
  if (!row) return { strict: false, action: atStart };
  const base = { rowId: row.id, strict: !!row.strict };
  const a = row.action;
  if (a.kind === "stay") return { ...base, action: connected.has(a.place) ? a : atStart };
  if (a.kind === "wander") {
    const places = a.places.filter((p) => connected.has(p.place));
    return { ...base, action: places.length ? { kind: "wander", places, idle: a.idle } : atStart };
  }
  const stops = a.stops.map((s, index) => ({ ...s, index })).filter((s) => connected.has(s.place));
  return { ...base, action: stops.length ? { kind: "patrol", stops } : atStart };
}

const placesOf = (action: LiveAction): string[] =>
  action.kind === "stay" ? [action.place] : action.kind === "wander" ? action.places.map((p) => p.place) : action.stops.map((s) => s.place);

/** The first time after `t` a timed row starts or ends. */
function nextBoundary(start: EntityStart, t: number): number {
  const day = t - dayMinute(t);
  let next = Infinity;
  for (const row of start.schedule) {
    if (row.time === "allDay") continue;
    for (const edge of [row.time.start, row.time.end]) {
      const at = day + dayMinute(edge);
      next = Math.min(next, at > t ? at : at + MINUTES_PER_DAY);
    }
  }
  return next;
}

/** When the stretch of the day holding `t` ends: the next time another row takes over. Undefined when none ever does. */
function stretchEnd(start: EntityStart, t: number): number | undefined {
  const rowId = rowAt(start, t)?.id;
  for (let b = nextBoundary(start, t); b - t <= MINUTES_PER_DAY; b = nextBoundary(start, b)) {
    if (rowAt(start, b)?.id !== rowId) return b;
  }
  return undefined;
}

/** Idle durations count at least one minute, so time always moves forward. */
const idleOf = (minutes: number) => Math.max(1, Math.round(minutes));

function weighted<T>(items: readonly T[], weight: (item: T) => number, random: () => number): T {
  const weights = items.map((item) => Math.max(0, weight(item)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return items[Math.floor(random() * items.length)];
  let r = random() * total;
  let last = 0;
  for (let i = 0; i < items.length; i++) {
    if (weights[i] <= 0) continue;
    last = i;
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[last]; // float rounding past the total
}

/** A weighted Wander pick, other than `current` when there is a choice. */
function pickWander(places: readonly WanderPlace[], current: string | undefined, random: () => number): string {
  const others = places.filter((p) => p.place !== current);
  return weighted(others.length ? others : places, (p) => p.weight, random).place;
}

/** The Patrol stop after the one last reached, looping to stop 1 (Q62). */
const nextStop = (stops: readonly LiveStop[], last: number | undefined): LiveStop =>
  (last === undefined ? undefined : stops.find((s) => s.index > last)) ?? stops[0];

/** One Individual's position and state while the engine works on it. */
interface Body {
  pos: string | undefined;
  st: IndividualState;
}

/** The row starts at `t`. Patrol begins at stop 1; Wander keeps a place of its own or picks one. */
function enterRow(body: Body, row: LiveRow, t: number, random: () => number): void {
  const { action } = row;
  body.st = { ...body.st, rowId: row.rowId, idleEnd: undefined, stop: undefined };
  if (action.kind === "stay") body.pos = action.place;
  else if (action.kind === "wander") {
    if (!body.pos || !placesOf(action).includes(body.pos)) body.pos = pickWander(action.places, body.pos, random);
    body.st.idleEnd = t + idleOf(action.idle);
  } else {
    const first = action.stops[0];
    body.pos = first.place;
    body.st = { ...body.st, stop: first.index, idleEnd: t + idleOf(first.idle) };
  }
}

/** The row's next move at `t`: back to the Stay place, a new Wander pick, or the next Patrol stop. */
function stepRow(body: Body, { action }: LiveRow, t: number, random: () => number): void {
  if (action.kind === "stay") {
    body.pos = action.place;
    body.st = { ...body.st, idleEnd: undefined };
  } else if (action.kind === "wander") {
    body.pos = pickWander(action.places, body.pos, random);
    body.st = { ...body.st, idleEnd: t + idleOf(action.idle) };
  } else {
    const stop = nextStop(action.stops, body.st.stop);
    body.pos = stop.place;
    body.st = { ...body.st, stop: stop.index, idleEnd: t + idleOf(stop.idle) };
  }
}

function rollStart(starts: readonly EntityStart[], random: () => number): EntityStart | undefined {
  return starts.length ? weighted(starts, (s) => s.weight, random) : undefined;
}

/** The places `routine` may be pulled or led into on `start` at `now`: its row's places plus Traversable. */
function allowedOn(routine: Routine, start: EntityStart, now: number, graph: PlaceGraph, connected: ReadonlySet<string>): Set<string> {
  if (routine.traversable === "anywhere") return new Set(graph.locations.map((l) => l.id));
  return new Set([...placesOf(liveRow(start, rowAt(start, now), connected).action), ...routine.traversable]);
}

/** Per-call cache of each Start place's connected set. */
type ConnectedCache = (place: string) => Set<string>;

function connectedCache(graph: PlaceGraph): ConnectedCache {
  const cache = new Map<string, Set<string>>();
  return (place) => {
    let set = cache.get(place);
    if (!set) cache.set(place, (set = connectedPlaces(place, graph)));
    return set;
  };
}

function advanceOne(
  routine: Routine, saved: IndividualState | undefined, savedPos: string | undefined,
  scene: PositionScene, random: () => number, connected: ConnectedCache,
): Body | undefined {
  const { now, playerAt } = scene;
  const savedStart = saved && routine.starts.find((s) => s.id === saved.startId);
  const fresh = !savedStart;
  // Once per playthrough (Q33); a lost Start rolls again (Q87).
  const start = savedStart ?? rollStart(routine.starts, random);
  if (!start) return undefined;
  const body: Body = saved && savedStart
    ? { pos: savedPos, st: saved }
    : { pos: savedPos ?? start.place, st: { startId: start.id, lastRun: now } };
  const reach = connected(start.place);
  const pause = (): Body => ({ pos: body.pos, st: { ...body.st, lastRun: now } });
  let cursor = Math.min(body.st.lastRun, now);

  const follow = body.st.follow;
  if (follow?.mode === "following") {
    if (playerAt !== undefined && body.pos !== playerAt) {
      if (follow.script || allowedOn(routine, start, now, scene, reach).has(playerAt)) body.pos = playerAt;
      else body.st = { ...body.st, follow: { mode: "waiting", until: nextDaypartEdge(now) } }; // blocked (Q42)
    }
    return pause();
  }
  if (follow?.mode === "waiting") {
    if (now < follow.until) return pause();
    cursor = Math.max(cursor, follow.until);
    body.st = { ...body.st, follow: undefined };
  }

  if (!fresh && playerAt !== undefined && body.pos === playerAt) return pause(); // nobody leaves mid-scene

  const hold = body.st.hold;
  if (hold) {
    const release = "until" in hold ? hold.until : Infinity;
    if (release > now) return pause();
    cursor = Math.max(cursor, release);
    body.st = { ...body.st, hold: undefined };
  }

  // Replay every row edge and idle in clock order up to now (Q83).
  const live = (t: number) => liveRow(start, rowAt(start, t), reach);
  const first = live(cursor);
  if (first.rowId !== body.st.rowId) enterRow(body, first, cursor, random);
  else if (!body.pos || !placesOf(first.action).includes(body.pos)) stepRow(body, first, cursor, random);
  while (body.pos !== playerAt) {
    const t = Math.max(cursor, Math.min(nextBoundary(start, cursor), body.st.idleEnd ?? Infinity));
    if (!(t <= now)) break;
    cursor = t;
    const row = live(t);
    if (row.rowId !== body.st.rowId) enterRow(body, row, t, random);
    else if (body.st.idleEnd !== undefined && body.st.idleEnd <= t) stepRow(body, row, t, random);
  }
  return pause();
}

/** Strips undefined fields, so a saved state carries only what it holds. */
function tidy(st: IndividualState): IndividualState {
  const out = { ...st };
  for (const key of Object.keys(out) as (keyof IndividualState)[]) if (out[key] === undefined) delete out[key];
  return out;
}

/**
 * Every Individual in `routines` placed for `scene.now`: the Start rolled on first sight, the schedule replayed
 * since the last run, followers led to the player or left waiting, holds and waits released. Characters
 * outside `routines` keep their positions.
 */
export function advancePositions(
  routines: readonly Routine[], book: PositionBook, scene: PositionScene, random: () => number,
): PositionBook {
  const positions = { ...book.positions };
  const individuals = { ...book.individuals };
  const connected = connectedCache(scene);
  for (const routine of routines) {
    const body = advanceOne(routine, book.individuals[routine.id], book.positions[routine.id], scene, random, connected);
    if (!body) {
      delete individuals[routine.id];
      delete positions[routine.id];
      continue;
    }
    if (body.pos === undefined) delete positions[routine.id];
    else positions[routine.id] = body.pos;
    individuals[routine.id] = tidy(body.st);
  }
  return { positions, individuals };
}

/** The saved Start of `routine`, if it still has it. */
const startOf = (routine: Routine, st: IndividualState | undefined) => st && routine.starts.find((s) => s.id === st.startId);

/** The places `routine` may be pulled or led into right now: its current row's places (the Start's place in free
 *  time) plus its Traversable places. Every place for Anywhere. */
export function allowedPlaces(routine: Routine, st: IndividualState | undefined, scene: PositionScene): Set<string> {
  const start = startOf(routine, st);
  if (!start) return new Set();
  return allowedOn(routine, start, scene.now, scene, connectedPlaces(start.place, scene));
}

/** Whether the row in force for `routine` right now is Strict. */
export function isStrictNow(routine: Routine, st: IndividualState | undefined, now: number): boolean {
  const start = startOf(routine, st);
  return !!start && !!rowAt(start, now)?.strict;
}

const withState = (book: PositionBook, id: string, st: IndividualState, pos?: string): PositionBook => ({
  positions: pos === undefined ? book.positions : { ...book.positions, [id]: pos },
  individuals: { ...book.individuals, [id]: tidy(st) },
});

/** The hold for a move off the schedule now, and the idle it runs on. Wander and Patrol hold until the current
 *  idle runs out, or a fresh one when it already has (Q92). */
function holdFor(
  routine: Routine, st: IndividualState, scene: PositionScene, onStay: (start: EntityStart) => PositionHold | undefined,
): { hold?: PositionHold; idleEnd?: number } | undefined {
  const start = startOf(routine, st);
  if (!start) return undefined;
  const { action } = liveRow(start, rowAt(start, scene.now), connectedPlaces(start.place, scene));
  if (action.kind === "stay") return { hold: onStay(start) };
  const idle = action.kind === "wander" ? action.idle : (action.stops.find((s) => s.index === st.stop) ?? action.stops[0]).idle;
  const idleEnd = st.idleEnd !== undefined && st.idleEnd > scene.now ? st.idleEnd : scene.now + idleOf(idle);
  return { hold: { until: idleEnd }, idleEnd };
}

/** A narration pull brings `routine` to `to`. Refused for a follower, a waiting character, a Strict row and a
 *  place not allowed (Q26, Q36). On a Stay row it needs no hold: nobody moves at the player location, so it
 *  goes back once the player leaves (Q40). */
export function pullIndividual(book: PositionBook, routine: Routine, to: string, scene: PositionScene): PositionBook {
  const st = book.individuals[routine.id];
  if (!st || st.follow || isStrictNow(routine, st, scene.now) || !allowedPlaces(routine, st, scene).has(to)) return book;
  const held = holdFor(routine, st, scene, () => undefined);
  if (!held) return book;
  return withState(book, routine.id, { ...st, hold: held.hold, idleEnd: held.idleEnd ?? st.idleEnd }, to);
}

/** A script moved `routine` to `to`. It holds until the current idle runs out, or on a Stay row until that
 *  stretch of the day ends (Q53, Q90). It ends a wait. */
export function moveIndividualByScript(book: PositionBook, routine: Routine, to: string, scene: PositionScene): PositionBook {
  const st = book.individuals[routine.id];
  const held = st && holdFor(routine, st, scene, (start) => {
    const end = stretchEnd(start, scene.now);
    return end === undefined ? { untilScriptMove: true } : { until: end };
  });
  if (!held) return book;
  const follow = st.follow?.mode === "waiting" ? undefined : st.follow;
  return withState(book, routine.id, { ...st, follow, hold: held.hold, idleEnd: held.idleEnd ?? st.idleEnd }, to);
}

/** `routine` starts following the player. Refused on a Strict row unless a script asks (Q36, Q64). */
export function startFollowing(
  book: PositionBook, routine: Routine, scene: PositionScene, options: { script?: boolean } = {},
): PositionBook {
  const st = book.individuals[routine.id];
  if (!st || st.follow?.mode === "following") return book;
  if (!options.script && isStrictNow(routine, st, scene.now)) return book;
  return withState(book, routine.id, { ...st, hold: undefined, follow: { mode: "following", ...(options.script ? { script: true } : {}) } });
}

/** The until-time of a wait asked at `now`, never past the end of the next daypart (Q3). */
export function waitUntil(length: WaitLength | { until: number }, now: number): number {
  const cap = nextDaypartEdge(nextDaypartEdge(now));
  if (typeof length === "object") return Math.min(Math.max(length.until, now), cap);
  if (length === "hour") return Math.min(now + 60, cap);
  return length === "thisDaypart" ? nextDaypartEdge(now) : cap;
}

/** A follower waits where it stands until the wait runs out. */
export function startWaiting(book: PositionBook, id: string, length: WaitLength | { until: number }, now: number): PositionBook {
  const st = book.individuals[id];
  if (!st?.follow) return book;
  const script = st.follow.script ? { script: true } : {};
  return withState(book, id, { ...st, follow: { mode: "waiting", until: waitUntil(length, now), ...script } });
}

/** Part ways: a follower or waiting character goes back to its schedule. */
export function partWays(book: PositionBook, id: string): PositionBook {
  const st = book.individuals[id];
  return st?.follow ? withState(book, id, { ...st, follow: undefined }) : book;
}

/** A runtime character as an Individual: one Start at its discovery place, an empty schedule, Anywhere (Q56). */
export function runtimeRoutine(discovered: DiscoveredEntity): Routine | undefined {
  if (!discovered.locationId) return undefined;
  return {
    id: discovered.entity.id,
    starts: [{ id: "discovered", place: discovered.locationId, weight: 1, schedule: [] }],
    traversable: "anywhere",
  };
}
