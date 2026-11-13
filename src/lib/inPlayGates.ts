import type { Connection, Entity, GameLocation, TraitRequirementRow } from '@/types';
import { conditionsOf } from './requirementRows';
import { ruleStates, type GateInput } from './traitGates';

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
  /** Every owner's traits, stats, clock and items as committed, off entities' frozen (Q47). Absent, no gate is
   *  read and everything is on. */
  gate?: GateInput;
}

/** What the gates decided: the ids switched off and the locations locked. */
export interface GateVerdicts {
  offEntityIds: ReadonlySet<string>;
  offLocationIds: ReadonlySet<string>;
  lockedLocationIds: ReadonlySet<string>;
}

const NONE: ReadonlySet<string> = new Set();
export const ALL_OPEN: GateVerdicts = { offEntityIds: NONE, offLocationIds: NONE, lockedLocationIds: NONE };

/** Whether the entity carries an Enabled gate with any row. */
export const hasEnabledGate = (entity: Pick<Entity, 'enabledWhen'>): boolean => !!entity.enabledWhen?.length;

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
  return off.size ? { ...ALL_OPEN, offEntityIds: off } : ALL_OPEN;
}

/** Whether the two verdicts switch off and lock the same ids. */
export function sameVerdicts(a: GateVerdicts, b: GateVerdicts): boolean {
  const same = (x: ReadonlySet<string>, y: ReadonlySet<string>) => x.size === y.size && [...x].every((id) => y.has(id));
  return same(a.offEntityIds, b.offEntityIds) && same(a.offLocationIds, b.offLocationIds) && same(a.lockedLocationIds, b.lockedLocationIds);
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
