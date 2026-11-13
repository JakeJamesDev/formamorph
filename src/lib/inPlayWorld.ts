import { customPersonaEntity } from '@/lib/blueprints';
import { evaluateGates, hasEnabledGate, type GateVerdicts, type InPlaySource, type InPlayState } from '@/lib/inPlayGates';
import { startingGateStats } from '@/lib/gateStats';
import { inPlayOwners } from '@/lib/ownedTraitsInPlay';
import { worldGateInput, type GateInput } from '@/lib/traitGates';
import type {
  Connection, DiscoveredEntity, Entity, GameLocation, PersonaRef, Stat, StatGroup, Trait, TraitGroup,
} from '@/types';

/**
 * The world as play sees it: the authored world with its gates applied. Every in-play reader of entities and
 * locations reads this, never the authored lists.
 */
export interface InPlayWorld {
  /** The authored entities that are on. */
  entities: Entity[];
  /** The locations that are on. */
  locations: GameLocation[];
  /** The connections whose ends are both on. */
  connections: Connection[];
  isLocationOn: (locationId: string) => boolean;
  /** On, but no one may move the player in. */
  isLocked: (locationId: string) => boolean;
  /** Every entity a gate turns off: authored, library and runtime. */
  offEntityIds: ReadonlySet<string>;
  /** Whether an entity is on: an authored one, a library one or a runtime one, each by its own gate. */
  isEntityOn: (entity: Pick<Entity, 'id'>) => boolean;
  /** `list` without the entities that are off. The same array when all are on. */
  entitiesOn: <E extends Pick<Entity, 'id'>>(list: readonly E[]) => E[];
  /** The runtime characters that are on. The same array when all are on. */
  discoveredOn: (list: readonly DiscoveredEntity[]) => DiscoveredEntity[];
}

/** The verdicts alone, for lists that do not come from the resolver: runtime and library characters. */
export type InPlayGateView = Omit<InPlayWorld, 'entities' | 'locations' | 'connections'>;

/** The entity id the persona plays, which no gate turns off. */
export function playedEntityIdOf(persona: PersonaRef | undefined, entities: readonly Entity[]): string | null {
  if (!persona) return null;
  if (persona.source !== 'none') return persona.entityId;
  return customPersonaEntity(entities)?.id ?? null;
}

/** An authored world slice with the off entities, locations and connections left out. Same object when all are on. */
export function inPlayWorldData<W extends { entities: Entity[]; locations: GameLocation[]; connections?: Connection[] }>(
  world: W, inPlay: Pick<InPlayWorld, 'entitiesOn' | 'isLocationOn'>,
): W {
  const entities = inPlay.entitiesOn(world.entities);
  const locations = world.locations.filter((l) => inPlay.isLocationOn(l.id));
  const connections = world.connections?.filter((c) => inPlay.isLocationOn(c.a) && inPlay.isLocationOn(c.b));
  const same = entities.length === world.entities.length && locations.length === world.locations.length
    && connections?.length === world.connections?.length;
  return same ? world : { ...world, entities, locations, ...(connections ? { connections } : {}) };
}

/** The authored slice a reader with no playthrough gates. */
type StartWorld = {
  entities: Entity[]; locations: GameLocation[]; connections?: Connection[];
  traits?: Trait[]; traitGroups?: TraitGroup[]; stats?: Stat[]; statGroups?: StatGroup[];
};

/** The gate input of a world at its start under `playedEntityId`: authored stats, no trait picked (Q25). */
export function startGateInput(world: StartWorld, playedEntityId: string | null): GateInput {
  const persona: PersonaRef = playedEntityId ? { source: 'world', entityId: playedEntityId } : { source: 'none' };
  const traits = world.traits ?? [];
  const traitGroups = world.traitGroups ?? [];
  return {
    ...worldGateInput({ traits, groups: traitGroups, entities: world.entities }, persona),
    ...inPlayOwners({ traits, traitGroups, entities: world.entities }, persona),
    stats: startingGateStats(world),
  };
}

/** An authored world slice as play sees it at its start with `playedEntityId` as the player, for a reader with no
 *  playthrough. */
export function inPlayWorldOf<W extends StartWorld>(world: W, playedEntityId: string | null): W {
  const source = { entities: world.entities, locations: world.locations, connections: world.connections ?? [] };
  const gate = world.entities.some(hasEnabledGate) ? startGateInput(world, playedEntityId) : undefined;
  return inPlayWorldData(world, resolveInPlayWorld(source, { playedEntityId, gate }));
}

/** Drops what `keep` refuses; the same array when it refuses nothing, so readers see no new identity. */
const kept = <T>(list: readonly T[], keep: (item: T) => boolean): T[] => {
  const out = list.filter(keep);
  return out.length === list.length ? (list as T[]) : out;
};

/** The In-Play World for the authored lists under the playthrough state. */
export const resolveInPlayWorld = (source: InPlaySource, state: InPlayState): InPlayWorld =>
  inPlayWorldFrom(source, evaluateGates(source, state), state.playedEntityId ?? null);

/** The In-Play World for the authored lists under verdicts already reached. */
export function inPlayWorldFrom(source: InPlaySource, verdicts: GateVerdicts, playedEntityId: string | null): InPlayWorld {
  const { offEntityIds, offLocationIds, lockedLocationIds } = verdicts;
  const isEntityOn = (entity: Pick<Entity, 'id'>) => entity.id === playedEntityId || !offEntityIds.has(entity.id);
  const isLocationOn = (id: string) => !offLocationIds.has(id);
  const entitiesOn = <E extends Pick<Entity, 'id'>>(list: readonly E[]): E[] => kept(list, isEntityOn);
  return {
    entities: kept(source.entities, isEntityOn),
    locations: kept(source.locations, (l) => isLocationOn(l.id)),
    connections: kept(source.connections, (c) => isLocationOn(c.a) && isLocationOn(c.b)),
    isLocationOn,
    isLocked: (id) => lockedLocationIds.has(id),
    offEntityIds: playedEntityId && offEntityIds.has(playedEntityId)
      ? new Set([...offEntityIds].filter((id) => id !== playedEntityId)) : offEntityIds,
    isEntityOn,
    entitiesOn,
    discoveredOn: (list) => kept(list, (d) => isEntityOn(d.entity)),
  };
}
