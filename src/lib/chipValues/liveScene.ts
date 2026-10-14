import { useCallback } from 'react';
import type {
  Connection, Entity, GameLocation, OwnedTraitStates, Placeholder, PlayerStat, Trait, TraitGroup,
} from '@/types';
import { entityIdsAt } from '../entityPresence';
import { entityNamed, scenePresentHere, type OwnedTraitsInForce } from '../locationContext';
import { PLAYER_OWNER } from '../traitGates';
import { borneByPlayer, inOwnerPlaces, withOwnerTrees, type OwnerTree } from '../ownedTraitsInPlay';
import type { ResolvedPersona } from '../persona';
import { treeStatTraits } from '../traitRuntime';
import { enabledOwnerStats, withTraitToggles, type OwnerStats } from '../statOwners';
import { resolveEntityTexts, resolveOwnedTraitTexts, type ResolveEntityText } from '../resolveWorldNames';
import { ownerStatParts, type StatPlacement } from '../statContext';
import type { ChipScene, ChipSceneTime } from './chipScene';

/** A trait's own text under its own pins; an owned trait passes its owner. */
export type ResolveTraitText = (trait: Trait, text: string, owner?: Entity | null) => string;

/** The playthrough as the game view holds it, after placeholder resolution. */
export interface LiveSceneSources {
  overview: string;
  /** The stats in force under the active traits. */
  stats: PlayerStat[];
  /** Where the world's stats sit, as authored. */
  statPlacement: StatPlacement;
  /** The traits in force, in authored order. */
  traits: Trait[];
  traitGroups: TraitGroup[];
  /** Each entity's owned trait picks and switch-offs. None when absent. */
  ownedTraits?: OwnedTraitStates;
  /** Each owner's tree, links expanded. An entity with none reads its owned traits alone. */
  owners?: readonly OwnerTree[];
  /** Each entity's stat values. None when absent. */
  entityStats?: OwnerStats;
  /** The entities the player plays as, whose stats are the player's. None when absent. */
  playedEntities?: readonly Entity[];
  resolve: (text: string) => string;
  /** A trait's own text under its own pins, with an owned trait's owner as the Character Name. */
  resolveTrait: ResolveTraitText;
  /** An entity's own text, with that entity as the Character Name. */
  resolveEntity: ResolveEntityText;
  persona: ResolvedPersona | null;
  location: GameLocation | null;
  locations: GameLocation[];
  connections: Connection[];
  /** The authored cast. */
  entities: Entity[];
  /** The authored cast plus every runtime character this playthrough discovered. */
  allEntities: Entity[];
  /** Who the recent turns named as taking part. */
  participants: string[];
  notes: string;
  time: ChipSceneTime | null;
  /** The world's shared placeholders. */
  placeholders: readonly Placeholder[];
}

/** The world under a stat-code before box's writes, which React has not rendered yet. */
export interface SceneWrites {
  activeStats: PlayerStat[];
  activeTraits: Trait[];
  /** Each entity's owned trait state after the box's switches and cascades. */
  ownedTraits: OwnedTraitStates;
  /** Each entity's stat values after the box. Absent keeps the committed ones. */
  entityStats?: OwnerStats;
  resolve: (text: string) => string;
  resolveTrait: ResolveTraitText;
  resolveEntity: ResolveEntityText;
}

/**
 * The playthrough as a Chip Scene, at `location` (the live one when absent) and, when a before box is in
 * flight, under its writes. The scene reads no live state after it is built.
 */
