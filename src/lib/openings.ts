import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
import { randomUUID } from '@/lib/uuid';
import type { Opening, WorldOverview } from '@/types';

/**
 * Openings: the weighted list a playthrough starts from. Every rule lives here — which rows can be drawn,
 * the draw itself, the chance each row shows, and the patches the editor writes — so the pre-fill, the
 * page-one regenerate, the legacy start message and the Test Bench all read one answer.
 */

/** What a world with nothing to draw opens on. */
export const DEFAULT_OPENING: Opening = { id: 'default', text: OPENING_SCENE_CUE, kind: 'action' };

/** One drawable row and its weight, always above 0. */
export interface PoolEntry {
  opening: Opening;
  weight: number;
}

type Overview = WorldOverview | null | undefined;

/** Whether the world's list is switched on. Absent means on. */
export function openingsEnabled(overview: Overview): boolean {
  return overview?.openingsEnabled !== false;
}

/** A row's relative weight: 1 unless the author set one. Negatives count as 0. */
export function openingWeight(weights: Record<string, number> | undefined, id: string): number {
  const w = weights?.[id];
  return typeof w === 'number' && Number.isFinite(w) ? Math.max(0, w) : 1;
}

/** The rows that can come up, with their weights. A blank or benched row never draws. */
function drawable(openings: readonly Opening[] | undefined, weights: Record<string, number> | undefined): PoolEntry[] {
  return (openings ?? [])
    .filter((o) => o.text.trim())
    .map((opening) => ({ opening, weight: openingWeight(weights, opening.id) }))
    .filter((e) => e.weight > 0);
}

/** The rows a new playthrough draws from. A switched-off list contributes nothing. Takes an object so the
 *  entity sources of the later tickets join as fields. */
export function openingPool({ overview }: { overview: Overview }): PoolEntry[] {
  if (!openingsEnabled(overview)) return [];
  return drawable(overview?.openings, overview?.openingWeights);
}

const poolWeight = (pool: readonly PoolEntry[]) => pool.reduce((sum, e) => sum + e.weight, 0);

/** One opening by weight, or the default when the pool is empty. `random` returns a number in [0, 1). */
export function drawOpening(pool: readonly PoolEntry[], random: () => number): Opening {
  const total = poolWeight(pool);
  if (total <= 0) return DEFAULT_OPENING;
  let r = random() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r < 0) return e.opening;
  }
  return pool[pool.length - 1].opening;
}

/** The opening a new playthrough of this world starts on. */
export function resolveOpening(overview: Overview, random: () => number = Math.random): Opening {
  return drawOpening(openingPool({ overview }), random);
}

/** Each row's chance of being drawn, as a percentage keyed by id. Ignores the switch, so an author drafting
 *  a switched-off list still reads the odds it will have. */
export function openingChances(overview: Overview): Record<string, number> {
  const pool = drawable(overview?.openings, overview?.openingWeights);
  const total = poolWeight(pool);
  const out: Record<string, number> = {};
  for (const o of overview?.openings ?? []) out[o.id] = 0;
  for (const e of pool) out[e.opening.id] = (e.weight / total) * 100;
  return out;
}

/** Every row's text, drawable or not — what chip priming, placement letters and the World Doctor scan. */
export function openingTexts(overview: Overview): string[] {
  return (overview?.openings ?? []).map((o) => o.text).filter(Boolean);
}

const FIELD_KEY_PREFIX = 'openings:';

/** The find bar's target key for one row. */
export const openingFieldKey = (id: string): string => `${FIELD_KEY_PREFIX}${id}`;

/** True for a find-bar key naming an opening row. */
export const isOpeningFieldKey = (key: string | undefined): boolean => !!key?.startsWith(FIELD_KEY_PREFIX);

// ── Editor patches ────────────────────────────────────────────────────────────

type Patch = Partial<WorldOverview>;

/** An absent map already means every weight is 1, so an empty one is stored as absent. */
const weightsOrAbsent = (weights: Record<string, number>) => (Object.keys(weights).length ? weights : undefined);

/** Turns the list on or off; on is stored as absent. */
export function setOpeningsEnabled(on: boolean): Patch {
  return { openingsEnabled: on ? undefined : false };
}

/** Appends an empty Opening Action under a fresh id. */
export function addOpening(overview: WorldOverview): Patch {
  return { openings: [...(overview.openings ?? []), { id: randomUUID(), text: '', kind: 'action' }] };
}

/** Removes the row and its weight. */
export function removeOpening(overview: WorldOverview, id: string): Patch {
  const { [id]: _drop, ...weights } = overview.openingWeights ?? {};
  return {
    openings: (overview.openings ?? []).filter((o) => o.id !== id),
    openingWeights: weightsOrAbsent(weights),
  };
}

/** Replaces one row's text. */
export function setOpeningText(overview: WorldOverview, id: string, text: string): Patch {
  return { openings: (overview.openings ?? []).map((o) => (o.id === id ? { ...o, text } : o)) };
}

/** Stores a weight only when it differs from the default of 1. */
export function setOpeningWeight(overview: WorldOverview, id: string, weight: number): Patch {
  const weights = { ...(overview.openingWeights ?? {}) };
  if (weight === 1) delete weights[id];
  else weights[id] = weight;
  return { openingWeights: weightsOrAbsent(weights) };
}

/** Moves the row at `from` to `to`; weights key by id, so they follow. */
export function moveOpening(overview: WorldOverview, from: number, to: number): Patch {
  const next = [...(overview.openings ?? [])];
  const [row] = next.splice(from, 1);
  if (row) next.splice(to, 0, row);
  return { openings: next };
}
