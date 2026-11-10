import { describe, expect, it } from 'vitest';
import type { Connection, DiscoveredEntity, ScheduleAction, ScheduleRow, Traversable } from '@/types';
import {
  advancePositions, allowedPlaces, connectedPlaces, isStrictNow, moveIndividualByScript, partWays, pullIndividual,
  runtimeRoutine, startFollowing, startWaiting, waitUntil, type PositionBook, type PositionScene, type Routine,
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

const routine = (schedule: ScheduleRow[], place = 'inn', traversable: Traversable = []): Routine =>
  ({ id: 'mara', starts: [{ id: 's1', place, weight: 1, schedule }], traversable });

const EMPTY: PositionBook = { positions: {}, individuals: {} };
const scene = (now: number, playerAt?: string): PositionScene => ({ locations, connections, now, playerAt });

/** Drives one character through engine calls; `pos` reads where it stands. */
function play(r: Routine, now: number, playerAt?: string, random = seeded(7)) {
  let book = advancePositions([r], EMPTY, scene(now, playerAt), random);
  const game = {
    get book() { return book; },
    get pos() { return book.positions[r.id]; },
    get state() { return book.individuals[r.id]; },
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
  const twoStarts: Routine = {
    id: 'mara',
    starts: [
      { id: 'forge', place: 'smithy', weight: 3, schedule: [] },
      { id: 'tavern', place: 'inn', weight: 1, schedule: [] },
    ],
    traversable: [],
  };

  it('weights the pick', () => {
    let forge = 0;
    for (let seed = 1; seed <= 400; seed++) {
      if (advancePositions([twoStarts], EMPTY, scene(at(1, 8)), seeded(seed)).individuals.mara.startId === 'forge') forge++;
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
    expect(later.individuals.mara.startId).toBe('forge');
    expect(later.positions.mara).toBe('smithy');
  });

  it('rolls again for a Start the world no longer has', () => {
    const first = advancePositions([twoStarts], EMPTY, scene(at(1, 8)), () => 0);
    const edited = { ...twoStarts, starts: [twoStarts.starts[1]] };
    expect(advancePositions([edited], first, scene(at(1, 9)), () => 0).individuals.mara.startId).toBe('tavern');
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
    game.apply((b) => pullIndividual(b, guard, 'inn', scene(at(1, 8, 45), 'inn')));
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
    const game = play(smith, at(1, 9), 'inn').apply((b) => pullIndividual(b, smith, 'inn', scene(at(1, 9), 'inn')));
    expect(game.advance(at(1, 12), 'inn').pos).toBe('inn');
    expect(game.advance(at(1, 13), 'gate').pos).toBe('smithy');
  });

  it('holds a pulled Wander character until its idle runs out, even after the player leaves', () => {
    const r = routine([allDay('drift', wander(['market', 'square'], 60))], 'market', ['inn']);
    const game = play(r, at(1, 8), 'inn').apply((b) => pullIndividual(b, r, 'inn', scene(at(1, 8, 30), 'inn')));
    expect(game.advance(at(1, 8, 40), 'gate').pos).toBe('inn');
    expect(['market', 'square']).toContain(game.advance(at(1, 9), 'gate').pos);
  });

  it('refuses a pull into a place not allowed, on a Strict row, or of a follower', () => {
    const pull = (r: Routine, b: PositionBook, t: number) => pullIndividual(b, r, 'inn', scene(t, 'inn'));
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
    game.apply((b) => pullIndividual(b, r, 'inn', scene(at(1, 11), 'inn')));
    expect(game.advance(at(1, 11, 30), 'gate').pos).toBe('inn');
    expect(game.advance(at(1, 12), 'gate').pos).not.toBe('inn');
  });

  it('holds a script move on a Stay row until that stretch of the day ends', () => {
    const game = play(smith, at(1, 10)).apply((b) => moveIndividualByScript(b, smith, 'gate', scene(at(1, 10))));
    expect(game.advance(at(1, 16, 59)).pos).toBe('gate');
    expect(game.advance(at(1, 17, 30)).pos).toBe('inn');
  });

  it('holds a script move in All-day time until the next timed row starts', () => {
    const game = play(smith, at(1, 20)).apply((b) => moveIndividualByScript(b, smith, 'gate', scene(at(1, 20))));
    expect(game.advance(at(2, 7, 59)).pos).toBe('gate');
    expect(game.advance(at(2, 8)).pos).toBe('smithy');
  });

  it('holds a script move of a character with no rows until a script moves it again', () => {
    const still = routine([], 'inn');
    const game = play(still, at(1, 10)).apply((b) => moveIndividualByScript(b, still, 'gate', scene(at(1, 10))));
    expect(game.advance(at(9, 10)).pos).toBe('gate');
    game.apply((b) => moveIndividualByScript(b, still, 'square', scene(at(9, 10))));
    expect(game.advance(at(12, 10)).pos).toBe('square');
  });

  it('holds a script move on a Wander row until the idle runs out', () => {
    const r = routine([allDay('drift', wander(['market', 'square'], 60))], 'market');
    const game = play(r, at(1, 8)).apply((b) => moveIndividualByScript(b, r, 'gate', scene(at(1, 8, 20))));
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
    const morning = at(1, 10); // morning runs to 11:02, midday to 12:58
    expect(waitUntil({ until: at(5, 0) }, morning)).toBe(at(1, 12, 58));
    expect(waitUntil('hour', morning)).toBe(at(1, 11));
    expect(waitUntil('thisDaypart', morning)).toBe(at(1, 11, 2));
    expect(waitUntil('nextDaypart', morning)).toBe(at(1, 12, 58));
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
    expect(game.state.follow).toEqual({ mode: 'waiting', until: at(1, 11, 2) });
    expect(game.advance(at(1, 11, 2), 'gate').pos).toBe('smithy');
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
    expect(startFollowing(game.book, clerk, scene(at(1, 9), 'market'), { script: true }).individuals.mara.follow)
      .toEqual({ mode: 'following', script: true });
    expect(startFollowing(game.book, clerk, scene(at(1, 18), 'inn')).individuals.mara.follow).toEqual({ mode: 'following' });
  });

  it('keeps a running follow going into a Strict row', () => {
    const clerk = routine([allDay('rest', stay('inn')), timed('shift', 8, 17, stay('market'), true)], 'inn', 'anywhere');
    const game = play(clerk, at(1, 7), 'inn').apply(follow(clerk, at(1, 7), 'inn'));
    expect(game.advance(at(1, 9), 'gate').pos).toBe('gate');
  });

  it('ends a wait on a script move', () => {
    const game = play(smith, at(1, 9), 'square').apply(follow(smith, at(1, 9), 'square'));
    game.apply((b) => startWaiting(b, 'mara', 'nextDaypart', at(1, 9)));
    game.apply((b) => moveIndividualByScript(b, smith, 'gate', scene(at(1, 9, 5), 'square')));
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

describe('runtime characters', () => {
  const discovered: DiscoveredEntity = { entity: { id: 'stranger', name: 'Stranger' }, locationId: 'square', sourceTurnId: 't1' };

  it('stays where it was discovered, and may follow anywhere', () => {
    const r = runtimeRoutine(discovered)!;
    const game = play(r, at(1, 9));
    expect(game.advance(at(4, 9)).pos).toBe('square');
    game.apply((b) => startFollowing(b, r, scene(at(4, 9), 'square'))).advance(at(4, 10), 'island');
    expect(game.pos).toBe('island');
    game.apply((b) => partWays(b, 'stranger')).advance(at(4, 11), 'gate');
    expect(game.pos).toBe('square');
  });
});
