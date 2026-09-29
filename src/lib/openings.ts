import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
import { entityIdsAt, entityIdsAtAny } from '@/lib/entityPresence';
import { locationRows } from '@/lib/locationTree';
import { startCandidates } from '@/lib/startingLocation';
import { randomUUID } from '@/lib/uuid';
import type { ResolvedPersona } from '@/lib/persona';
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
  /** Either mark lets the owner's Self rows show and draw. */
  persona?: boolean;
  customPersona?: boolean;
}

/** One drawable row, its owner and its weight, always above 0. `ownerId` is the entity's id, or null for
 *  the world's and a location's rows. */
export interface PoolEntry {
  ownerId: string | null;
  /** The owning location's id, on a location's rows only. */
  locationId?: string;
  opening: Opening;
  weight: number;
}

type Overview = WorldOverview | null | undefined;
type MaybeOwner = OpeningOwner | null | undefined;

/**
 * Whether the world's list is switched on. `false` is the author switching it off. Absent derives: on once
 * any owner has written an opening, so a world that has none reads off and plays the default opening.
 * `owners` is the world's entities and locations; the overview counts as an owner of its own.
 */
export function openingsEnabled(overview: Overview, owners: readonly MaybeOwner[] = []): boolean {
  if (overview?.openingsEnabled === false) return false;
  return hasAuthoredOpenings(overview) || owners.some(hasAuthoredOpenings);
}

/** Whether this owner has written an opening that can draw. Weight 0 benches one row, so it still counts
 *  here; a Self row counts only on an owner that can own Self rows. */
export function hasAuthoredOpenings(owner: MaybeOwner): boolean {
  return (owner?.openings ?? []).some((o) => o.text.trim().length > 0 && (!o.self || canOwnSelfOpenings(owner)));
}

/** Whether an owner's Self rows exist for the editor and the draw: only a Persona or the Custom Persona entity
 *  has any. */
export const canOwnSelfOpenings = (owner: MaybeOwner): boolean => !!owner?.persona || !!owner?.customPersona;

/** A row's relative weight: 1 unless the author set one. Negatives count as 0. */
export function openingWeight(weights: Record<string, number> | undefined, id: string): number {
  const w = weights?.[id];
  return typeof w === 'number' && Number.isFinite(w) ? Math.max(0, w) : 1;
}

/** The Others rows of one owner that can come up, or its Self rows with `self`, with their weights. A blank
 *  or benched row never draws. */
function drawable(owner: MaybeOwner, ownerId: string | null, self = false): PoolEntry[] {
  if (self && !canOwnSelfOpenings(owner)) return [];
  return (owner?.openings ?? [])
    .filter((o) => o.text.trim() && !!o.self === self)
    .map((opening) => ({ ownerId, opening, weight: openingWeight(owner?.openingWeights, opening.id) }))
    .filter((e) => e.weight > 0);
}

/** A location's rows, keyed as the location's. A location has no Self rows. */
const locationEntries = (location: GameLocation | undefined): PoolEntry[] =>
  (location ? drawable(location, null).map((e) => ({ ...e, locationId: location.id })) : []);

/** What a new playthrough's pool reads: the world, its authored entities and locations, and the chosen
 *  starting location. */
export interface PoolSources {
  overview: Overview;
  entities?: readonly Entity[];
  locations?: readonly GameLocation[];
  startingLocationId?: string | null;
  /** The library entities the player picked at Enter World. */
  picked?: readonly Entity[];
  /** The entity the player plays, whose Self rows replace the pool. */
  persona?: ResolvedPersona | null;
  /** The world's Custom Persona entity, whose Self rows stand in under a library persona that has none. */
  customPersona?: Entity | null;
}

/** The Self rows that replace the pool: the played entity's, or the Custom Persona entity's under a library
 *  persona with none, or with no persona (a reference that no longer resolves plays as None). Under None the
 *  played entity is the Custom Persona entity. */
function personaSelfRows(persona: ResolvedPersona | null | undefined, customPersona: Entity | null | undefined): PoolEntry[] {
  const own = persona ? drawable(persona.entity, persona.entity.id, true) : [];
  if (own.length || persona?.source === 'world' || persona?.source === 'custom' || !customPersona) return own;
  return drawable(customPersona, customPersona.id, true);
}

const selfOnly = (owner: Entity | null | undefined): OpeningOwner | null =>
  (owner ? { ...owner, openings: owner.openings?.filter((o) => o.self) } : null);

/**
 * The rows a new playthrough draws from. The world switch benches every row, whoever owns it. With it on,
 * the persona's Self rows replace everything else; then picked entities with a drawable row do; otherwise
 * the world's own rows, then the starting location's own (never a parent's), then those of the authored
 * entities present there, in cast order. Self rows draw only as the persona's own, or as the Custom Persona
 * entity's in its place.
 */
