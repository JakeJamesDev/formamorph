import { describe, expect, it } from 'vitest';
import { PLAYER_START, type Connection, type DiscoveredEntity, type ScheduleAction, type ScheduleRow, type Traversable } from '@/types';
import {
  actionNow, advancePositions, allowedPlaces, connectedPlaces, genericPlaces, isStrictNow, moveUniqueByScript, partWays, pullUnique,
  runtimeCourse, startFollowing, startWaiting, waitUntil, oneRoutineCourse, type Course, type PositionBook, type PositionScene,
} from './positionEngine';

// A village of sibling places, a ridge one Far Connection away, and an island nothing reaches.
const locations = [
  { id: 'village', parentId: null },
  ...['smithy', 'inn', 'market', 'square', 'wall', 'gate'].map((id) => ({ id, parentId: 'village' })),
  { id: 'ridge', parentId: null },
  { id: 'island', parentId: null },
];
const farRoad: Connection & { distance: 'far' } = { id: 'road', a: 'village', b: 'ridge', aToB: {}, bToA: {}, distance: 'far' };
const connections: Connection[] = [farRoad];

/** Story minute of `hh:mm` on `day`. */
const at = (day: number, hh: number, mm = 0) => (day - 1) * 1440 + hh * 60 + mm;

/** A seeded random source (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const stay = (place: string): ScheduleAction => ({ kind: 'stay', place });
const wander = (places: string[], idle: number, weights: number[] = []): ScheduleAction =>
  ({ kind: 'wander', places: places.map((place, i) => ({ place, weight: weights[i] ?? 1 })), idle });
const patrol = (stops: [string, number][]): ScheduleAction => ({ kind: 'patrol', stops: stops.map(([place, idle]) => ({ place, idle })) });
const allDay = (id: string, action: ScheduleAction, strict = false): ScheduleRow => ({ id, time: 'allDay', action, ...(strict ? { strict } : {}) });
const timed = (id: string, from: number, to: number, action: ScheduleAction, strict = false): ScheduleRow =>
  ({ id, time: { start: from * 60, end: to * 60 }, action, ...(strict ? { strict } : {}) });

type Routine = Course;
/** A Course of one always-applying Routine. */
const one = oneRoutineCourse;

const routine = (schedule: ScheduleRow[], place = 'inn', traversable: Traversable = []): Routine =>
  one({ id: 'mara', starts: [{ id: 's1', place, weight: 1, schedule }], traversable });

const EMPTY: PositionBook = { positions: {}, uniques: {}, generics: {} };
const scene = (now: number, playerAt?: string): PositionScene => ({ locations, connections, now, playerAt });

/** Drives one character through engine calls; `pos` reads where it stands. */
function play(r: Routine, now: number, playerAt?: string, random = seeded(7)) {
  let book = advancePositions([r], EMPTY, scene(now, playerAt), random);
  const game = {
    get book() { return book; },
    get pos() { return book.positions[r.id]; },
    get state() { return book.uniques[r.id]; },
    advance(t: number, player?: string) {
      book = advancePositions([r], book, scene(t, player), random);
      return game;
    },
    apply(f: (b: PositionBook) => PositionBook) {
      book = f(book);
      return game;
    },
  };
  return game;
}

describe('the Start roll', () => {
  const twoStarts = one({
    id: 'mara',
    starts: [
      { id: 'forge', place: 'smithy', weight: 3, schedule: [] },
      { id: 'tavern', place: 'inn', weight: 1, schedule: [] },
    ],
    traversable: [],
  });

  it('weights the pick', () => {
    let forge = 0;
    for (let seed = 1; seed <= 400; seed++) {
      if (advancePositions([twoStarts], EMPTY, scene(at(1, 8)), seeded(seed)).uniques.mara.startId === 'forge') forge++;
    }
    expect(forge).toBeGreaterThan(260);
    expect(forge).toBeLessThan(340);
  });

  it('gives the same result for the same seed', () => {
    const run = () => advancePositions([twoStarts], EMPTY, scene(at(1, 8)), seeded(42));
    expect(run()).toEqual(run());
  });

  it('happens once per playthrough', () => {
    const first = advancePositions([twoStarts], EMPTY, scene(at(1, 8)), () => 0);
    expect(first.positions.mara).toBe('smithy');
    const later = advancePositions([twoStarts], first, scene(at(3, 8)), () => 0.99);
    expect(later.uniques.mara.startId).toBe('forge');
    expect(later.positions.mara).toBe('smithy');
  });

  it('rolls again for a Start the world no longer has', () => {
    const first = advancePositions([twoStarts], EMPTY, scene(at(1, 8)), () => 0);
    const edited = one({ id: 'mara', traversable: [], starts: [twoStarts.routines[0].starts[1]] });
    expect(advancePositions([edited], first, scene(at(1, 9)), () => 0).uniques.mara.startId).toBe('tavern');
  });
});

describe('row resolution', () => {
  const day = routine([allDay('rest', stay('inn')), timed('work', 8, 17, stay('smithy'))]);

  it('lets a timed row beat the All-day row for its hours', () => {
    expect(play(day, at(1, 10)).pos).toBe('smithy');
    expect(play(day, at(1, 20)).pos).toBe('inn');
  });

  it('keeps the character at its Start in hours no row covers', () => {
    const gappy = routine([timed('work', 8, 17, stay('smithy'))], 'square');
    expect(play(gappy, at(1, 20)).pos).toBe('square');
    expect(play(gappy, at(1, 10)).advance(at(1, 18)).pos).toBe('square');
  });

  it('reads a range that wraps midnight', () => {
    const nights = routine([allDay('day', stay('smithy')), timed('drink', 22, 4, stay('inn'))]);
    expect(play(nights, at(1, 23)).pos).toBe('inn');
    expect(play(nights, at(1, 2)).pos).toBe('inn');
    expect(play(nights, at(1, 5)).pos).toBe('smithy');
  });

  it('moves at the row edge while the player is elsewhere', () => {
    expect(play(day, at(1, 16), 'gate').advance(at(1, 17, 30), 'gate').pos).toBe('inn');
  });
});

