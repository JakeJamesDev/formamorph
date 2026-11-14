import { PLAYER_START } from "@/types";
import type {
  Connection, DiscoveredEntity, EntityPositions, EntityStart, FollowState, GenericStates, UniqueState, UniqueStates, PatrolStop, PositionHold,
  GenericEntityInstanceState, ScheduleAction, ScheduleRange, ScheduleRow, Traversable, WanderPlace,
} from "@/types";
import { reachableFrom, type LocationLink } from "@/lib/locationGraph";
import { MINUTES_PER_DAY, nextDaypartEdge } from "@/lib/gameClock";

/**
 * The position engine: where every Unique entity and every Generic Entity Instance is now. Pure: the same courses,
 * book, scene and random source give the same result. Times are story minutes (`storyMinute`). Moves jump
 * straight to their target and are silent; the caller decides what to show.
 */

/** One Routine as the engine reads it. */
export interface CourseRoutine {
  id: string;
  starts: readonly EntityStart[];
  traversable: Traversable;
}

/** What the engine reads of an entity with a kind: its Routines in author order and the one whose gate holds. A
 *  Generic entity runs every Start of that Routine at once and ignores weight, Strict and Traversable. */
export interface Course {
  /** The entity id. */
  id: string;
  routines: readonly CourseRoutine[];
  /** The applying Routine's id; null while none holds, which is Away all day (Q24). */
  applying: string | null;
  generic?: true;
}

/** One Routine's Starts and Traversable under the entity's id: what one engine step plays. */
interface PlayedRoutine {
  id: string;
  starts: readonly EntityStart[];
  traversable: Traversable;
  generic?: true;
}

/** The id `oneRoutineCourse` gives its Routine. */
export const ONLY_ROUTINE_ID = "routine-1";

/** A Course of one Routine that always applies. */
export const oneRoutineCourse = (leg: PlayedRoutine): Course => ({
  id: leg.id,
  routines: [{ id: ONLY_ROUTINE_ID, starts: leg.starts, traversable: leg.traversable }],
  applying: ONLY_ROUTINE_ID,
  ...(leg.generic && { generic: true as const }),
});

/** The Routine `st` plays: its saved one, absent the first (a v3.7.0 save). */
const routineIdOf = (course: Course, st: UniqueState | undefined): string | undefined => st?.routineId ?? course.routines[0]?.id;

/** `routine` as a leg of `course`. */
const playedRoutineFrom = (course: Course, routine: CourseRoutine | undefined): PlayedRoutine => ({
  id: course.id, starts: routine?.starts ?? [], traversable: routine?.traversable ?? [], ...(course.generic && { generic: true as const }),
});

/** The leg `st` plays: its Routine's Starts, Away all day while no Routine holds for it. */
function playedRoutineOf(course: Course, st: UniqueState | undefined): PlayedRoutine {
  const id = routineIdOf(course, st);
  const leg = playedRoutineFrom(course, course.routines.find((r) => r.id === id) ?? course.routines[0]);
  return st?.nowhere ? awayAllDay(leg) : leg;
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
  /** Where the player began: the place of a Start at `PLAYER_START`. Undefined places nobody there. */
  playerStart?: string;
}

/** Where each Unique entity stands with its engine state, and each Generic entity's Generic Entity Instances. */
export interface PositionBook {
  positions: EntityPositions;
  uniques: UniqueStates;
  generics: GenericStates;
}

/** A book with nobody placed yet. */
export const EMPTY_BOOK: PositionBook = { positions: {}, uniques: {}, generics: {} };

/** The wait lengths a follower can be given (Q8). */
export type WaitLength = "hour" | "thisDaypart" | "nextDaypart";

/** The places travel can reach from `from` through any path, Far links included. Holds `from`. */
export const connectedPlaces = (from: string, graph: PlaceGraph): Set<string> =>
  reachableFrom([from], graph.locations, graph.connections);

/** The places a Start's rows may use: every place at `PLAYER_START`, else those connected to its place (Q149). */
export const startReach = (place: string, graph: PlaceGraph): Set<string> =>
  (place === PLAYER_START ? new Set(graph.locations.map((l) => l.id)) : connectedPlaces(place, graph));

