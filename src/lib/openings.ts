import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
import { entityIdsAt, entityIdsAtAny } from '@/lib/entityPresence';
import { startCandidates } from '@/lib/startingLocation';
import { randomUUID } from '@/lib/uuid';
import type { Entity, GameLocation, Opening, OpeningKind, WorldOverview } from '@/types';

/**
 * Openings: the weighted list a playthrough starts from. Every rule lives here — which rows can be drawn,
 * the draw itself, the chance each row shows, and the patches the editor writes — so the pre-fill, the
 * page-one regenerate, the legacy start message and the Test Bench all read one answer.
 */

/** What a world with nothing to draw opens on. */
export const DEFAULT_OPENING: Opening = { id: 'default', text: OPENING_SCENE_CUE, kind: 'action' };

/** Anything that carries openings: the world overview or an entity. An opening id is unique within its
 *  owner only, since a library entity added twice keeps its ids. */
export interface OpeningOwner {
  openings?: Opening[];
  openingWeights?: Record<string, number>;
}

/** One drawable row, its owner and its weight, always above 0. `ownerId` is the entity's id, or null for
 *  the world's own rows. */
export interface PoolEntry {
  ownerId: string | null;
  opening: Opening;
  weight: number;
}

type Overview = WorldOverview | null | undefined;
type MaybeOwner = OpeningOwner | null | undefined;

/**
 * Whether the world's list is switched on. `false` is the author switching it off. Absent derives: on once
 * any owner has written an opening, so a world that has none reads off and plays the default opening.
 * `owners` is the world's entities; the overview counts as an owner of its own.
 */
export function openingsEnabled(overview: Overview, owners: readonly MaybeOwner[] = []): boolean {
  if (overview?.openingsEnabled === false) return false;
  return hasAuthoredOpenings(overview) || owners.some(hasAuthoredOpenings);
}

/** Whether this owner has written an opening. Weight 0 benches one row, so it still counts here. */
export function hasAuthoredOpenings(owner: MaybeOwner): boolean {
  return (owner?.openings ?? []).some((o) => o.text.trim().length > 0);
}

/** A row's relative weight: 1 unless the author set one. Negatives count as 0. */
export function openingWeight(weights: Record<string, number> | undefined, id: string): number {
  const w = weights?.[id];
  return typeof w === 'number' && Number.isFinite(w) ? Math.max(0, w) : 1;
}

/** The rows of one owner that can come up, with their weights. A blank or benched row never draws. */
function drawable(owner: MaybeOwner, ownerId: string | null): PoolEntry[] {
  return (owner?.openings ?? [])
    .filter((o) => o.text.trim())
    .map((opening) => ({ ownerId, opening, weight: openingWeight(owner?.openingWeights, opening.id) }))
    .filter((e) => e.weight > 0);
}

/** What a new playthrough's pool reads: the world, its authored entities and the chosen starting location. */
export interface PoolSources {
  overview: Overview;
  entities?: readonly Entity[];
  startingLocationId?: string | null;
  /** The library entities the player picked at Enter World. */
  picked?: readonly Entity[];
}

/**
 * The rows a new playthrough draws from. The world switch benches every row, whoever owns it. With it on,
 * picked entities with a drawable row replace everything else; otherwise the world's own rows, then those
 * of the authored entities present at the starting location, in cast order.
 */
export function openingPool({ overview, entities = [], startingLocationId, picked = [] }: PoolSources): PoolEntry[] {
  if (!openingsEnabled(overview, entities)) return [];
  const pickedRows = picked.flatMap((e) => drawable(e, e.id));
  if (pickedRows.length) return pickedRows;
  const present = new Set(entityIdsAt(startingLocationId, [...entities]));
  return [
    ...drawable(overview, null),
    ...entities.filter((e) => present.has(e.id)).flatMap((e) => drawable(e, e.id)),
  ];
}

const poolWeight = (pool: readonly PoolEntry[]) => pool.reduce((sum, e) => sum + e.weight, 0);

/** Each row's chance of being drawn from the whole pool, as a percentage, in pool order. */
export function poolChances(pool: readonly PoolEntry[]): number[] {
  const total = poolWeight(pool);
  return pool.map((e) => (total > 0 ? (e.weight / total) * 100 : 0));
}

/** A drawn row: the opening and the id of the entity that owns it, or null for the world's own. */
export type DrawnOpening = Pick<PoolEntry, 'ownerId' | 'opening'>;

/** One row by weight, or the default when the pool is empty. `random` returns a number in [0, 1). */
export function drawPoolEntry(pool: readonly PoolEntry[], random: () => number): DrawnOpening {
  if (poolWeight(pool) <= 0) return { ownerId: null, opening: DEFAULT_OPENING };
  const { ownerId, opening } = drawEntry(pool, random);
  return { ownerId, opening };
}