describe('Wander', () => {
  it('stays at a place of its own on entry, then picks another when the idle runs out', () => {
    const r = routine([allDay('drift', wander(['inn', 'market'], 60))], 'inn');
    const game = play(r, at(1, 8));
    expect(game.pos).toBe('inn');
    expect(game.advance(at(1, 8, 59)).pos).toBe('inn');
    expect(game.advance(at(1, 9)).pos).toBe('market');
    expect(game.advance(at(1, 10)).pos).toBe('inn');
  });

  it('weights the picks', () => {
    const r = routine([allDay('drift', wander(['market', 'square', 'smithy'], 30, [1, 1, 18]))], 'market');
    const counts: Record<string, number> = {};
    for (let seed = 1; seed <= 300; seed++) {
      const pos = play(r, at(1, 8), undefined, seeded(seed)).advance(at(1, 8, 30)).pos;
      counts[pos] = (counts[pos] ?? 0) + 1;
    }
    expect(counts.market).toBeUndefined(); // never the current place when there is a choice
    expect(counts.smithy).toBeGreaterThan(240);
    expect(counts.square).toBeGreaterThan(0);
  });

  it('replays every idle that passed while the player was away', () => {
    const r = routine([allDay('drift', wander(['inn', 'market'], 60))], 'inn');
    expect(play(r, at(1, 8)).advance(at(1, 13), 'gate').pos).toBe('market'); // five picks, alternating
    expect(play(r, at(1, 8)).advance(at(1, 14), 'gate').pos).toBe('inn');
  });
});

describe('Patrol', () => {
  const guard = routine([allDay('round', patrol([['wall', 30], ['gate', 60], ['market', 30]]))], 'square', ['inn']);

  it('starts at stop 1, walks the stops in order and loops', () => {
    const game = play(guard, at(1, 8));
    expect(game.pos).toBe('wall');
    expect(game.advance(at(1, 8, 30)).pos).toBe('gate');
    expect(game.advance(at(1, 9, 29)).pos).toBe('gate');
    expect(game.advance(at(1, 9, 30)).pos).toBe('market');
    expect(game.advance(at(1, 10)).pos).toBe('wall');
  });

  it('catches up stop by stop across a long absence', () => {
    // 2 rounds of 120 minutes, then 30 more: gate.
    expect(play(guard, at(1, 8)).advance(at(1, 12, 30), 'inn').pos).toBe('gate');
  });

  it('starts again at stop 1 when its row comes back', () => {
    const shifts = routine([timed('round', 8, 12, patrol([['wall', 30], ['gate', 60], ['market', 60]])), allDay('off', stay('inn'))], 'inn');
    const game = play(shifts, at(1, 8, 30), 'square');
    expect(game.pos).toBe('wall');
    expect(game.advance(at(1, 11, 45), 'square').pos).toBe('gate'); // the shift ends mid-round
    expect(game.advance(at(1, 13), 'square').pos).toBe('inn');
    expect(game.advance(at(2, 8), 'square').pos).toBe('wall');
  });

  it('resumes at the stop after the last one reached when a pull ends', () => {
    const game = play(guard, at(1, 8), 'inn').advance(at(1, 8, 40), 'inn');
    expect(game.pos).toBe('gate');
    game.apply((b) => pullUnique(b, guard, 'inn', scene(at(1, 8, 45), 'inn')));
    expect(game.advance(at(1, 9, 20), 'square').pos).toBe('inn'); // held for the gate's idle
    expect(game.advance(at(1, 9, 31), 'square').pos).toBe('market');
  });
});

describe('with the player', () => {
  const drifter = routine([allDay('drift', wander(['inn', 'market'], 60))], 'inn');

  it('moves nobody at the player location until the player leaves', () => {
    const game = play(drifter, at(1, 8), 'inn');
    expect(game.advance(at(1, 13), 'inn').pos).toBe('inn');
    expect(game.advance(at(1, 13, 5), 'gate').pos).toBe('market'); // the overdue idle fires once the player has gone
  });

  it('still places a new character by its routine at the player location', () => {
    const r = routine([allDay('work', stay('smithy'))], 'inn');
    expect(play(r, at(1, 8), 'inn').pos).toBe('smithy');
  });

  it('keeps a row change from pulling someone out of the scene', () => {
    const r = routine([allDay('rest', stay('inn')), timed('work', 8, 17, stay('smithy'))]);
    const game = play(r, at(1, 16), 'smithy');
    expect(game.advance(at(1, 18), 'smithy').pos).toBe('smithy');
    expect(game.advance(at(1, 19), 'gate').pos).toBe('inn');
  });

  it('stops replaying once a move lands at the player location', () => {
    const r = routine([allDay('drift', wander(['inn', 'market'], 60))], 'inn');
    expect(play(r, at(1, 8), 'gate').advance(at(1, 14), 'market').pos).toBe('market'); // reached at 9:00, then stayed
  });
});