/** A Patrol stop that survived the connected filter, with its index in the authored list. */
interface LiveStop extends PatrolStop {
  index: number;
}

/** A row as it plays: unconnected places dropped, and a row with none left staying at the Start's place. */
type LiveAction =
  | { kind: "stay"; place: string }
  | { kind: "wander"; places: WanderPlace[]; idle: number }
  | { kind: "patrol"; stops: LiveStop[] }
  | { kind: "away" };

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
  if (a.kind === "away") return { ...base, action: a };
  if (a.kind === "stay") return { ...base, action: connected.has(a.place) ? a : atStart };
  if (a.kind === "wander") {
    const places = a.places.filter((p) => connected.has(p.place));
    return { ...base, action: places.length ? { kind: "wander", places, idle: a.idle } : atStart };
  }
  const stops = a.stops.map((s, index) => ({ ...s, index })).filter((s) => connected.has(s.place));
  return { ...base, action: stops.length ? { kind: "patrol", stops } : atStart };
}

/** The places a schedule action uses, in order. */
export function placesOf(action: ScheduleAction | LiveAction): string[] {
  if (action.kind === "away") return [];
  return action.kind === "stay" ? [action.place] : action.kind === "wander" ? action.places.map((p) => p.place) : action.stops.map((s) => s.place);
}

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

/** When `hold` lets go; never for a hold that waits on a script move. */
const releaseOf = (hold: PositionHold): number => ("until" in hold ? hold.until : Infinity);

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

/** One Unique entity's position and state while the engine works on it. */
interface Body {
  pos: string | undefined;
  st: UniqueState;
}

/** The row starts at `t`. Patrol begins at stop 1; Wander keeps a place of its own or picks one. */
function enterRow(body: Body, row: LiveRow, t: number, random: () => number): void {
  const { action } = row;
  body.st = { ...body.st, rowId: row.rowId, idleEnd: undefined, stop: undefined };
  if (action.kind === "away") body.pos = undefined;
  else if (action.kind === "stay") body.pos = action.place;
  else if (action.kind === "wander") {
    if (!body.pos || !placesOf(action).includes(body.pos)) body.pos = pickWander(action.places, body.pos, random);
    body.st.idleEnd = t + idleOf(action.idle);
  } else {
    const first = action.stops[0];
    body.pos = first.place;
    body.st = { ...body.st, stop: first.index, idleEnd: t + idleOf(first.idle) };
  }
}

