import { ancestors, parentLookup } from '@/lib/ancestors';
import { customPersonaEntity } from '@/lib/blueprints';
import { evaluateGates, worldHasGates, type GateVerdicts, type InPlaySource, type InPlayState } from '@/lib/inPlayGates';
import { startingGateStats } from '@/lib/gateStats';
import { inPlayOwners } from '@/lib/ownedTraitsInPlay';
import { gateLineParts, plainLine, type GateLinePart } from '@/lib/traitGateLine';
import { worldGateInput, type GateInput } from '@/lib/traitGates';
import type {
  Connection, DiscoveredEntity, Entity, GameLocation, PersonaRef, Stat, StatGroup, Trait, TraitGroup, WorldOption, WorldOptionValues,
} from '@/types';

/** What the player reads on a locked location: the author's Locked text, still to resolve, or the lock line. */
export type LockLine = { text: string } | { parts: GateLinePart[] };

/** The line of a lock with nothing left to show. */
export const LOCKED_LINE: LockLine = { parts: ['Locked'] };

/** A lock line as plain text. */
export const lockLinePlain = (line: LockLine, resolveText: (text: string) => string): string =>
  ('text' in line ? resolveText(line.text) : plainLine(line.parts));

/**
 * The world as play sees it: the authored world with its gates applied. Every in-play reader of entities and
 * locations reads this, never the authored lists.
 */
export interface InPlayWorld {
  /** The authored entities that are on and onstage: the scene's, the AI's and the player's list. */
  entities: Entity[];
  /** The authored entities that are on, stranded ones included: the code cast, whose stats and scripts run (Q27). */
  runningEntities: Entity[];
  /** The locations that are on. */
  locations: GameLocation[];
  /** The connections whose ends are both on. */
  connections: Connection[];
  isLocationOn: (locationId: string) => boolean;
  /** On, but no one may move the player in: its own Lock gate fails, or an ancestor's does (Q53). */
  isLocked: (locationId: string) => boolean;
  /** The travel gate (ADR-0018): whether the player at `fromId` may be moved into `toId`. It refuses an off place,
   *  and a locked one unless the player stands inside every lock over it (Q53). */
  canEnter: (fromId: string | null | undefined, toId: string) => boolean;
  /** A locked location's line: its own Locked text, else the nearest lock's Locked text or lock line. Null when open. */
  lockLine: (locationId: string) => LockLine | null;
  /** Every entity a gate turns off: authored, library and runtime. */
  offEntityIds: ReadonlySet<string>;
  /** Whether an entity is on: an authored one, a library one or a runtime one, each by its own gate. */
  isEntityOn: (entity: Pick<Entity, 'id'>) => boolean;
  /** On and not stranded: in reach of scenes, the AI and the player (Q27, Q50). */
  isEntityOnstage: (entity: Pick<Entity, 'id'>) => boolean;
  /** `list` without the entities that are off. The same array when all are on. */
  entitiesOn: <E extends Pick<Entity, 'id'>>(list: readonly E[]) => E[];
  /** The runtime characters that are on. The same array when all are on. */
  discoveredOn: (list: readonly DiscoveredEntity[]) => DiscoveredEntity[];
}

/** The verdicts alone, for lists that do not come from the resolver: runtime and library characters. */
export type InPlayGateView = Omit<InPlayWorld, 'entities' | 'runningEntities' | 'locations' | 'connections'>;

/** The text a Locked text field holds, or null when blank. */
const lockedTextOf = (location: Pick<GameLocation, 'lockedText'> | undefined) => location?.lockedText?.trim() || null;

/** The entity id the persona plays, which no gate turns off. */
export function playedEntityIdOf(persona: PersonaRef | undefined, entities: readonly Entity[]): string | null {
  if (!persona) return null;
  if (persona.source !== 'none') return persona.entityId;
  return customPersonaEntity(entities)?.id ?? null;
}

/** The travel gate at a world's start under `playedEntityId` and the picked `optionValues`, for a reader with no
 *  playthrough. */
export const startTravelGate = (world: StartWorld, playedEntityId: string | null, optionValues?: WorldOptionValues) =>
  startInPlay(world, playedEntityId, optionValues).canEnter;

/** The ids of the locations a new game may open in under `playedEntityId` and the picked `optionValues`: on and
 *  unlocked (Q12, Q43, Q55). */
export function startLocationIdsOpen(world: StartWorld, playedEntityId: string | null, optionValues?: WorldOptionValues): Set<string> {
  const inPlay = startInPlay(world, playedEntityId, optionValues);
  return new Set(inPlay.locations.filter((l) => inPlay.canEnter(null, l.id)).map((l) => l.id));
}

/** Drops what `keep` refuses; the same array when it refuses nothing, so readers see no new identity. */
const kept = <T>(list: readonly T[], keep: (item: T) => boolean): T[] => {
  const out = list.filter(keep);
  return out.length === list.length ? (list as T[]) : out;
};

/** An authored world slice with the off and stranded entities, the off locations and their connections left out.
 *  Same object when all are on. */
