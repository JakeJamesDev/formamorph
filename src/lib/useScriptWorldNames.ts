import { useMemo } from 'react';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import type { OpeningFoldWorld } from './openingState';
import type { CodeTraitPlace } from './statCodeAnalysis';
import { statCodeWorldNames, type StatCodeNames } from './statCodeBoxOptions';
import { worldPlaceholderPlaces } from './statCodePlaceholderPlaces';
import { useStatEditorWorld } from './useStatEditorWorld';

/** What every script box in an editor reads: the world's names, and what a template's placeholder slot picks from. */
export interface ScriptWorldNames {
  names: StatCodeNames;
  placeholderPlaces: CodeTraitPlace[];
  /** The authored world Test Code opens at turn one. Off world, only the item's placeholders. */
  world: OpeningFoldWorld;
}

/** The world's names as script boxes read them. Off world, only the placeholders the item carries. */
export function useScriptWorldNames(): ScriptWorldNames {
  const { placeholders, placeholderGroups, placeholderOwners, traits, traitGroups, playEntities, entityGroups, dictionaries } = useStatEditorWorld();
  const gameData = useGameDataOptional();
  const playStats = gameData?.playStats;
  const locations = gameData?.locations;
  // `stats` is the world's play stats in every box.
  const names = useMemo(() => statCodeWorldNames({
    playStats: playStats ?? [], playEntities, traits, traitGroups, entityGroups, placeholders, placeholderOwners, dictionaries, locations,
  }), [playStats, playEntities, traits, traitGroups, entityGroups, placeholders, placeholderOwners, dictionaries, locations]);
  const placeholderPlaces = useMemo(
    () => worldPlaceholderPlaces({ list: placeholders, owners: placeholderOwners, groups: placeholderGroups }),
    [placeholders, placeholderOwners, placeholderGroups],
  );
  const stats = gameData?.stats;
  const statGroups = gameData?.statGroups;
  const entities = gameData?.entities;
  const worldPlaceholders = gameData?.worldPlaceholders;
  const connections = gameData?.connections;
  const onWorld = !!gameData;
  const world = useMemo<OpeningFoldWorld>(() => (onWorld ? {
    stats, statGroups, traits, traitGroups, entities, entityGroups, placeholders: worldPlaceholders, placeholderGroups, dictionaries, locations, connections,
  } : { placeholders }), [
    onWorld, stats, statGroups, traits, traitGroups, entities, entityGroups, worldPlaceholders, placeholderGroups, dictionaries, locations, connections,
    placeholders,
  ]);
  return { names, placeholderPlaces, world };
}