describe('off-row correction and holds', () => {
  const smith = routine([allDay('rest', stay('inn')), timed('work', 8, 17, stay('smithy'))], 'inn', ['inn']);

  it('sends a character outside its row places to where the action puts it', () => {
    const game = play(smith, at(1, 9));
    game.apply((b) => ({ ...b, positions: { mara: 'gate' } }));
    expect(game.advance(at(1, 9, 1)).pos).toBe('smithy');
  });

  it('holds a pulled Stay character until the player leaves', () => {
    const game = play(smith, at(1, 9), 'inn').apply((b) => pullUnique(b, smith, 'inn', scene(at(1, 9), 'inn')));
    expect(game.advance(at(1, 12), 'inn').pos).toBe('inn');
    expect(game.advance(at(1, 13), 'gate').pos).toBe('smithy');
  });

  it('holds a pulled Wander character until its idle runs out, even after the player leaves', () => {
    const r = routine([allDay('drift', wander(['market', 'square'], 60))], 'market', ['inn']);
    const game = play(r, at(1, 8), 'inn').apply((b) => pullUnique(b, r, 'inn', scene(at(1, 8, 30), 'inn')));
    expect(game.advance(at(1, 8, 40), 'gate').pos).toBe('inn');
    expect(['market', 'square']).toContain(game.advance(at(1, 9), 'gate').pos);
  });

  it('refuses a pull into a place not allowed, on a Strict row, or of a follower', () => {
    const pull = (r: Routine, b: PositionBook, t: number) => pullUnique(b, r, 'inn', scene(t, 'inn'));
    const bound = routine([allDay('rest', stay('square')), timed('work', 8, 17, stay('smithy'))], 'square', []);
    const strict = routine([allDay('rest', stay('square')), timed('shift', 8, 17, stay('smithy'), true)], 'square', ['inn']);
    const free = routine([allDay('rest', stay('square'))], 'square', ['inn']);
    const boundBook = play(bound, at(1, 9)).book;
    expect(pull(bound, boundBook, at(1, 9))).toBe(boundBook);
    const strictBook = play(strict, at(1, 9)).book;
    expect(pull(strict, strictBook, at(1, 9))).toBe(strictBook);
    expect(pull(strict, strictBook, at(1, 18)).positions.mara).toBe('inn');
    const following = startFollowing(play(free, at(1, 9), 'square').book, free, scene(at(1, 9), 'square'));
    expect(pull(free, following, at(1, 9))).toBe(following);
  });

  it('gives a pull a fresh idle when the current one already ran out', () => {
    const r = routine([allDay('drift', wander(['market', 'square'], 60))], 'market', ['inn']);
    const game = play(r, at(1, 8), 'market').advance(at(1, 11), 'market');
    game.apply((b) => pullUnique(b, r, 'inn', scene(at(1, 11), 'inn')));
    expect(game.advance(at(1, 11, 30), 'gate').pos).toBe('inn');
    expect(game.advance(at(1, 12), 'gate').pos).not.toBe('inn');
  });

  it('holds a script move on a Stay row until that stretch of the day ends', () => {
    const game = play(smith, at(1, 10)).apply((b) => moveUniqueByScript(b, smith, 'gate', scene(at(1, 10))));
    expect(game.advance(at(1, 16, 59)).pos).toBe('gate');
    expect(game.advance(at(1, 17, 30)).pos).toBe('inn');
  });

  it('holds a script move in All-day time until the next timed row starts', () => {
    const game = play(smith, at(1, 20)).apply((b) => moveUniqueByScript(b, smith, 'gate', scene(at(1, 20))));
    expect(game.advance(at(2, 7, 59)).pos).toBe('gate');
    expect(game.advance(at(2, 8)).pos).toBe('smithy');
  });

  it('holds a script move of a character with no rows until a script moves it again', () => {
    const still = routine([], 'inn');
    const game = play(still, at(1, 10)).apply((b) => moveUniqueByScript(b, still, 'gate', scene(at(1, 10))));
    expect(game.advance(at(9, 10)).pos).toBe('gate');
    game.apply((b) => moveUniqueByScript(b, still, 'square', scene(at(9, 10))));
    expect(game.advance(at(12, 10)).pos).toBe('square');
  });

  it('holds a script move on a Wander row until the idle runs out', () => {
    const r = routine([allDay('drift', wander(['market', 'square'], 60))], 'market');
    const game = play(r, at(1, 8)).apply((b) => moveUniqueByScript(b, r, 'gate', scene(at(1, 8, 20))));
    expect(game.advance(at(1, 8, 59)).pos).toBe('gate');
    expect(game.advance(at(1, 9)).pos).not.toBe('gate');
  });
});

describe('following and waiting', () => {
  const smith = routine([allDay('rest', stay('inn')), timed('work', 8, 17, stay('smithy'))], 'inn', 'anywhere');
  const follow = (r: Routine, t: number, player: string, options = {}) => (b: PositionBook) => startFollowing(b, r, scene(t, player), options);

  it('leads a follower to every place the player goes, past its usual hours', () => {
    const game = play(smith, at(1, 9), 'smithy').apply(follow(smith, at(1, 9), 'smithy'));
    expect(game.advance(at(1, 10), 'gate').pos).toBe('gate');
    expect(game.advance(at(1, 20), 'ridge').pos).toBe('ridge');
  });

  it('caps a wait at the end of the next daypart', () => {
    const morning = at(1, 10); // morning runs to 11:00, midday to 13:00
    expect(waitUntil({ until: at(5, 0) }, morning)).toBe(at(1, 13));
    expect(waitUntil('hour', morning)).toBe(at(1, 11));
    expect(waitUntil('thisDaypart', morning)).toBe(at(1, 11));
    expect(waitUntil('nextDaypart', morning)).toBe(at(1, 13));
  });

  it('waits where it was left, then goes back to its schedule when the wait runs out', () => {
    const game = play(smith, at(1, 9), 'square').apply(follow(smith, at(1, 9), 'square')).advance(at(1, 9), 'square');
    game.apply((b) => startWaiting(b, 'mara', 'hour', at(1, 9)));
    expect(game.advance(at(1, 9, 30), 'gate').pos).toBe('square');
    expect(game.state.follow?.mode).toBe('waiting');
    expect(game.advance(at(1, 10, 1), 'gate').pos).toBe('smithy');
    expect(game.state.follow).toBeUndefined();
  });

  it('goes back to its schedule on Part ways once the player leaves', () => {
    const game = play(smith, at(1, 9), 'square').apply(follow(smith, at(1, 9), 'square')).advance(at(1, 9, 10), 'square');
    game.apply((b) => partWays(b, 'mara'));
    expect(game.advance(at(1, 9, 20), 'square').pos).toBe('square');
    expect(game.advance(at(1, 9, 30), 'gate').pos).toBe('smithy');
  });

  it('leaves a follower behind, waiting until the end of this daypart, at a place it may not enter', () => {
    const bound = routine([allDay('work', stay('smithy'))], 'smithy', ['square']);
    const game = play(bound, at(1, 9), 'smithy').apply(follow(bound, at(1, 9), 'smithy'));
    expect(game.advance(at(1, 9, 10), 'square').pos).toBe('square');
    expect(game.advance(at(1, 9, 20), 'gate').pos).toBe('square');
    expect(game.state.follow).toEqual({ mode: 'waiting', until: at(1, 11) });
    expect(game.advance(at(1, 11), 'gate').pos).toBe('smithy');
  });

  it('never leaves a script follower behind', () => {
    const bound = routine([allDay('work', stay('smithy'))], 'smithy', []);
    const game = play(bound, at(1, 9), 'smithy').apply(follow(bound, at(1, 9), 'smithy', { script: true }));
    expect(game.advance(at(1, 9, 10), 'island').pos).toBe('island');
  });

  it('reads a locked All-day row as Strict only in the hours no timed row covers', () => {
    const baker = routine([allDay('rest', stay('inn'), true), timed('shift', 8, 17, stay('market'))], 'inn', 'anywhere');
    const game = play(baker, at(1, 9), 'market');
    expect(isStrictNow(baker, game.state, at(1, 9))).toBe(false);
    expect(isStrictNow(baker, game.state, at(1, 18))).toBe(true);
    expect(startFollowing(game.book, baker, scene(at(1, 18), 'inn'))).toBe(game.book);
  });

  it('refuses a new follow on a Strict row unless a script asks', () => {
    const clerk = routine([allDay('rest', stay('inn')), timed('shift', 8, 17, stay('market'), true)], 'inn', 'anywhere');
    const game = play(clerk, at(1, 9), 'market');
    expect(isStrictNow(clerk, game.state, at(1, 9))).toBe(true);
    expect(startFollowing(game.book, clerk, scene(at(1, 9), 'market'))).toBe(game.book);
    expect(startFollowing(game.book, clerk, scene(at(1, 9), 'market'), { script: true }).uniques.mara.follow)
      .toEqual({ mode: 'following', script: true });
    expect(startFollowing(game.book, clerk, scene(at(1, 18), 'inn')).uniques.mara.follow).toEqual({ mode: 'following' });
  });

  it('keeps a running follow going into a Strict row', () => {
    const clerk = routine([allDay('rest', stay('inn')), timed('shift', 8, 17, stay('market'), true)], 'inn', 'anywhere');
    const game = play(clerk, at(1, 7), 'inn').apply(follow(clerk, at(1, 7), 'inn'));
    expect(game.advance(at(1, 9), 'gate').pos).toBe('gate');
  });

  it('ends a wait on a script move', () => {
    const game = play(smith, at(1, 9), 'square').apply(follow(smith, at(1, 9), 'square'));
    game.apply((b) => startWaiting(b, 'mara', 'nextDaypart', at(1, 9)));
    game.apply((b) => moveUniqueByScript(b, smith, 'gate', scene(at(1, 9, 5), 'square')));
    expect(game.state.follow).toBeUndefined();
    expect(game.advance(at(1, 9, 30), 'square').pos).toBe('gate');
  });
});