export function inPlayWorldData<W extends { entities: Entity[]; locations: GameLocation[]; connections?: Connection[] }>(
  world: W, inPlay: Pick<InPlayWorld, 'isEntityOnstage' | 'isLocationOn'>,
): W {
  const entities = kept(world.entities, inPlay.isEntityOnstage);
  const locations = world.locations.filter((l) => inPlay.isLocationOn(l.id));
  const connections = world.connections?.filter((c) => inPlay.isLocationOn(c.a) && inPlay.isLocationOn(c.b));
  const same = entities.length === world.entities.length && locations.length === world.locations.length
    && connections?.length === world.connections?.length;
  return same ? world : { ...world, entities, locations, ...(connections ? { connections } : {}) };
}

/** The authored slice a reader with no playthrough gates. */
type StartWorld = {
  entities: Entity[]; locations: GameLocation[]; connections?: Connection[];
  traits?: Trait[]; traitGroups?: TraitGroup[]; stats?: Stat[]; statGroups?: StatGroup[]; options?: WorldOption[];
};

/** The gate input of a world at its start under `playedEntityId`: authored stats, no trait picked, and
 *  `optionValues` over each Option's default (Q25). */
export function startGateInput(world: StartWorld, playedEntityId: string | null, optionValues?: WorldOptionValues): GateInput {
  const persona: PersonaRef = playedEntityId ? { source: 'world', entityId: playedEntityId } : { source: 'none' };
  const traits = world.traits ?? [];
  const traitGroups = world.traitGroups ?? [];
  return {
    ...worldGateInput({ traits, groups: traitGroups, entities: world.entities }, persona),
    ...inPlayOwners({ traits, traitGroups, entities: world.entities }, persona),
    stats: startingGateStats(world),
    ...(world.options ? { worldOptions: world.options } : {}),
    ...(optionValues ? { optionValues } : {}),
  };
}

/** An authored world slice as play sees it at its start with `playedEntityId` as the player, for a reader with no
 *  playthrough. `optionValues` are the Test Bench's picks. */
export function inPlayWorldOf<W extends StartWorld>(world: W, playedEntityId: string | null, optionValues?: WorldOptionValues): W {
  return inPlayWorldData(world, startInPlay(world, playedEntityId, optionValues));
}

/** The In-Play World at a world's start, for a reader with no playthrough. */
function startInPlay(world: StartWorld, playedEntityId: string | null, optionValues?: WorldOptionValues): InPlayWorld {
  const source = { entities: world.entities, locations: world.locations, connections: world.connections ?? [] };
  const gate = worldHasGates(world.entities, world.locations) ? startGateInput(world, playedEntityId, optionValues) : undefined;
  return resolveInPlayWorld(source, { playedEntityId, gate });
}

/** The In-Play World for the authored lists under the playthrough state. */
export const resolveInPlayWorld = (source: InPlaySource, state: InPlayState): InPlayWorld =>
  inPlayWorldFrom(source, evaluateGates(source, state), state.playedEntityId ?? null);

/** The In-Play World for the authored lists under verdicts already reached. */
export function inPlayWorldFrom(source: InPlaySource, verdicts: GateVerdicts, playedEntityId: string | null): InPlayWorld {
  const { offEntityIds, offLocationIds, lockedLocationIds, lockRoots, strandedEntityIds } = verdicts;
  const isEntityOn = (entity: Pick<Entity, 'id'>) => entity.id === playedEntityId || !offEntityIds.has(entity.id);
  const isEntityOnstage = (entity: Pick<Entity, 'id'>) => isEntityOn(entity) && !strandedEntityIds.has(entity.id);
  const runningEntities = kept(source.entities, isEntityOn);
  const isLocationOn = (id: string) => !offLocationIds.has(id);
  const entitiesOn = <E extends Pick<Entity, 'id'>>(list: readonly E[]): E[] => kept(list, isEntityOn);
  const parentOf = parentLookup(source.locations, (l) => l.parentId);
  const locationById = new Map(source.locations.map((l) => [l.id, l]));
  const withAncestors = (id: string) => [id, ...ancestors(id, parentOf)];
  /** The locations whose own Lock gate bars `id`, nearest first. */
  const locksOver = (id: string) => (lockedLocationIds.has(id) ? withAncestors(id).filter((at) => lockRoots.has(at)) : []);
  const canEnter = (fromId: string | null | undefined, toId: string) => {
    if (!isLocationOn(toId)) return false;
    const locks = locksOver(toId);
    if (!locks.length) return true;
    const standingIn = fromId ? new Set(withAncestors(fromId)) : new Set<string>();
    return locks.every((lock) => standingIn.has(lock));
  };
  const lockLine = (id: string): LockLine | null => {
    const nearest = locksOver(id)[0];
    if (!nearest) return null;
    const text = lockedTextOf(locationById.get(id)) ?? lockedTextOf(locationById.get(nearest));
    const parts = gateLineParts(lockRoots.get(nearest));
    return text ? { text } : parts ? { parts } : LOCKED_LINE;
  };
  return {
    entities: kept(runningEntities, isEntityOnstage),
    runningEntities,
    locations: kept(source.locations, (l) => isLocationOn(l.id)),
    connections: kept(source.connections, (c) => isLocationOn(c.a) && isLocationOn(c.b)),
    isLocationOn,
    isLocked: (id) => lockedLocationIds.has(id),
    canEnter,
    lockLine,
    offEntityIds: playedEntityId && offEntityIds.has(playedEntityId)
      ? new Set([...offEntityIds].filter((id) => id !== playedEntityId)) : offEntityIds,
    isEntityOn,
    isEntityOnstage,
    entitiesOn,
    discoveredOn: (list) => kept(list, (d) => isEntityOn(d.entity)),
  };
}