/** One opening by weight, or the default when the pool is empty. `random` returns a number in [0, 1). */
export function drawOpening(pool: readonly PoolEntry[], random: () => number): Opening {
  return drawPoolEntry(pool, random).opening;
}

/** The entity among `entities` that owns a drawn row, or null for the world's own row. */
export function openingOwner(ownerId: string | null, entities: readonly Entity[]): Entity | null {
  return ownerId == null ? null : entities.find((e) => e.id === ownerId) ?? null;
}

/** One row by weight from a pool that has weight to draw. */
function drawEntry(pool: readonly PoolEntry[], random: () => number): PoolEntry {
  let r = random() * poolWeight(pool);
  for (const e of pool) {
    r -= e.weight;
    if (r < 0) return e;
  }
  return pool[pool.length - 1];
}

/** What the shown list records a row under: owner plus opening id, since ids repeat across owners. */
const openingKey = (ownerId: string | null, openingId: string) => JSON.stringify([ownerId, openingId]);

export const poolKey = (entry: PoolEntry): string => openingKey(entry.ownerId, entry.opening.id);

/** One draw and the shown list after it: row keys in the order the session showed them, newest last. */
export interface UnseenDraw extends DrawnOpening {
  shown: string[];
}

/**
 * One opening by weight from the rows the session has not shown. When every row has been shown the set
 * starts over, keeping only the one on screen so the next draw still differs from it. A pool of one has
 * nothing else to give and returns its row again.
 */
export function drawUnseenOpening(pool: readonly PoolEntry[], shown: readonly string[], random: () => number): UnseenDraw {
  if (poolWeight(pool) <= 0) return { ownerId: null, opening: DEFAULT_OPENING, shown: [...shown] };
  let seen = shown.filter((key) => pool.some((e) => poolKey(e) === key));
  let unseen = pool.filter((e) => !seen.includes(poolKey(e)));
  if (unseen.length === 0) {
    seen = seen.slice(-1);
    unseen = pool.filter((e) => !seen.includes(poolKey(e)));
    if (unseen.length === 0) return { ownerId: pool[0].ownerId, opening: pool[0].opening, shown: seen };
  }
  const entry = drawEntry(unseen, random);
  return { ownerId: entry.ownerId, opening: entry.opening, shown: [...seen, poolKey(entry)] };
}

/** The opening a new playthrough of this world starts on. */
export function resolveOpening(overview: Overview, random: () => number = Math.random): Opening {
  return drawOpening(openingPool({ overview }), random);
}

/** Each of one owner's rows' chance of being drawn from that owner's list, as a percentage keyed by id.
 *  Ignores the switch, so an author drafting a switched-off list still reads the odds it will have. */
export function openingChances(owner: MaybeOwner): Record<string, number> {
  const pool = drawable(owner, null);
  const chances = poolChances(pool);
  const out: Record<string, number> = {};
  for (const o of owner?.openings ?? []) out[o.id] = 0;
  pool.forEach((e, i) => { out[e.opening.id] = chances[i]; });
  return out;
}

// ── Editor view ───────────────────────────────────────────────────────────────

/** One row as an editor shows it. A null chance marks a row outside the pool the chances describe. */
export interface EditorOpeningRow {
  opening: Opening;
  weight: number;
  chance: number | null;
}

/** One owner's rows in the world panel. The world's own group has no entity. */
export interface EditorOpeningGroup {
  entity: Entity | null;
  name: string;
  rows: EditorOpeningRow[];
  /** At none of the world's starting locations, so its rows never come up. */
  atNoStart: boolean;
  /** At the starting location the chances describe, so its rows count in them. */
  atChancesStart: boolean;
}

export interface OpeningsEditorView {
  /** Where a new game may begin, resolved as the start of play resolves it. */
  starts: GameLocation[];
  /** The start the chances describe; null in a world with no locations. */
  chancesStartId: string | null;
  groups: EditorOpeningGroup[];
}

export interface OpeningsEditorSources {
  overview: Overview;
  entities: readonly Entity[];
  locations: readonly GameLocation[];
}

const editorRows = (owner: OpeningOwner, chanceOf: (id: string) => number | null): EditorOpeningRow[] =>
  (owner.openings ?? []).map((opening) => ({
    opening,
    weight: openingWeight(owner.openingWeights, opening.id),
    chance: chanceOf(opening.id),
  }));

/** One owner's rows with chances within its own list, for an entity's Openings tab. */
export function ownerOpeningRows(owner: OpeningOwner): EditorOpeningRow[] {
  const chances = openingChances(owner);
  return editorRows(owner, (id) => chances[id] ?? 0);
}

/**
 * Every opening in the world grouped by owner: the world's rows first, then each authored entity that has
 * openings, in cast order. A chance is the row's share of the whole pool at `startId`, falling back to the
 * first start. The switch is ignored, so a switched-off draft reads the odds it will have.
 */