describe('reach', () => {
  it('connects through a Far link, never to a place no path reaches', () => {
    const reach = connectedPlaces('smithy', { locations, connections });
    expect(reach.has('ridge')).toBe(true);
    expect(reach.has('island')).toBe(false);
  });

  it('skips a listed place that is not connected', () => {
    const r = routine([allDay('drift', wander(['market', 'island'], 30))], 'market');
    const seen = new Set<string>();
    const game = play(r, at(1, 8));
    for (let m = 30; m <= 600; m += 30) seen.add(game.advance(at(1, 8) + m).pos);
    expect(seen).toEqual(new Set(['market']));
    expect(play(routine([allDay('trip', stay('island'))], 'inn'), at(1, 8)).pos).toBe('inn');
    expect(play(routine([allDay('round', patrol([['island', 30], ['gate', 30]]))], 'inn'), at(1, 8)).pos).toBe('gate');
  });

  it('allows every place for Anywhere and only the row places for an empty list', () => {
    const anywhere = routine([allDay('rest', stay('inn'))], 'inn', 'anywhere');
    const listed = routine([timed('work', 8, 17, wander(['market', 'square'], 60))], 'inn', []);
    const extra = routine([allDay('rest', stay('inn'))], 'inn', ['gate']);
    const now = at(1, 9);
    expect(allowedPlaces(anywhere, play(anywhere, now).state, scene(now))).toEqual(new Set(locations.map((l) => l.id)));
    expect(allowedPlaces(listed, play(listed, now).state, scene(now))).toEqual(new Set(['market', 'square']));
    expect(allowedPlaces(listed, play(listed, at(1, 20)).state, scene(at(1, 20)))).toEqual(new Set(['inn']));
    expect(allowedPlaces(extra, play(extra, now).state, scene(now))).toEqual(new Set(['inn', 'gate']));
  });
});

