import type { Connection, Entity, GameLocation, TraitRequirementRow } from '@/types';
import { presenceOf } from './entityPlaces';
import { locationRuleStates } from './imageVisibility';
import { parentIndex } from './locationGraph';
import { conditionsOf } from './requirementRows';
import { ruleStates, type GateInput, type GateState } from './traitGates';

/** The authored lists the gates read. */
export interface InPlaySource {
  entities: readonly Entity[];
  locations: readonly GameLocation[];
  connections: readonly Connection[];
  /** The library and runtime entities the playthrough holds, each gated by its own rows. */
  others?: readonly Entity[];
}

/** The playthrough state the gates read. */
export interface InPlayState {
  /** The entity the player plays, which is always on. */
  playedEntityId?: string | null;
  /** Where the player stands: it and its subtree stay on while they stand there (Q10, Q49). */
  playerAt?: string | null;
  /** Every owner's traits, stats, clock and items as committed, off entities' frozen (Q47). Absent, no gate is
   *  read and everything is on. */
  gate?: GateInput;
}

/** What the gates decided: the ids switched off and the locations locked. */
export interface GateVerdicts {
  offEntityIds: ReadonlySet<string>;
  offLocationIds: ReadonlySet<string>;
  /** Each locked location: one whose own Lock gate fails, and every location below it (Q53). */
  lockedLocationIds: ReadonlySet<string>;
  /** The locations whose own Lock gate fails, each with its gate, which the lock line reads. */
  lockRoots: ReadonlyMap<string, GateState>;
  /** On entities whose every place is off: in no scene and out of the AI's reach, their stats still running (Q27). */
  strandedEntityIds: ReadonlySet<string>;
}

const NONE: ReadonlySet<string> = new Set();
export const ALL_OPEN: GateVerdicts = {
  offEntityIds: NONE, offLocationIds: NONE, lockedLocationIds: NONE, lockRoots: new Map(), strandedEntityIds: NONE,
};

/** Whether the entity or location carries an Enabled gate with any row. */
export const hasEnabledGate = (host: Pick<Entity | GameLocation, 'enabledWhen'>): boolean => !!host.enabledWhen?.length;

/** Whether the location carries a Lock gate with any row. */
export const hasLockGate = (location: Pick<GameLocation, 'unlockedWhen'>): boolean => !!location.unlockedWhen?.length;

/** Whether the world needs a gate input: some entity or location carries an Enabled gate, or a location a Lock gate. */
export const worldHasGates = (
  entities: readonly Pick<Entity, 'enabledWhen'>[], locations: readonly Pick<GameLocation, 'enabledWhen' | 'unlockedWhen'>[],
) => entities.some(hasEnabledGate) || locations.some((l) => hasEnabledGate(l) || hasLockGate(l));

/** Whether a location's Enabled rows hold: a blank owner reads the played persona (Q29). No rows = on. */
export const locationGateHolds = (input: GateInput, rows: readonly TraitRequirementRow[] | undefined): boolean =>
  !rows?.length || locationRuleStates(input, rows).some((row) => row.holds);

/** `roots` and every location below them. */
function withSubtrees(roots: ReadonlySet<string>, locations: readonly Pick<GameLocation, 'id' | 'parentId'>[]): Set<string> {
  const out = new Set(roots);
  const { childrenOf } = parentIndex(locations);
  const queue = [...roots];
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    for (const child of childrenOf.get(id) ?? []) if (!out.has(child)) { out.add(child); queue.push(child); }
  }
  return out;
}

/** The off locations: each one whose gate fails with its subtree (Q2), less the player's place and its subtree (Q49). */
function offLocations(source: InPlaySource, gate: GateInput, playerAt: string | null | undefined): Set<string> {
  const failed = new Set(source.locations.filter((l) => !locationGateHolds(gate, l.enabledWhen)).map((l) => l.id));
  if (!failed.size) return failed;
  const off = withSubtrees(failed, source.locations);
  if (playerAt && off.has(playerAt)) for (const id of withSubtrees(new Set([playerAt]), source.locations)) off.delete(id);
  return off;
}

/** The locations whose own Lock gate fails, with its gate: a blank owner reads the played persona (Q29). */
function lockRootsOf(source: InPlaySource, gate: GateInput): Map<string, GateState> {
  const roots = new Map<string, GateState>();
  for (const location of source.locations) {
    if (!hasLockGate(location)) continue;
    const rows = locationRuleStates(gate, location.unlockedWhen ?? []);
    if (!rows.some((row) => row.holds)) roots.set(location.id, { unlocked: false, rows });
  }
  return roots;
}