/** The row's next move at `t`: back to the Stay place, a new Wander pick, the next Patrol stop, or off to no place. */
function stepRow(body: Body, { action }: LiveRow, t: number, random: () => number): void {
  if (action.kind === "away") {
    body.pos = undefined;
    body.st = { ...body.st, idleEnd: undefined };
  } else if (action.kind === "stay") {
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

/** `start` with `PLAYER_START` resolved, and Begins Following kept only there. Undefined while the start is unknown. */
function resolveStart(start: EntityStart, scene: PositionScene): EntityStart | undefined {
  if (start.place === PLAYER_START) return scene.playerStart === undefined ? undefined : { ...start, place: scene.playerStart };
  if (!start.beginsFollowing) return start;
  const { beginsFollowing: _off, ...rest } = start;
  return rest;
}

/** `course` with every Start placed for `scene`. A Start at an unknown player start is left out. */
const resolveCourse = (course: Course, scene: PositionScene): Course =>
  ({ ...course, routines: course.routines.map((r) => ({ ...r, starts: r.starts.flatMap((s) => resolveStart(s, scene) ?? []) })) });

function rollStart(starts: readonly EntityStart[], random: () => number): EntityStart | undefined {
  return starts.length ? weighted(starts, (s) => s.weight, random) : undefined;
}

/** The places `routine` may be pulled or led into on `start` at `now`: its row's places plus Traversable. An Away
 *  row leads a follower anywhere its Start connects to (Q29). */
function allowedOn(routine: PlayedRoutine, start: EntityStart, now: number, graph: PlaceGraph, connected: ReadonlySet<string>): Set<string> {
  if (routine.traversable === "anywhere") return new Set(graph.locations.map((l) => l.id));
  const { action } = liveRow(start, rowAt(start, now), connected);
  return new Set([...(action.kind === "away" ? connected : placesOf(action)), ...routine.traversable]);
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

/** Each Routine's kept roll in `st`, by Routine id: the played Routine's Start and the others' rolls. A roll whose
 *  Routine or Start is gone is left out. */
function keptRolls(course: Course, st: UniqueState | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!st) return out;
  const played = routineIdOf(course, st);
  for (const routine of course.routines) {
    const id = routine.id === played ? st.startId : st.rolls?.[routine.id];
    if (id !== undefined && routine.starts.some((s) => s.id === id)) out[routine.id] = id;
  }
  return out;
}

/** Which Routine `course` plays from `rolls`: the applying one, else the one `saved` played, else the first rolled. A
 *  Routine with no roll has no Starts and never applies (Q19). */
function routineToPlay(course: Course, saved: UniqueState | undefined, rolls: Readonly<Record<string, string>>) {
  const applying = course.applying !== null && rolls[course.applying] !== undefined ? course.applying : null;
  const played = applying ?? [routineIdOf(course, saved), ...course.routines.map((r) => r.id)].find((id) => id !== undefined && rolls[id] !== undefined);
  return { applying, played };
}

/** The follow a swap keeps, or undefined when it parts ways as if dismissed: a follower whose new `reach` misses the
 *  player's place, or a wait at a place outside it. A script follow, and a follower while no Routine holds, keep on
 *  (Q4, Q13, Q31). */
function followAfterSwap(
  follow: FollowState, nowhere: boolean, at: string | undefined, scene: PositionScene, reach: ReadonlySet<string>,
): FollowState | undefined {
  if (follow.script) return follow;
  if (follow.mode === "following") return nowhere || scene.playerAt === undefined || reach.has(scene.playerAt) ? follow : undefined;
  return at !== undefined && reach.has(at) ? follow : undefined;
}

function advanceOne(
  course: Course, saved: UniqueState | undefined, savedPos: string | undefined,
  scene: PositionScene, random: () => number, connected: ConnectedCache,
): Body | undefined {
  const { now, playerAt } = scene;
  const rolls = keptRolls(course, saved);
  const kept = !!saved && rolls[routineIdOf(course, saved) ?? ""] === saved.startId;
  // Every Routine rolls once per playthrough and keeps its roll (Q4, Q33); a lost Start rolls again (Q87).
  for (const r of course.routines) {
    const rolled = r.id in rolls ? undefined : rollStart(r.starts, random);
    if (rolled) rolls[r.id] = rolled.id;
  }
  const { applying, played } = routineToPlay(course, saved, rolls);
  if (played === undefined) return undefined;
  const leg = playedRoutineFrom(course, course.routines.find((r) => r.id === played));
  const routine = applying === null ? awayAllDay(leg) : leg;
  const start = routine.starts.find((s) => s.id === rolls[played]);
  if (!start) return undefined;
  const fresh = !kept;
  const others = Object.fromEntries(Object.entries(rolls).filter(([id]) => id !== played));
  const ledger: Pick<UniqueState, "routineId" | "rolls" | "nowhere"> = {
    routineId: course.routines.length > 1 ? played : undefined,
    rolls: Object.keys(others).length ? others : undefined,
    nowhere: applying === null ? true : undefined,
  };
  let body: Body = { pos: savedPos ?? start.place, st: { startId: start.id, lastRun: now, ...ledger } };
  if (kept && saved) {
    // A swap takes the new Routine's kept Start with no row, hold, idle or stop (Q4, Q11).
    const swapped = (saved.nowhere ? null : routineIdOf(course, saved)) !== applying;
    const follow = swapped && saved.follow && followAfterSwap(saved.follow, applying === null, savedPos, scene, allowedOn(routine, start, now, scene, connected(start.place)));
    body = swapped
      ? { pos: savedPos, st: { ...body.st, ...(follow && { follow }) } }
      : { pos: savedPos, st: { ...saved, ...ledger } };
  }
  // Begins Following skips the Strict check only, so Traversable still applies (Q148). Only an applying Routine's.
  if (fresh && applying !== null && start.beginsFollowing) {
    body.pos = playerAt ?? start.place;
    body.st = { ...body.st, follow: { mode: "following" } };
  }
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
    const release = releaseOf(hold);
    if (release > now) return pause();
    cursor = Math.max(cursor, release);
    body.st = { ...body.st, hold: undefined };
  }

  replay(body, start, reach, cursor, scene, random);
  return pause();
}

/** Every row edge and idle of `start` replayed in clock order from `cursor` up to now (Q83). */
function replay(body: Body, start: EntityStart, reach: ReadonlySet<string>, cursor: number, scene: PositionScene, random: () => number): void {
  const live = (t: number) => liveRow(start, rowAt(start, t), reach);
  const first = live(cursor);
  if (first.rowId !== body.st.rowId) enterRow(body, first, cursor, random);
  else if (!body.pos || !placesOf(first.action).includes(body.pos)) stepRow(body, first, cursor, random);
  while (body.pos === undefined || body.pos !== scene.playerAt) {
    const t = Math.max(cursor, Math.min(nextBoundary(start, cursor), body.st.idleEnd ?? Infinity));
    if (!(t <= scene.now)) break;
    cursor = t;
    const row = live(t);
    if (row.rowId !== body.st.rowId) enterRow(body, row, t, random);
    else if (body.st.idleEnd !== undefined && body.st.idleEnd <= t) stepRow(body, row, t, random);
  }
}

/** One Generic Entity Instance placed for now: a new one begins at its Start's place, and one at the player's place
 *  stays until the player leaves. */
function advanceGenericEntityInstance(
  start: EntityStart, saved: GenericEntityInstanceState | undefined, scene: PositionScene, random: () => number, connected: ConnectedCache,
): GenericEntityInstanceState {
  const { now, playerAt } = scene;
  const body: Body = saved
    ? { pos: saved.position, st: { startId: start.id, rowId: saved.rowId, lastRun: saved.lastRun, idleEnd: saved.idleEnd, stop: saved.stop } }
    : { pos: start.place, st: { startId: start.id, lastRun: now } };
  if (!(saved && playerAt !== undefined && body.pos === playerAt)) {
    replay(body, start, connected(start.place), Math.min(body.st.lastRun, now), scene, random);
  }
  const { rowId, idleEnd, stop } = body.st;
  return tidy({ position: body.pos, rowId, lastRun: now, idleEnd, stop });
}

/** Every Generic Entity Instance of `routine`, one per Start. A record whose Start is gone is dropped, so an off
 *  Routine's instances leave and come back fresh (Q5, Q11). */
function advanceGeneric(
  routine: PlayedRoutine, saved: Readonly<Record<string, GenericEntityInstanceState>> | undefined, scene: PositionScene, random: () => number,
  connected: ConnectedCache,
): Record<string, GenericEntityInstanceState> {
  return Object.fromEntries(routine.starts.map((start) => [start.id, advanceGenericEntityInstance(start, saved?.[start.id], scene, random, connected)]));
}

/** Strips undefined fields, so a saved state carries only what it holds. */
function tidy<T extends object>(st: T): T {
  const out = { ...st };
  for (const key of Object.keys(out) as (keyof T)[]) if (out[key] === undefined) delete out[key];
  return out;
}

/**
 * Every course in `courses` placed for `scene.now`. A Unique entity: each Routine's Start rolled on first sight, a
 * swap to the applying Routine's kept roll, the schedule replayed since the last run, followers led to the player or
 * left waiting, holds and waits released. A Generic entity: each Start of the applying Routine's Generic Entity
 * Instance replayed the same way. Characters outside `courses` keep their positions.
 */
export function advancePositions(
  courses: readonly Course[], book: PositionBook, scene: PositionScene, random: () => number,
): PositionBook {
  const positions = { ...book.positions };
  const uniques = { ...book.uniques };
  const generics = { ...book.generics };
  const connected = connectedCache(scene);
  for (const authored of courses) {
    const course = resolveCourse(authored, scene);
    const { id } = course;
    if (course.generic) {
      const leg = playedRoutineFrom(course, course.routines.find((r) => r.id === course.applying));
      const entityInstances = advanceGeneric(leg, book.generics[id], scene, random, connected);
      if (Object.keys(entityInstances).length) generics[id] = entityInstances;
      else delete generics[id];
      continue;
    }
    const body = advanceOne(course, book.uniques[id], book.positions[id], scene, random, connected);
    if (!body) {
      delete uniques[id];
      delete positions[id];
      continue;
    }
    if (body.pos === undefined) delete positions[id];
    else positions[id] = body.pos;
    uniques[id] = tidy(body.st);
  }
  return { positions, uniques, generics };
}

/** The places each Generic entity's Generic Entity Instances stand at, deduped, by Generic entity id. */
export function genericPlaces(generics: Readonly<GenericStates>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(generics).map(([id, entityInstances]) =>
    [id, [...new Set(Object.values(entityInstances).flatMap((p) => p.position ?? []))]]));
}