describe('Away', () => {
  const away: ScheduleAction = { kind: 'away' };
  // Patrols the wall all day, and is gone from midday to 14:00.
  const guard = routine([timed('gone', 12, 14, away), allDay('round', patrol([['wall', 30], ['gate', 60], ['market', 30]]))], 'square', ['inn']);
  const follow = (r: Routine, t: number, player: string, options = {}) => (b: PositionBook) => startFollowing(b, r, scene(t, player), options);

  it('gives no Position during the row while time and Patrol progress continue', () => {
    const game = play(guard, at(1, 11), 'inn');
    expect(game.pos).toBe('wall');
    expect(game.advance(at(1, 12, 30), 'inn').pos).toBeUndefined();
    expect(game.state).toMatchObject({ startId: 's1', rowId: 'gone', lastRun: at(1, 12, 30) });
    expect(actionNow(guard, game.state, scene(at(1, 13), 'inn'))).toBe('away');
    expect(game.advance(at(1, 14), 'inn').pos).toBe('wall');
    expect(game.advance(at(1, 14, 30), 'inn').pos).toBe('gate');
  });

  it('replays the Patrol after the row across one long absence', () => {
    // Back at 14:00 on stop 1, then 30 minutes later on to the gate.
    expect(play(guard, at(1, 11), 'inn').advance(at(1, 15), 'inn').pos).toBe('gate');
  });

  it('comes back when the row ends while the player stands at no place', () => {
    const game = play(guard, at(1, 12, 30));
    expect(game.pos).toBeUndefined();
    expect(game.advance(at(1, 14, 30)).pos).toBe('gate');
  });

  it('places nobody at the start of a game that opens in the row', () => {
    const game = play(guard, at(1, 13));
    expect(game.pos).toBeUndefined();
    expect(game.state.startId).toBe('s1');
  });

  it('keeps a character in the scene until the player leaves, then takes it away', () => {
    const game = play(guard, at(1, 11, 50), 'wall');
    expect(game.pos).toBe('wall');
    expect(game.advance(at(1, 12, 30), 'wall').pos).toBe('wall');
    expect(game.advance(at(1, 12, 40), 'inn').pos).toBeUndefined();
  });

  it('refuses a call-over and a new follow during the row, unless a script starts the follow', () => {
    const game = play(guard, at(1, 12, 30), 'inn');
    expect(pullUnique(game.book, guard, 'inn', scene(at(1, 12, 30), 'inn'))).toBe(game.book);
    expect(startFollowing(game.book, guard, scene(at(1, 12, 30), 'inn'))).toBe(game.book);
    game.apply(follow(guard, at(1, 12, 30), 'inn', { script: true }));
    expect(game.advance(at(1, 12, 35), 'inn').pos).toBe('inn');
  });

  it('keeps a running follow going through the row, anywhere its Start connects to', () => {
    const game = play(guard, at(1, 11), 'wall').apply(follow(guard, at(1, 11), 'wall'));
    expect(game.advance(at(1, 12, 30), 'smithy').pos).toBe('smithy');
    expect(game.advance(at(1, 13), 'ridge').pos).toBe('ridge');
    expect(game.state.follow).toEqual({ mode: 'following' });
    expect(game.advance(at(1, 13, 10), 'island').pos).toBe('ridge'); // no path from the Start
    expect(game.state.follow?.mode).toBe('waiting');
  });

  it('goes away when a follow ends in the row, once the player leaves', () => {
    const game = play(guard, at(1, 11), 'wall').apply(follow(guard, at(1, 11), 'wall')).advance(at(1, 12, 30), 'smithy');
    game.apply((b) => partWays(b, 'mara'));
    expect(game.advance(at(1, 12, 40), 'smithy').pos).toBe('smithy');
    expect(game.advance(at(1, 12, 50), 'inn').pos).toBeUndefined();
  });

  it('holds a script move in the row until the row ends', () => {
    const game = play(guard, at(1, 12, 30), 'inn');
    game.apply((b) => moveUniqueByScript(b, guard, 'gate', scene(at(1, 12, 30), 'inn')));
    expect(game.advance(at(1, 13, 30), 'inn').pos).toBe('gate');
    expect(game.advance(at(1, 14), 'inn').pos).toBe('wall');
  });

  it('puts a character away all day, its rolled Start kept', () => {
    const twoStarts = one({
      id: 'mara', traversable: [],
      starts: [
        { id: 'forge', place: 'smithy', weight: 1, schedule: [allDay('work', stay('smithy'))] },
        { id: 'tavern', place: 'inn', weight: 1, schedule: [allDay('drink', stay('inn'))] },
      ],
    });
    const book = advancePositions([twoStarts], EMPTY, scene(at(1, 8), 'square'), seeded(5));
    const gone = advancePositions([{ ...twoStarts, applying: null }], book, scene(at(1, 9), 'square'), seeded(5));
    expect(gone.positions.mara).toBeUndefined();
    expect(gone.uniques.mara.startId).toBe(book.uniques.mara.startId);
    expect(advancePositions([twoStarts], gone, scene(at(1, 10), 'square'), seeded(5)).positions.mara).toBe(book.positions.mara);
  });

  it('gives a Generic Entity Instance no place during the row', () => {
    const bats = one({
      id: 'bats', generic: true, traversable: [],
      starts: [
        { id: 'roost', place: 'wall', weight: 1, schedule: [timed('out', 6, 18, away)] },
        { id: 'loft', place: 'inn', weight: 1, schedule: [] },
      ],
    });
    const day = advancePositions([bats], EMPTY, scene(at(1, 10), 'square'), seeded(3));
    expect(day.generics.bats.roost.position).toBeUndefined();
    expect(genericPlaces(day.generics)).toEqual({ bats: ['inn'] });
    const night = advancePositions([bats], day, scene(at(1, 19), 'square'), seeded(3));
    expect(night.generics.bats.roost.position).toBe('wall');
  });
});

describe('Generic entities', () => {
  // A den by day that hunts at the square by night, a pack that wanders, and one that patrols the wall.
  const wolves = one({
    id: 'wolves', generic: true, traversable: [],
    starts: [
      { id: 'den', place: 'smithy', weight: 1, schedule: [timed('hunt', 20, 6, stay('square'))] },
      { id: 'pack', place: 'inn', weight: 1, schedule: [allDay('roam', wander(['inn', 'market'], 60))] },
      { id: 'watch', place: 'wall', weight: 1, schedule: [allDay('round', patrol([['wall', 30], ['gate', 30]]))] },
    ],
  });
  const instancePositions = (book: PositionBook) =>
    Object.fromEntries(Object.entries(book.generics.wolves ?? {}).map(([id, p]) => [id, p.position]));
  const run = (book: PositionBook, now: number, playerAt?: string, random = seeded(3)) =>
    advancePositions([wolves], book, scene(now, playerAt), random);

  it('runs every Start at once, each on its own row', () => {
    expect(instancePositions(run(EMPTY, at(1, 12)))).toEqual({ den: 'smithy', pack: 'inn', watch: 'wall' });
    expect(instancePositions(run(EMPTY, at(1, 21)))).toMatchObject({ den: 'square', watch: 'wall' });
  });

  it('keeps each Generic Entity Instance on its own Wander idle and Patrol stop across calls', () => {
    const first = run(EMPTY, at(1, 8));
    const half = run(first, at(1, 8, 30));
    expect(instancePositions(half)).toEqual({ den: 'smithy', pack: 'inn', watch: 'gate' });
    expect(half.generics.wolves.watch).toMatchObject({ rowId: 'round', stop: 1, idleEnd: at(1, 9) });
    expect(half.generics.wolves.pack).toMatchObject({ rowId: 'roam', idleEnd: at(1, 9) });
    const hour = run(half, at(1, 9));
    expect(instancePositions(hour)).toEqual({ den: 'smithy', pack: 'market', watch: 'wall' });
  });

  it('gives a Generic entity no Start roll, no Unique entity state and no single position', () => {
    const book = run(EMPTY, at(1, 8));
    expect(book.uniques).toEqual({});
    expect(book.positions).toEqual({});
    expect(Object.keys(book.generics.wolves)).toEqual(['den', 'pack', 'watch']);
  });

  it('runs two Starts at the same place, each on its own rows', () => {
    const pair = one({
      id: 'wolves', generic: true, traversable: [],
      starts: [
        { id: 'a', place: 'inn', weight: 1, schedule: [] },
        { id: 'b', place: 'inn', weight: 1, schedule: [allDay('round', patrol([['inn', 30], ['gate', 30]]))] },
      ],
    });
    const book = advancePositions([pair], EMPTY, scene(at(1, 8)), seeded(1));
    const later = advancePositions([pair], book, scene(at(1, 8, 30)), seeded(1));
    expect(instancePositions(book)).toEqual({ a: 'inn', b: 'inn' });
    expect(instancePositions(later)).toEqual({ a: 'inn', b: 'gate' });
  });

  it('moves no Generic Entity Instance at the player location until the player leaves', () => {
    const book = run(EMPTY, at(1, 8), 'wall');
    expect(instancePositions(run(book, at(1, 10), 'wall')).watch).toBe('wall');
    expect(instancePositions(run(run(book, at(1, 10), 'wall'), at(1, 10, 15), 'inn')).watch).toBe('gate');
  });

  it('leaves a Generic Entity Instance the routine no longer puts here in the scene until the player leaves', () => {
    // Saved at the inn before the author moved the den's routine away from it.
    const saved = { ...EMPTY, generics: { wolves: { den: { position: 'inn', lastRun: at(1, 12) } } } };
    expect(instancePositions(run(saved, at(1, 12, 30), 'inn')).den).toBe('inn');
    expect(instancePositions(run(saved, at(1, 12, 30), 'gate')).den).toBe('smithy');
  });

  it('keeps a row change from taking a Generic Entity Instance out of the scene', () => {
    const evening = run(EMPTY, at(1, 19), 'smithy');
    expect(instancePositions(run(evening, at(1, 21), 'smithy')).den).toBe('smithy');
    expect(instancePositions(run(run(evening, at(1, 21), 'smithy'), at(1, 21, 5), 'inn')).den).toBe('square');
  });

  it('is never pulled, never follows and takes no script move', () => {
    const book = run(EMPTY, at(1, 8));
    const now = scene(at(1, 8), 'inn');
    expect(pullUnique(book, wolves, 'inn', now)).toBe(book);
    expect(startFollowing(book, wolves, now, { script: true })).toBe(book);
    expect(moveUniqueByScript(book, wolves, 'island', now)).toBe(book);
  });

  it('begins a new Start at its place and drops the record of a Start the world lost', () => {
    const saved = run(EMPTY, at(1, 8, 30));
    const withLost = { ...saved, generics: { wolves: { ...saved.generics.wolves, gone: { position: 'gate', lastRun: at(1, 8) } } } };
    const grown = one({ id: 'wolves', generic: true, traversable: [], starts: [...wolves.routines[0].starts.slice(1), { id: 'cub', place: 'square', weight: 1, schedule: [] }] });
    const book = advancePositions([grown], withLost, scene(at(1, 8, 30)), seeded(3));
    expect(Object.keys(book.generics.wolves)).toEqual(['pack', 'watch', 'cub']);
    expect(book.generics.wolves.cub.position).toBe('square');
    expect(book.generics.wolves.watch).toEqual(saved.generics.wolves.watch);
  });

  it('lists the places its Generic Entity Instances stand at, each once', () => {
    expect(genericPlaces({ wolves: { a: { position: 'inn', lastRun: 0 }, b: { position: 'inn', lastRun: 0 }, c: { position: 'gate', lastRun: 0 } } }))
      .toEqual({ wolves: ['inn', 'gate'] });
  });
});

