import { useCallback } from 'react';
import type { Connection, Entity, GameLocation, PlayerStat, Trait, TraitGroup } from '@/types';
import { entityIdsAt } from '../entityPresence';
import { entityNamed, scenePresentHere } from '../locationContext';
import type { ResolvedPersona } from '../persona';
import type { ChipScene, ChipSceneTime } from './chipScene';

/** The playthrough as the game view holds it, after placeholder resolution. */
export interface LiveSceneSources {
  overview: string;
  /** The stats in force under the active traits. */
  stats: PlayerStat[];
  /** The traits in force, in authored order. */
  traits: Trait[];
  traitGroups: TraitGroup[];
  resolve: (text: string) => string;
  /** A trait's own text under its own pins. */
  resolveTrait: (trait: Trait, text: string) => string;
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
}

/** The world under a stat-code before box's writes, which React has not rendered yet. */
export interface SceneWrites {
  activeStats: PlayerStat[];
  activeTraits: Trait[];
  resolve: (text: string) => string;
  resolveTrait: (trait: Trait, text: string) => string;
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
  const { allEntities } = sources;
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
  const resolveTrait = box?.resolveTrait ?? sources.resolveTrait;
  const traits = (box?.activeTraits ?? sources.traits).map((trait) =>
    trait.aiDescription ? { ...trait, aiDescription: resolveTrait(trait, trait.aiDescription) } : trait,
  );

  return {
    overview: sources.overview,
    stats: box?.activeStats ?? sources.stats,
    traits,
    traitGroups: sources.traitGroups,
    persona: sources.persona,
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
    outerScopeEntities: sources.entities,
    inSceneNames,
  };
}

/** The live adapter: one memoized builder over the playthrough's contexts. */
export function useLiveChipScene(sources: LiveSceneSources): (location?: GameLocation | null, box?: SceneWrites | null) => ChipScene {
  const {
    overview, stats, traits, traitGroups, resolve, resolveTrait, persona, location, locations, connections,
    entities, allEntities, participants, notes, time,
  } = sources;
  return useCallback(
    (at?: GameLocation | null, box?: SceneWrites | null) => liveChipScene({
      overview, stats, traits, traitGroups, resolve, resolveTrait, persona, location, locations, connections,
      entities, allEntities, participants, notes, time,
    }, at, box),
    [
      overview, stats, traits, traitGroups, resolve, resolveTrait, persona, location, locations, connections,
      entities, allEntities, participants, notes, time,
    ],
  );
}