/** The on entities whose places all lie in `offLocations`. One with no places, or Traversable anywhere, never is (Q50). */
function strandedEntities(
  source: InPlaySource, offLocationIds: ReadonlySet<string>, offEntityIds: ReadonlySet<string>, playedEntityId: string | null | undefined,
): Set<string> {
  const stranded = new Set<string>();
  const world = { locations: source.locations, connections: source.connections };
  for (const entity of source.entities) {
    if (entity.id === playedEntityId || offEntityIds.has(entity.id)) continue;
    const { places, anywhere } = presenceOf(entity, world);
    if (!anywhere && places.length && places.every((p) => offLocationIds.has(p.place))) stranded.add(entity.id);
  }
  return stranded;
}

/** Whether `rows`, read from `entityId`, hold: a blank owner reads the entity itself (Q29). No rows = on. */
export const entityGateHolds = (input: GateInput, entityId: string, rows: readonly TraitRequirementRow[] | undefined): boolean =>
  !rows?.length || ruleStates(input, entityId, rows).some((row) => row.holds);

/** Every Enabled and Lock gate in the world, evaluated in one pass against `state.gate` (Q47). */
export function evaluateGates(source: InPlaySource, state: InPlayState): GateVerdicts {
  const { gate } = state;
  if (!gate) return ALL_OPEN;
  const off = new Set<string>();
  for (const entity of [...source.entities, ...source.others ?? []]) {
    if (!hasEnabledGate(entity) || entity.id === state.playedEntityId) continue;
    if (!entityGateHolds(gate, entity.id, entity.enabledWhen)) off.add(entity.id);
  }
  const offPlaces = offLocations(source, gate, state.playerAt);
  const stranded = offPlaces.size ? strandedEntities(source, offPlaces, off, state.playedEntityId) : NONE;
  const lockRoots = lockRootsOf(source, gate);
  if (!off.size && !offPlaces.size && !lockRoots.size) return ALL_OPEN;
  const locked = lockRoots.size ? withSubtrees(new Set(lockRoots.keys()), source.locations) : NONE;
  return { offEntityIds: off, offLocationIds: offPlaces, lockedLocationIds: locked, lockRoots, strandedEntityIds: stranded };
}

/** Whether the two lock-root maps hold the same ids with the same lines. */
const sameLockRoots = (a: ReadonlyMap<string, GateState>, b: ReadonlyMap<string, GateState>) =>
  a.size === b.size && [...a].every(([id, gate]) => b.has(id) && JSON.stringify(b.get(id)) === JSON.stringify(gate));

/** Whether the two verdicts switch off, lock and strand the same ids. */
export function sameVerdicts(a: GateVerdicts, b: GateVerdicts): boolean {
  const same = (x: ReadonlySet<string>, y: ReadonlySet<string>) => x.size === y.size && [...x].every((id) => y.has(id));
  return same(a.offEntityIds, b.offEntityIds) && same(a.offLocationIds, b.offLocationIds)
    && same(a.lockedLocationIds, b.lockedLocationIds) && same(a.strandedEntityIds, b.strandedEntityIds)
    && sameLockRoots(a.lockRoots, b.lockRoots);
}

/** The ids a Condition reads as the entity's own: its traits and groups, linked ones under their original's id,
 *  and `stats`, its resolved stats. */
export const ownGateIds = (entity: Pick<Entity, 'traits' | 'traitGroups' | 'traitLinks'>, stats: readonly { id: string }[]) => {
  const linked = (kind: 'trait' | 'group') => (entity.traitLinks ?? []).filter((l) => l.kind === kind).map((l) => l.originalId);
  return {
    traitIds: new Set([...(entity.traits ?? []).map((t) => t.id), ...linked('trait')]),
    groupIds: new Set([...(entity.traitGroups ?? []).map((g) => g.id), ...linked('group')]),
    statIds: new Set(stats.map((s) => s.id)),
  };
};

/**
 * Whether every Condition of the gate reads the entity itself: its own stats, traits or groups (Q48). Such a gate
 * can never reopen once it fails, since an off entity's state pauses. `own` holds the entity's own trait, group
 * and stat ids.
 */
export function selfLocked(
  entityId: string, rows: readonly TraitRequirementRow[] | undefined,
  own: { traitIds: ReadonlySet<string>; groupIds: ReadonlySet<string>; statIds: ReadonlySet<string> },
): boolean {
  const all = conditionsOf(rows);
  if (!all.length) return false;
  return all.every((req) => {
    if (req.kind !== 'trait' && req.kind !== 'group' && req.kind !== 'stat') return false;
    const owner = req.owner;
    if (owner && !(owner.kind === 'entity' && owner.id === entityId)) return false;
    if (req.kind === 'stat') return own.statIds.has(req.id);
    return (req.kind === 'trait' ? own.traitIds : own.groupIds).has(req.id);
  });
}
