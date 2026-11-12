import { PLAYER_START, type Entity, type EntityStart, type GameLocation, type PlayerStat, type Script } from '@/types';
import { castRoutines } from '@/lib/entityKind';
import { EMPTY_BOOK, type PositionBook } from '@/lib/positionEngine';
import { placeAll, positionWorld, scriptPlaces, type PositionWorld } from '@/lib/positionPlay';
import { storyMinute } from '@/lib/gameClock';
import { inPlayOwners } from '@/lib/ownedTraitsInPlay';
import { runStatCodeTurn } from '@/lib/statCodeTurn';
import type { StatCodeOwners } from '@/lib/statCodeTraits';
import type { WorldWrites } from '@/lib/statCodeExecutor';
import { commitEntityMoves } from '@/lib/turnPipeline/computeTurnCommit';
import { NO_ENTITY_MOVES, type FollowerState } from '@/lib/entityFollowing';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

/**
 * Script tests on entities with a kind and Starts: a cast placed by the real position engine, a script run through
 * the executor, its entity writes committed by `commitEntityMoves`, and a script that reads the result.
 */

const place = (id: string, name: string, parentId?: string): GameLocation => ({ id, name, ...(parentId && { parentId }) });

/** harbor > { inn, square, keep } ; the gate is top-level, so a player standing there is away from the cast. */
export const KIND_LOCATIONS = [
  place('harbor', 'Harbor'), place('inn', 'Inn', 'harbor'), place('square', 'Square', 'harbor'), place('keep', 'Keep', 'harbor'),
  place('gate', 'Gate'),
];

export const NOON = storyMinute(4);

/** A Start at `at`, weight 1. */
export const start = (at: string, schedule: EntityStart['schedule'] = []): EntityStart => ({ id: `at-${at}`, place: at, weight: 1, schedule });
/** A Start `id` at `place`, with one all-day Stay row at `rowPlace` when given. */
export const startWithRow = (id: string, place: string, rowPlace?: string): EntityStart => ({
  id, place, weight: 1,
  schedule: rowPlace ? [{ id: `${id}-r`, time: 'allDay', action: { kind: 'stay', place: rowPlace } }] : [],
});
/** A Unique entity with `starts` and no Traversable. */
export const unique = (id: string, name: string, starts: EntityStart[]): Entity =>
  ({ id, name, kind: 'unique', starts, traversable: [] });

/** Tess wanders between the inn and the square all day, resting 10 minutes at each stop. */
export const TESS = unique('tess', 'Tess', [start('inn', [{
  id: 'w', time: 'allDay', action: { kind: 'wander', places: [{ place: 'inn', weight: 1 }, { place: 'square', weight: 1 }], idle: 10 },
}])]);
/** Wenna starts at the inn with an empty schedule. */
export const WENNA = unique('wenna', 'Wenna', [start('inn')]);
/** Clerk keeps a Strict, all-day shift at the inn: a locked row. */
export const CLERK = unique('clerk', 'Clerk', [start('inn', [{ id: 'shift', time: 'allDay', strict: true, action: { kind: 'stay', place: 'inn' } }])]);
/** Moths is Generic, with a Generic Entity Instance at each of its two Starts. */
export const MOTHS: Entity = {
  id: 'moths', name: 'Moths', kind: 'generic',
  starts: [{ id: 'm1', place: 'inn', weight: 1, schedule: [] }, { id: 'm2', place: 'gate', weight: 1, schedule: [] }],
};
export const KIND_CAST: Entity[] = [TESS, WENNA, CLERK, MOTHS];

export const worldAt = (playerAt: string, now = NOON, cast: Entity[] = KIND_CAST): PositionWorld =>
  positionWorld(castRoutines(cast), now, playerAt, KIND_LOCATIONS, [], () => 0);

/** The cast placed by the engine for a player at `playerAt`, as a new game places it. */
export const placedBook = (playerAt: string, cast: Entity[] = KIND_CAST): PositionBook => placeAll(EMPTY_BOOK, worldAt(playerAt, NOON, cast));

const echo = (): PlayerStat => ({
  id: 'echo', name: 'Echo', type: 'number', description: '', min: 0, max: 100000, value: 0, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100000, baseRegen: 0, aiMaxDelta: 0,
});