export function openingsEditorView(
  { overview, entities, locations }: OpeningsEditorSources,
  startId?: string | null,
): OpeningsEditorView {
  const starts = startCandidates(locations);
  const chancesStartId = starts.find((l) => l.id === startId)?.id ?? starts[0]?.id ?? null;
  const pool = openingPool({
    overview: overview && { ...overview, openingsEnabled: undefined },
    entities,
    startingLocationId: chancesStartId,
  });
  const chances = poolChances(pool);
  const shares = new Map(pool.map((e, i) => [poolKey(e), chances[i]]));
  const here = new Set(entityIdsAt(chancesStartId, [...entities]));
  const atAnyStart = new Set(entityIdsAtAny(starts.map((l) => l.id), [...entities]));
  const rowsOf = (owner: OpeningOwner, ownerId: string | null) =>
    editorRows(owner, (id) => shares.get(openingKey(ownerId, id)) ?? 0);

  return {
    starts,
    chancesStartId,
    groups: [
      {
        entity: null, name: overview?.name ?? '', rows: rowsOf(overview ?? {}, null),
        atNoStart: false, atChancesStart: true,
      },
      ...entities.filter((e) => e.openings?.length).map((e) => ({
        entity: e,
        name: e.name,
        rows: here.has(e.id) ? rowsOf(e, e.id) : editorRows(e, () => null),
        atNoStart: !atAnyStart.has(e.id),
        atChancesStart: here.has(e.id),
      })),
    ],
  };
}

/** Every row's text, drawable or not — what chip priming, placement letters and the World Doctor scan. */
export function openingTexts(owner: MaybeOwner): string[] {
  return (owner?.openings ?? []).map((o) => o.text).filter(Boolean);
}

/** The owner's rows under fresh ids, with the weights re-keyed to follow them. Empty for an owner with none. */
export function remintOpenings(owner: OpeningOwner): OpeningOwner {
  if (!owner.openings?.length) return {};
  const idMap = new Map(owner.openings.map((o) => [o.id, randomUUID()] as const));
  const weights = Object.fromEntries(Object.entries(owner.openingWeights ?? {})
    .flatMap(([id, w]) => (idMap.has(id) ? [[idMap.get(id) as string, w]] : [])));
  return {
    openings: owner.openings.map((o) => ({ ...o, id: idMap.get(o.id) as string })),
    openingWeights: weightsOrAbsent(weights),
  };
}

/** An absent map already means every weight is 1, so an empty one is stored as absent. */
const weightsOrAbsent = (weights: Record<string, number>) => (Object.keys(weights).length ? weights : undefined);

const FIELD_KEY_PREFIX = 'openings:';

/** The find bar's target key for one row. */
export const openingFieldKey = (id: string): string => `${FIELD_KEY_PREFIX}${id}`;

/** True for a find-bar key naming an opening row. */
export const isOpeningFieldKey = (key: string | undefined): boolean => !!key?.startsWith(FIELD_KEY_PREFIX);

// ── Editor patches ────────────────────────────────────────────────────────────

/** Turns the world's list on or off; on is stored as absent. */
export function setOpeningsEnabled(on: boolean): Partial<WorldOverview> {
  return { openingsEnabled: on ? undefined : false };
}

/** Appends an empty Opening Action under a fresh id. */
export function addOpening(owner: OpeningOwner): OpeningOwner {
  return { openings: [...(owner.openings ?? []), { id: randomUUID(), text: '', kind: 'action' }] };
}

/** Removes the row and its weight. */
export function removeOpening(owner: OpeningOwner, id: string): OpeningOwner {
  const { [id]: _drop, ...weights } = owner.openingWeights ?? {};
  return {
    openings: (owner.openings ?? []).filter((o) => o.id !== id),
    openingWeights: weightsOrAbsent(weights),
  };
}

/** Replaces one row's text. */
export function setOpeningText(owner: OpeningOwner, id: string, text: string): OpeningOwner {
  return { openings: (owner.openings ?? []).map((o) => (o.id === id ? { ...o, text } : o)) };
}

/** Sets whether one row opens as a Player Action or as Narration. */
export function setOpeningKind(owner: OpeningOwner, id: string, kind: OpeningKind): OpeningOwner {
  return { openings: (owner.openings ?? []).map((o) => (o.id === id ? { ...o, kind } : o)) };
}

/** Stores a weight only when it differs from the default of 1. */
export function setOpeningWeight(owner: OpeningOwner, id: string, weight: number): OpeningOwner {
  const weights = { ...(owner.openingWeights ?? {}) };
  if (weight === 1) delete weights[id];
  else weights[id] = weight;
  return { openingWeights: weightsOrAbsent(weights) };
}

/** Moves the row at `from` to `to`; weights key by id, so they follow. */
export function moveOpening(owner: OpeningOwner, from: number, to: number): OpeningOwner {
  const next = [...(owner.openings ?? [])];
  const [row] = next.splice(from, 1);
  if (row) next.splice(to, 0, row);
  return { openings: next };
}