/** The saved Start `st` plays on `course`, as authored, with its leg, if it still has it. */
function savedStart(course: Course, st: UniqueState | undefined): { leg: PlayedRoutine; start: EntityStart } | undefined {
  const leg = playedRoutineOf(course, st);
  const start = st && leg.starts.find((s) => s.id === st.startId);
  return start && { leg, start };
}

/** The saved Start `st` plays on `course`, resolved for `scene`, with its leg, if it still has it. */
function startOf(course: Course, st: UniqueState | undefined, scene: PositionScene): { leg: PlayedRoutine; start: EntityStart } | undefined {
  const saved = savedStart(course, st);
  const start = saved && resolveStart(saved.start, scene);
  return start && { leg: saved.leg, start };
}

/** The places `course` may be pulled or led into right now: its current row's places (the Start's place in free
 *  time) plus its Traversable places. Every place for Anywhere. */
export function allowedPlaces(course: Course, st: UniqueState | undefined, scene: PositionScene): Set<string> {
  const saved = startOf(course, st, scene);
  if (!saved) return new Set();
  return allowedOn(saved.leg, saved.start, scene.now, scene, connectedPlaces(saved.start.place, scene));
}

/** The places the row in force for `course` uses right now, unconnected ones dropped: the Start's place in free
 *  time. Empty without a saved Start. */