export function openingPool({
  overview, entities = [], locations = [], startingLocationId, picked = [], persona, customPersona,
}: PoolSources): PoolEntry[] {
  // The played entity's Others rows never draw, so only its Self rows and the Custom Persona entity's can
  // switch the list on.
  const owners = [...entities, ...locations, selfOnly(persona?.entity), selfOnly(customPersona)];
  if (!openingsEnabled(overview, owners)) return [];
  const selfRows = personaSelfRows(persona, customPersona);
  if (selfRows.length) return selfRows;
  const pickedRows = picked.flatMap((e) => drawable(e, e.id));
  if (pickedRows.length) return pickedRows;
  const present = new Set(entityIdsAt(startingLocationId, [...entities]));
  return [
    ...drawable(overview, null),
    ...locationEntries(locations.find((l) => l.id === startingLocationId)),
    ...entities.filter((e) => present.has(e.id)).flatMap((e) => drawable(e, e.id)),
  ];
}

const poolWeight = (pool: readonly PoolEntry[]) => pool.reduce((sum, e) => sum + e.weight, 0);

/** Each row's chance of being drawn from the whole pool, as a percentage, in pool order. */
export function poolChances(pool: readonly PoolEntry[]): number[] {
  const total = poolWeight(pool);
  return pool.map((e) => (total > 0 ? (e.weight / total) * 100 : 0));
}

/** A drawn row, without the weight that drew it. */
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

/** The entity that owns a drawn row, among `entities`, the played persona and the Custom Persona entity, or
 *  null for the world's own row. */
export function openingOwner(
  ownerId: string | null, entities: readonly Entity[], persona?: ResolvedPersona | null, customPersona?: Entity | null,
): Entity | null {
  if (ownerId == null) return null;
  return [...entities, persona?.entity, customPersona].find((e) => e?.id === ownerId) ?? null;
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

/** What the shown list records a row under: owner plus opening id, since ids repeat across owners. A
 *  location's key is its own kind, so an entity and a location that share an id never collide. */
const openingKey = (ownerId: string | null, openingId: string, locationId?: string) =>
  JSON.stringify(locationId === undefined ? [ownerId, openingId] : ['location', locationId, openingId]);

export const poolKey = (entry: PoolEntry): string => openingKey(entry.ownerId, entry.opening.id, entry.locationId);

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

/** Each of one owner's rows' chance of being drawn from that owner's list, as a percentage keyed by id. Self
 *  rows share among the owner's Self rows, Others rows among its Others rows. Ignores the switch, so an author
 *  drafting a switched-off list still reads the odds it will have. */
export function openingChances(owner: MaybeOwner): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of owner?.openings ?? []) out[o.id] = 0;
  for (const self of [false, true]) {
    const pool = drawable(owner, null, self);
    const chances = poolChances(pool);
    pool.forEach((e, i) => { out[e.opening.id] = chances[i]; });
  }
  return out;
}

// ── Editor view ───────────────────────────────────────────────────────────────

/** One row as an editor shows it. A null chance marks a row outside the pool the chances describe. */
export interface EditorOpeningRow {
  opening: Opening;
  /** The row's place in its owner's list, which a filtered list keeps. */
  index: number;
  weight: number;
  chance: number | null;
}

/** One owner's rows in the world panel. The world's own group has neither an entity nor a location. */
export interface EditorOpeningGroup {
  entity: Entity | null;
  location?: GameLocation;
  name: string;
  rows: EditorOpeningRow[];
  /** The rows include Self rows, and each card sets Others or Self. */
  showSelf: boolean;
  /** Shows Others rows but stands at, or is, none of the world's starting locations, so they never come up. */
  atNoStart: boolean;
}

export interface OpeningsEditorView {
  /** Where a new game may begin, resolved as the start of play resolves it. */
  starts: GameLocation[];
  /** Every group shows, and only Self rows carry a chance. Only a world with several starts offers it. */
  allLocations: boolean;
  /** The start the chances describe: the picked or lone start. Null under All Locations and in a world with
   *  no locations. The list filters to it only when it was picked among several. */
  startId: string | null;
  groups: EditorOpeningGroup[];
  /** A game starts on the default opening somewhere the view covers: a start whose pool is empty. */
  defaultOpening: boolean;
  /** Those starts, in start order. Empty in a world with no locations. */
  defaultStarts: GameLocation[];
}

export interface OpeningsEditorSources {
  overview: Overview;
  entities: readonly Entity[];
  locations: readonly GameLocation[];
}

/** The rows an editor lists: Self rows only with `showSelf`. */
const shownOpenings = (owner: OpeningOwner, showSelf: boolean): Opening[] =>
  (owner.openings ?? []).filter((o) => showSelf || !o.self);