export function liveChipScene(
  sources: LiveSceneSources,
  location?: GameLocation | null,
  box?: SceneWrites | null,
): ChipScene {
  // Each entity's text resolves with that entity as its owner, as trait text resolves under its own pins.
  const resolveEntity = box?.resolveEntity ?? sources.resolveEntity;
  const resolveTrait = box?.resolveTrait ?? sources.resolveTrait;
  // An entity's links join its owned traits, each resolved with the entity as its owner.
  const ownText = (entities: Entity[]) => resolveOwnedTraitTexts(
    resolveEntityTexts(withOwnerTrees(entities, sources.owners), resolveEntity), resolveTrait, resolveEntity,
  );
  const allEntities = ownText(sources.allEntities);
  const persona = sources.persona && { ...sources.persona, entity: ownText([sources.persona.entity])[0] };
  const loc = location ?? sources.location;
  const presentIds = entityIdsAt(loc?.id, allEntities);
  // Who has taken part lately, minus anyone the dialogue merely kept naming: an authored entity who lives
  // elsewhere is dropped, while ad-hoc and just-arrived characters stay (visitors reach `presentIds`
  // through the discovered-entity path). An ad-hoc name matches nobody and rides as a name.
  const inSceneIds: string[] = [];
  const inSceneNames: string[] = [];
  for (const name of scenePresentHere(sources.participants, allEntities, presentIds)) {
    const known = entityNamed(allEntities, name);
    if (known) inSceneIds.push(known.id);
    else inSceneNames.push(name);
  }
  // A trait's own description resolves with its own pins, so the AI reads the same words the player's card
  // shows; the scene's resolve then covers the group headers, since trait text is token-free by then.
  // The player's traits sit in the player owner's tree, so a Custom Persona pick reads at the root.
  const player = sources.owners?.find((b) => b.id === PLAYER_OWNER);
  const traits = inOwnerPlaces(box?.activeTraits ?? sources.traits, player).map((trait) =>
    trait.aiDescription ? { ...trait, aiDescription: resolveTrait(trait, trait.aiDescription) } : trait,
  );

  const ownedInForce = inForceByOwner(box?.ownedTraits ?? sources.ownedTraits);
  // An entity's traits in force switch its stats on and off.
  const ownedStats = enabledOwnerStats(withTraitToggles(box?.entityStats ?? sources.entityStats ?? {}, treeStatTraits(sources.owners ?? [], ownedInForce)));
  return {
    overview: sources.overview,
    stats: box?.activeStats ?? sources.stats,
    statPlacement: sources.statPlacement,
    playedStats: ownerStatParts(sources.playedEntities ?? [], ownedStats),
    playedEntities: ownText([...(sources.playedEntities ?? [])]),
    traits,
    traitGroups: player ? borneByPlayer(player.groups) : sources.traitGroups,
    ownedTraits: ownedInForce,
    ownedStats,
    persona,
    playerName: persona?.entity.name ?? null,
    location: loc,
    locations: sources.locations,
    connections: sources.connections,
    entities: allEntities,
    presentIds,
    inSceneIds,
    // Lore activates per turn inside the narration prompt builder, so the scene carries none.
    lore: [],
    notes: sources.notes,
    time: sources.time,
    resolve: box?.resolve ?? sources.resolve,
    resolveEntity,
    placeholders: sources.placeholders,
    outerScopeEntities: ownText(sources.entities),
    inSceneNames,
  };
}

/** Each entity's chosen owned traits minus the ones switched off. */
function inForceByOwner(states: OwnedTraitStates | undefined): OwnedTraitsInForce {
  return Object.fromEntries(Object.entries(states ?? {}).map(([id, { chosen, disabled = [] }]) => {
    const off = new Set(disabled);
    return [id, chosen.filter((traitId) => !off.has(traitId))];
  }));
}

/** The live adapter: one memoized builder over the playthrough's contexts. */
export function useLiveChipScene(sources: LiveSceneSources): (location?: GameLocation | null, box?: SceneWrites | null) => ChipScene {
  const {
    overview, stats, statPlacement, traits, traitGroups, ownedTraits, owners, entityStats, playedEntities, resolve, resolveTrait, resolveEntity, persona,
    location, locations, connections, entities, allEntities, participants, notes, time, placeholders,
  } = sources;
  return useCallback(
    (at?: GameLocation | null, box?: SceneWrites | null) => liveChipScene({
      overview, stats, statPlacement, traits, traitGroups, ownedTraits, owners, entityStats, playedEntities, resolve, resolveTrait, resolveEntity, persona,
      location, locations, connections, entities, allEntities, participants, notes, time, placeholders,
    }, at, box),
    [
      overview, stats, statPlacement, traits, traitGroups, ownedTraits, owners, entityStats, playedEntities, resolve, resolveTrait, resolveEntity, persona,
      location, locations, connections, entities, allEntities, participants, notes, time, placeholders,
    ],
  );
}