describe('runtime characters', () => {
  const discovered: DiscoveredEntity = { entity: { id: 'stranger', name: 'Stranger' }, locationId: 'square', sourceTurnId: 't1' };

  it('stays where it was discovered, and may follow anywhere', () => {
    const r = runtimeCourse(discovered)!;
    const game = play(r, at(1, 9));
    expect(game.advance(at(4, 9)).pos).toBe('square');
    game.apply((b) => startFollowing(b, r, scene(at(4, 9), 'square'))).advance(at(4, 10), 'island');
    expect(game.pos).toBe('island');
    game.apply((b) => partWays(b, 'stranger')).advance(at(4, 11), 'gate');
    expect(game.pos).toBe('square');
  });
});

describe("the player's starting location", () => {
  /** `playerStart` null: the game knows no player start. */
  const begin = (now: number, playerAt: string, playerStart: string | null = playerAt): PositionScene =>
    ({ ...scene(now, playerAt), ...(playerStart !== null && { playerStart }) });
  const companion = (schedule: ScheduleRow[] = [], traversable: Traversable = 'anywhere', beginsFollowing = true): Routine => one({
    id: 'kit', traversable,
    starts: [{ id: 'beside', place: PLAYER_START, weight: 1, schedule, ...(beginsFollowing && { beginsFollowing: true as const }) }],
  });
  const run = (r: Routine, book: PositionBook, s: PositionScene, random: () => number = seeded(5)) => advancePositions([r], book, s, random);

  it('begins at each starting location the player can begin at', () => {
    for (const start of ['inn', 'gate', 'ridge']) {
      expect(run(companion([], [], false), EMPTY, begin(at(1, 8), start)).positions.kit).toBe(start);
    }
  });

  it('begins where the game began, not where the player stands now', () => {
    expect(run(companion([], [], false), EMPTY, begin(at(2, 8), 'market', 'gate')).positions.kit).toBe('gate');
  });

  it('places nobody while the player start is unknown', () => {
    const book = run(companion([], [], false), EMPTY, begin(at(1, 8), 'inn', null));
    expect(book.positions.kit).toBeUndefined();
    expect(book.uniques.kit).toBeUndefined();
  });

  it('begins Following and moves with the player on the first move', () => {
    const first = run(companion(), EMPTY, begin(at(1, 8), 'inn'));
    expect(first.uniques.kit.follow).toEqual({ mode: 'following' });
    expect(first.positions.kit).toBe('inn');
    expect(run(companion(), first, begin(at(1, 9), 'market', 'inn')).positions.kit).toBe('market');
  });

  it('begins Following on a Strict row', () => {
    const guarded = companion([allDay('guard', stay('inn'), true)]);
    const first = run(guarded, EMPTY, begin(at(1, 8), 'inn'));
    expect(isStrictNow(guarded, first.uniques.kit, at(1, 8))).toBe(true);
    expect(first.uniques.kit.follow?.mode).toBe('following');
    expect(run(guarded, first, begin(at(1, 9), 'gate', 'inn')).positions.kit).toBe('gate');
  });

  it('keeps Traversable: a place outside it leaves the companion waiting', () => {
    const homebody = companion([], ['inn']);
    const first = run(homebody, EMPTY, begin(at(1, 8), 'inn'));
    const moved = run(homebody, first, begin(at(1, 9), 'market', 'inn'));
    expect(moved.positions.kit).toBe('inn');
    expect(moved.uniques.kit.follow?.mode).toBe('waiting');
  });

  it('follows only in a game that rolled the Start with the setting', () => {
    const either = one({
      id: 'kit', traversable: 'anywhere',
      starts: [
        { id: 'beside', place: PLAYER_START, weight: 1, schedule: [], beginsFollowing: true },
        { id: 'home', place: 'smithy', weight: 1, schedule: [] },
      ],
    });
    const rolledBeside = run(either, EMPTY, begin(at(1, 8), 'inn'), () => 0);
    expect(rolledBeside.uniques.kit).toMatchObject({ startId: 'beside', follow: { mode: 'following' } });
    const rolledHome = run(either, EMPTY, begin(at(1, 8), 'inn'), () => 0.99);
    expect(rolledHome.uniques.kit.startId).toBe('home');
    expect(rolledHome.uniques.kit.follow).toBeUndefined();
    expect(rolledHome.positions.kit).toBe('smithy');
  });

  it('ignores Begins Following on a Start at a fixed location', () => {
    const fixed = one({ id: 'kit', traversable: 'anywhere', starts: [{ id: 'home', place: 'smithy', weight: 1, schedule: [], beginsFollowing: true }] });
    const book = run(fixed, EMPTY, begin(at(1, 8), 'inn'));
    expect(book.uniques.kit.follow).toBeUndefined();
    expect(book.positions.kit).toBe('smithy');
  });

  it('skips a row place the real start cannot reach', () => {
    const islander = companion([allDay('shore', stay('island'))], [], false);
    expect(run(islander, EMPTY, begin(at(1, 8), 'inn')).positions.kit).toBe('inn');
    expect(run(islander, EMPTY, begin(at(1, 8), 'island')).positions.kit).toBe('island');
  });

  it('runs a Generic Entity Instance from beside the player, then its rows, and never follows', () => {
    const crowd = one({
      id: 'crowd', generic: true, traversable: [],
      starts: [{ id: 'beside', place: PLAYER_START, weight: 1, schedule: [timed('market', 12, 14, stay('square'))], beginsFollowing: true }],
    });
    const first = run(crowd, EMPTY, begin(at(1, 8), 'inn'));
    expect(first.generics.crowd.beside.position).toBe('inn');
    expect(first.uniques.crowd).toBeUndefined();
    const moved = run(crowd, first, begin(at(1, 9), 'gate', 'inn'));
    expect(moved.generics.crowd.beside.position).toBe('inn');
    expect(run(crowd, moved, begin(at(1, 13), 'gate', 'inn')).generics.crowd.beside.position).toBe('square');
  });
});