/** The owner's shown rows that pass `keep`, each numbered by its place among all of them. */
const editorRows = (
  owner: OpeningOwner, chanceOf: (opening: Opening) => number | null, showSelf = false,
  keep: (opening: Opening) => boolean = () => true,
): EditorOpeningRow[] =>
  shownOpenings(owner, showSelf).map((opening, index) => ({
    opening,
    index,
    weight: openingWeight(owner.openingWeights, opening.id),
    chance: chanceOf(opening),
  })).filter((row) => keep(row.opening));

/** One owner's rows with chances within its own list, for an entity's Openings tab. Self rows show only
 *  with `showSelf`. */
export function ownerOpeningRows(owner: OpeningOwner, showSelf = canOwnSelfOpenings(owner)): EditorOpeningRow[] {
  const chances = openingChances(owner);
  return editorRows(owner, (o) => chances[o.id] ?? 0, showSelf);
}

/**
 * Every opening in the world grouped by owner: the world's rows first, then each location with openings, in
 * the location tree's order, then each authored entity that has openings to show, in cast order.
 *
 * `filter` is a start id, or null for All Locations. A start picked among several keeps what can draw there:
 * the world's rows, the start's own, those of the entities present, and every Self row. A lone start filters
 * nothing, so rows no start reaches keep showing with their badge. An Others row's chance is its share of the
 * start's pool; a Self row's is its share of its owner's Self rows at every filter. The switch is ignored, so
 * a switched-off draft reads the odds it will have.
 */
export function openingsEditorView(
  { overview, entities, locations }: OpeningsEditorSources,
  filter: string | null = null,
): OpeningsEditorView {
  const starts = startCandidates(locations);
  const allLocations = starts.length > 1 && !starts.some((l) => l.id === filter);
  const startId = allLocations ? null : starts.length > 1 ? filter : starts[0]?.id ?? null;
  const filtering = starts.length > 1 && startId !== null;
  const poolAt = (startingLocationId: string | null) => openingPool({
    overview: overview && { ...overview, openingsEnabled: undefined },
    entities,
    locations,
    startingLocationId,
  });
  const pool = poolAt(startId);
  const chances = poolChances(pool);
  const shares = new Map(pool.map((e, i) => [poolKey(e), chances[i]]));
  const othersChance = (key: string, drawsHere: boolean) => (allLocations || !drawsHere ? null : shares.get(key) ?? 0);
  const here = new Set(entityIdsAt(startId, [...entities]));
  const atAnyStart = new Set(entityIdsAtAny(starts.map((l) => l.id), [...entities]));

  const entityGroup = (e: Entity): EditorOpeningGroup => {
    const showSelf = canOwnSelfOpenings(e);
    const own = openingChances(e);
    // A picked start keeps only an absent entity's Self rows, which draw wherever the player plays it.
    const rows = editorRows(
      e, (o) => (o.self ? own[o.id] ?? 0 : othersChance(openingKey(e.id, o.id), here.has(e.id))), showSelf,
      (o) => !filtering || here.has(e.id) || !!o.self,
    );
    return {
      entity: e,
      name: e.name,
      rows,
      showSelf,
      atNoStart: rows.some((r) => !r.opening.self) && !atAnyStart.has(e.id),
    };
  };

  const locationGroup = (l: GameLocation): EditorOpeningGroup => {
    const rows = editorRows(l, (o) => othersChance(openingKey(null, o.id, l.id), l.id === startId));
    return {
      entity: null, location: l, name: l.name, rows, showSelf: false,
      atNoStart: rows.length > 0 && !starts.some((s) => s.id === l.id),
    };
  };

  const covered = allLocations ? starts : starts.filter((l) => l.id === startId);
  const defaultStarts = covered.filter((l) => poolAt(l.id).length === 0);
  return {
    starts,
    allLocations,
    startId,
    groups: [
      {
        entity: null, name: overview?.name ?? '',
        rows: editorRows(overview ?? {}, (o) => othersChance(openingKey(null, o.id), true)),
        showSelf: false, atNoStart: false,
      },
      ...locationRows([...locations]).map(({ location }) => location)
        .filter((l) => !filtering || l.id === startId).map(locationGroup).filter((g) => g.rows.length > 0),
      ...entities.map(entityGroup).filter((g) => g.rows.length > 0),
    ],
    defaultOpening: starts.length === 0 ? pool.length === 0 : defaultStarts.length > 0,
    defaultStarts,
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

/** Marks one row Self or Others; Others is stored as absent. */
export function setOpeningSelf(owner: OpeningOwner, id: string, self: boolean): OpeningOwner {
  return {
    openings: (owner.openings ?? []).map((o) => {
      if (o.id !== id) return o;
      const { self: _drop, ...others } = o;
      return self ? { ...others, self: true } : others;
    }),
  };
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