export function rowPlacesNow(course: Course, st: UniqueState | undefined, scene: PositionScene): string[] {
  const start = startOf(course, st, scene)?.start;
  if (!start) return [];
  return placesOf(liveRow(start, rowAt(start, scene.now), connectedPlaces(start.place, scene)).action);
}

/** What the row in force for `course` does now; '' in a gap, and for a row with no connected place left (Q84). */
export function actionNow(course: Course, st: UniqueState | undefined, scene: PositionScene): ScheduleAction["kind"] | "" {
  const start = startOf(course, st, scene)?.start;
  const row = start && rowAt(start, scene.now);
  if (!start || !row) return "";
  if (row.action.kind === "away") return "away";
  const connected = connectedPlaces(start.place, scene);
  return placesOf(row.action).some((place) => connected.has(place)) ? row.action.kind : "";
}

/** Whether a pull or a script move holds `st` off its schedule at `now`. */
export const isHeldNow = (st: UniqueState | undefined, now: number): boolean => !!st?.hold && releaseOf(st.hold) > now;

/** Whether the row in force for `course` right now is Strict. */
export function isStrictNow(course: Course, st: UniqueState | undefined, now: number): boolean {
  const start = savedStart(course, st)?.start;
  return !!start && !!rowAt(start, now)?.strict;
}

/** Whether the row in force for `course` right now is Away. */
export function isAwayNow(course: Course, st: UniqueState | undefined, now: number): boolean {
  const start = savedStart(course, st)?.start;
  return !!start && rowAt(start, now)?.action.kind === "away";
}

/** Narration can neither call `course` over nor start its follow: on a Strict or an Away row (Q22). */
export const isKeptOffNow = (course: Course, st: UniqueState | undefined, now: number): boolean =>
  isStrictNow(course, st, now) || isAwayNow(course, st, now);

/** The row id `awayAllDay` gives its one row. */
export const AWAY_ROW_ID = "@away";

/** `routine` Away all day on every Start, its rolls kept: the entity while no Routine holds (Q24). */
const awayAllDay = (routine: PlayedRoutine): PlayedRoutine => ({
  ...routine,
  starts: routine.starts.map((start) => ({ ...start, schedule: [{ id: AWAY_ROW_ID, time: "allDay", action: { kind: "away" } }] })),
});