const ownersOf = (cast: Entity[]): StatCodeOwners => {
  const persona = { source: 'none' } as const;
  return {
    acquired: [], disabledTraitIds: [], appliedValues: {}, entities: cast, library: [],
    world: { traits: [], groups: [], entities: cast, persona, ...inPlayOwners({ traits: [], traitGroups: [], entities: cast }, persona, []) },
  };
};

const scriptsOf = (...codes: string[]): Script[] => codes.map((code, i) => ({ id: `s${i}`, timing: 'after', code }));

/** Where the book stands, as a script reads it. `book` absent, no entity has a position. */
const boardOf = (book: PositionBook | undefined, playerAt: string, cast: Entity[]): Partial<FlatStatCodeTurn> => ({
  places: {
    locations: KIND_LOCATIONS.map(({ id, name }) => ({ id, name })),
    location: { id: playerAt, name: KIND_LOCATIONS.find((l) => l.id === playerAt)?.name ?? '' },
  },
  ...(book && scriptPlaces(book, worldAt(playerAt, NOON, cast))),
});

const turnOf = (book: PositionBook | undefined, playerAt: string, codes: string[], cast: Entity[]) => statCodeTurnOf({
  stats: [echo()], enabled: {}, previous: [echo()], asks: [], regenApplied: {}, clock: { deltaHours: 0, elapsedHours: 10 },
  ownerTraits: ownersOf(cast), statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
  turn: { action: '', number: 3, id: 't-3', narration: '', choices: [] },
  ...boardOf(book, playerAt, cast), worldScripts: scriptsOf(...codes),
});

/** The world writes of `codes`, run in order as one chain over `book`, the player at `playerAt`. */
export async function writesOf(book: PositionBook | undefined, playerAt: string, cast: Entity[], ...codes: string[]): Promise<WorldWrites | undefined> {
  return (await runStatCodeTurn(turnOf(book, playerAt, codes, cast))).worldWrites;
}

/** Whether `condition` holds in a script run over `book`, the player at `playerAt`. */
export async function reads(book: PositionBook | undefined, playerAt: string, condition: string, cast: Entity[] = KIND_CAST): Promise<boolean> {
  const out = await runStatCodeTurn(turnOf(book, playerAt, [`stats.Echo.value = (${condition}) ? 1 : 0;`], cast));
  return out.stats.find((s) => s.id === 'echo')?.value === 1;
}

/** `book` after the turn commits `writes` with the player at `playerAt` (no move). */
export function commit(book: PositionBook, writes: WorldWrites | undefined, playerAt: string, world: PositionWorld = worldAt(playerAt)): FollowerState {
  return commitEntityMoves(
    book, { entityMoves: NO_ENTITY_MOVES, suggestedLocation: null, codeWrites: writes ?? null },
    { from: playerAt, to: playerAt }, world,
  ).state;
}

/** The position engine tests' cast: a yard with a barn and a field in it, and a smithy apart. */
export const yardLocations = [
  { id: 'yard', name: 'Yard', parentId: null, isStarting: true },
  { id: 'barn', name: 'Barn', parentId: 'yard' },
  { id: 'field', name: 'Field', parentId: 'yard' },
  { id: 'smithy', name: 'Smithy', parentId: null },
];

/** A Generic entity: one Start grazes in the field from 08:00 to 18:00 and stays in the barn otherwise; one stays in the barn. */
export const herd: Entity = {
  id: 'herd', name: 'Herd', kind: 'generic',
  starts: [
    { id: 'grazer', place: 'barn', weight: 1, schedule: [{ id: 'graze', time: { start: 480, end: 1080 }, action: { kind: 'stay', place: 'field' } }] },
    { id: 'sleeper', place: 'barn', weight: 1, schedule: [] },
  ],
};

/** A Unique entity: its first Start keeps the smithy and drinks in the barn from 20:00 to 22:00; its second waits in the field. */
export const smith: Entity = {
  id: 'smith', name: 'Smith', kind: 'unique',
  starts: [
    { id: 'forge', place: 'smithy', weight: 1, schedule: [{ id: 'drink', time: { start: 1200, end: 1320 }, action: { kind: 'stay', place: 'barn' } }] },
    { id: 'idle', place: 'field', weight: 1, schedule: [] },
  ],
};

/** A Unique entity that begins at Player's Starting Location, Following. */
export const companion: Entity = {
  id: 'companion', name: 'Companion', kind: 'unique',
  starts: [{ id: 'beside', place: PLAYER_START, weight: 1, schedule: [], beginsFollowing: true }],
};