describe('Routines', () => {
  // Day: works at the smithy or sells at the market. Night: drinks at the inn or guards the gate.
  const day = { id: 'day', traversable: [] as Traversable, starts: [
    { id: 'forge', place: 'smithy', weight: 1, schedule: [allDay('work', stay('smithy'))] },
    { id: 'stall', place: 'market', weight: 1, schedule: [allDay('sell', stay('market'))] },
  ] };
  const night = { id: 'night', traversable: [] as Traversable, starts: [
    { id: 'tavern', place: 'inn', weight: 1, schedule: [allDay('drink', wander(['inn', 'square'], 30))] },
    { id: 'post', place: 'gate', weight: 1, schedule: [allDay('guard', stay('gate'))] },
  ] };
  const mara = (applying: string | null): Course => ({ id: 'mara', routines: [day, night], applying });
  const step = (applying: string | null, book: PositionBook, t: number, random: () => number = seeded(9), player = 'ridge') =>
    advancePositions([mara(applying)], book, scene(t, player), random);

  it('rolls every Routine once at new game and keeps each roll in the state', () => {
    const rolled = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const st = step('day', EMPTY, at(1, 8), seeded(seed)).uniques.mara;
      expect(st.routineId).toBe('day');
      expect(Object.keys(st.rolls ?? {})).toEqual(['night']);
      rolled.add(`${st.startId}/${st.rolls?.night}`);
    }
    // Both Routines roll by weight, each on its own.
    expect(rolled.size).toBe(4);
  });

  it('reuses the kept roll on every swap, never rolling again (Q4)', () => {
    let book = step('day', EMPTY, at(1, 8), seeded(3));
    const dayStart = book.uniques.mara.startId;
    const nightStart = book.uniques.mara.rolls?.night;
    for (let i = 1; i <= 12; i++) {
      const applying = i % 2 ? 'night' : 'day';
      // A fresh random source every swap, so a second roll would drift.
      book = step(applying, book, at(1, 8) + i * 60, seeded(100 + i));
      expect(book.uniques.mara.routineId).toBe(applying);
      expect(book.uniques.mara.startId).toBe(applying === 'day' ? dayStart : nightStart);
    }
  });

  it('places a swap by the new Schedule at the current time, with no row, idle or hold carried (Q11)', () => {
    const daytime = step('day', EMPTY, at(1, 8), () => 0);
    expect(daytime.positions.mara).toBe('smithy');
    const held = moveUniqueByScript(daytime, mara('day'), 'wall', scene(at(1, 8, 30), 'square'));
    expect(held.uniques.mara.hold).toEqual({ untilScriptMove: true });
    const nighttime = step('night', held, at(1, 20), () => 0);
    expect(nighttime.positions.mara).toBe('inn');
    expect(nighttime.uniques.mara).toMatchObject({ rowId: 'drink', idleEnd: at(1, 20, 30) });
    expect(nighttime.uniques.mara.hold).toBeUndefined();
    const back = step('day', nighttime, at(2, 9), () => 0);
    expect(back.positions.mara).toBe('smithy');
    expect(back.uniques.mara).not.toHaveProperty('idleEnd');
  });

  it('waits for the player to leave before a swap moves an entity out of the scene', () => {
    const daytime = step('day', EMPTY, at(1, 8), () => 0, 'smithy');
    const swapped = step('night', daytime, at(1, 20), () => 0, 'smithy');
    expect(swapped.positions.mara).toBe('smithy');
    expect(step('night', swapped, at(1, 20, 10), () => 0, 'square').positions.mara).toBe('inn');
  });

  it('goes Away while no Routine holds, and a script hold on that Away row does not pin a return (Q24)', () => {
    const daytime = step('day', EMPTY, at(1, 8), () => 0);
    const gone = step(null, daytime, at(1, 9), () => 0);
    expect(gone.positions.mara).toBeUndefined();
    expect(gone.uniques.mara).toMatchObject({ nowhere: true, routineId: 'day', startId: daytime.uniques.mara.startId });
    // All-day Away: a script move holds until the next script move.
    const moved = moveUniqueByScript(gone, mara(null), 'wall', scene(at(1, 9, 30), 'square'));
    expect(moved.uniques.mara.hold).toEqual({ untilScriptMove: true });
    expect(step(null, moved, at(1, 10), () => 0).positions.mara).toBe('wall');
    const back = step('night', moved, at(1, 20), () => 0);
    expect(back.positions.mara).toBe('inn');
    expect(back.uniques.mara.nowhere).toBeUndefined();
    expect(back.uniques.mara.startId).toBe(daytime.uniques.mara.rolls?.night);
  });

  it('keeps a follow through a swap and leads the follower on the new Routine\'s reach', () => {
    const daytime = step('day', EMPTY, at(1, 8), () => 0);
    const following = startFollowing(daytime, mara('day'), scene(at(1, 8), 'square'));
    const swapped = step('night', following, at(1, 20), () => 0, 'inn');
    expect(swapped.uniques.mara.follow).toEqual({ mode: 'following' });
    expect(swapped.positions.mara).toBe('inn');
  });

  it('begins following only on the Routine that applies at new game (Q31)', () => {
    const beside = { id: 'beside', traversable: 'anywhere' as Traversable, starts: [{ id: 'b', place: PLAYER_START, weight: 1, schedule: [], beginsFollowing: true as const }] };
    const home = { id: 'home', traversable: 'anywhere' as Traversable, starts: [{ id: 'h', place: 'smithy', weight: 1, schedule: [] }] };
    const kit = (applying: string): Course => ({ id: 'kit', routines: [home, beside], applying });
    const s = (t: number, player: string): PositionScene => ({ ...scene(t, player), playerStart: 'square' });
    const opened = advancePositions([kit('home')], EMPTY, s(at(1, 8), 'square'), () => 0);
    expect(opened.uniques.kit.follow).toBeUndefined();
    expect(advancePositions([kit('beside')], opened, s(at(1, 9), 'square'), () => 0).uniques.kit.follow).toBeUndefined();
    expect(advancePositions([kit('beside')], EMPTY, s(at(1, 8), 'square'), () => 0).uniques.kit.follow).toEqual({ mode: 'following' });
  });

  it('reads a v3.7.0 state, which holds one startId, as the first Routine\'s roll', () => {
    const saved: PositionBook = { positions: { mara: 'market' }, uniques: { mara: { startId: 'stall', lastRun: at(1, 8) } }, generics: {} };
    const read = step('day', saved, at(1, 9), seeded(4));
    expect(read.uniques.mara).toMatchObject({ startId: 'stall', routineId: 'day' });
    expect(read.positions.mara).toBe('market');
    expect(['tavern', 'post']).toContain(read.uniques.mara.rolls?.night);
    expect(step('day', step('night', read, at(1, 20)), at(2, 9)).uniques.mara.startId).toBe('stall');
  });

  it('keeps a one-Routine save\'s roll after the author puts a new Routine first (Q34)', () => {
    const saved: PositionBook = { positions: { mara: 'gate' }, uniques: { mara: { startId: 'post', lastRun: at(1, 20) } }, generics: {} };
    // `() => 0` re-rolls night onto the tavern, so a lost roll shows.
    const read = step('night', saved, at(1, 21), () => 0);
    expect(read.uniques.mara).toMatchObject({ startId: 'post', routineId: 'night', rolls: { day: 'forge' } });
    expect(read.positions.mara).toBe('gate');
  });

  it('never begins following on a load-time re-roll (Q34)', () => {
    const beside = { id: 'beside', traversable: 'anywhere' as Traversable, starts: [{ id: 'b', place: PLAYER_START, weight: 1, schedule: [], beginsFollowing: true as const }] };
    const home = { id: 'home', traversable: 'anywhere' as Traversable, starts: [
      { id: 'cot', place: 'inn', weight: 1, schedule: [] },
      { id: 'h', place: 'smithy', weight: 1, schedule: [] },
    ] };
    const s: PositionScene = { ...scene(at(1, 9), 'square'), playerStart: 'square' };
    // `() => 0` rolls each Routine's first Start.
    const load = (routines: Course['routines'], startId: string, applying: string) => advancePositions(
      [{ id: 'kit', routines, applying }],
      { positions: { kit: 'smithy' }, uniques: { kit: { startId, lastRun: at(1, 8) } }, generics: {} }, s, () => 0,
    ).uniques.kit;
    // The saved Start is gone, so the entity rolls again onto the Begins Following Start.
    const rerolled = load([beside], 'gone', 'beside');
    expect(rerolled.startId).toBe('b');
    expect(rerolled.follow).toBeUndefined();
    // A one-Routine save keeps its roll and swaps to a Begins Following Routine the author put first.
    const swapped = load([beside, home], 'h', 'beside');
    expect(swapped).toMatchObject({ startId: 'b', routineId: 'beside', rolls: { home: 'h' } });
    expect(swapped.follow).toBeUndefined();
  });

  it('writes no Routine fields for an entity with one Routine', () => {
    const single = advancePositions([routine([allDay('rest', stay('inn'))])], EMPTY, scene(at(1, 8)), seeded(1)).uniques.mara;
    expect(single).not.toHaveProperty('routineId');
    expect(single).not.toHaveProperty('rolls');
  });

  it('runs only the applying Routine\'s Generic Entity Instances, which leave and come back fresh (Q5, Q11)', () => {
    const herd = (applying: string | null): Course => ({ id: 'herd', generic: true, applying, routines: [day, night] });
    const run = (applying: string | null, book: PositionBook, t: number) => advancePositions([herd(applying)], book, scene(t, 'wall'), seeded(2));
    const daytime = run('day', EMPTY, at(1, 8));
    expect(Object.keys(daytime.generics.herd)).toEqual(['forge', 'stall']);
    const nighttime = run('night', daytime, at(1, 20));
    expect(Object.keys(nighttime.generics.herd)).toEqual(['tavern', 'post']);
    expect(nighttime.generics.herd.post.position).toBe('gate');
    expect(run(null, nighttime, at(1, 21)).generics.herd).toBeUndefined();
    expect(run('day', nighttime, at(2, 8)).generics.herd.forge).toMatchObject({ position: 'smithy', rowId: 'work', lastRun: at(2, 8) });
  });
});