const withState = (book: PositionBook, id: string, st: UniqueState, pos?: string): PositionBook => ({
  ...book,
  positions: pos === undefined ? book.positions : { ...book.positions, [id]: pos },
  uniques: { ...book.uniques, [id]: tidy(st) },
});

/** The hold for a move off the schedule now, and the idle it runs on. Wander and Patrol hold until the current
 *  idle runs out, or a fresh one when it already has (Q92). */
function holdFor(
  course: Course, st: UniqueState, scene: PositionScene, onStay: (start: EntityStart) => PositionHold | undefined,
): { hold?: PositionHold; idleEnd?: number } | undefined {
  const start = startOf(course, st, scene)?.start;
  if (!start) return undefined;
  const { action } = liveRow(start, rowAt(start, scene.now), connectedPlaces(start.place, scene));
  if (action.kind === "stay" || action.kind === "away") return { hold: onStay(start) };
  const idle = action.kind === "wander" ? action.idle : (action.stops.find((s) => s.index === st.stop) ?? action.stops[0]).idle;
  const idleEnd = st.idleEnd !== undefined && st.idleEnd > scene.now ? st.idleEnd : scene.now + idleOf(idle);
  return { hold: { until: idleEnd }, idleEnd };
}

/** A narration pull brings `course` to `to`. Refused for a follower, a waiting character, a Strict row and a
 *  place not allowed (Q26, Q36). On a Stay row it needs no hold: nobody moves at the player location, so it
 *  goes back once the player leaves (Q40). */
export function pullUnique(book: PositionBook, course: Course, to: string, scene: PositionScene): PositionBook {
  const st = book.uniques[course.id];
  if (!st || st.follow || isKeptOffNow(course, st, scene.now) || !allowedPlaces(course, st, scene).has(to)) return book;
  const held = holdFor(course, st, scene, () => undefined);
  if (!held) return book;
  return withState(book, course.id, { ...st, hold: held.hold, idleEnd: held.idleEnd ?? st.idleEnd }, to);
}

/** A script moved `course` to `to`. It holds until the current idle runs out, or on a Stay row until that
 *  stretch of the day ends (Q53, Q90). It ends a wait. */
export function moveUniqueByScript(book: PositionBook, course: Course, to: string, scene: PositionScene): PositionBook {
  const st = book.uniques[course.id];
  const held = st && holdFor(course, st, scene, (start) => {
    const end = stretchEnd(start, scene.now);
    return end === undefined ? { untilScriptMove: true } : { until: end };
  });
  if (!held) return book;
  const follow = st.follow?.mode === "waiting" ? undefined : st.follow;
  return withState(book, course.id, { ...st, follow, hold: held.hold, idleEnd: held.idleEnd ?? st.idleEnd }, to);
}

/** `course` starts following the player. Refused on a Strict or an Away row unless a script asks (Q22, Q36, Q64). */
export function startFollowing(
  book: PositionBook, course: Course, scene: PositionScene, options: { script?: boolean } = {},
): PositionBook {
  const st = book.uniques[course.id];
  if (!st || st.follow?.mode === "following") return book;
  if (!options.script && isKeptOffNow(course, st, scene.now)) return book;
  return withState(book, course.id, { ...st, hold: undefined, follow: { mode: "following", ...(options.script ? { script: true } : {}) } });
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
  const st = book.uniques[id];
  if (!st?.follow) return book;
  const script = st.follow.script ? { script: true } : {};
  return withState(book, id, { ...st, follow: { mode: "waiting", until: waitUntil(length, now), ...script } });
}

/** Part ways: a follower or waiting character goes back to its schedule. */
export function partWays(book: PositionBook, id: string): PositionBook {
  const st = book.uniques[id];
  return st?.follow ? withState(book, id, { ...st, follow: undefined }) : book;
}

/** A runtime character as a Unique entity: one Routine with one Start at its discovery place, an empty schedule, Anywhere (Q56). */
export function runtimeCourse(discovered: DiscoveredEntity): Course | undefined {
  if (!discovered.locationId) return undefined;
  return oneRoutineCourse({
    id: discovered.entity.id,
    starts: [{ id: "discovered", place: discovered.locationId, weight: 1, schedule: [] }],
    traversable: "anywhere",
  });
}
