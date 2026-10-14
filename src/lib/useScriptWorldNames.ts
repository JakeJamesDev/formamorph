import { useMemo } from 'react';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import type { CodeTraitPlace } from './statCodeAnalysis';
import { statCodeWorldNames, type StatCodeNames } from './statCodeBoxOptions';
import { worldPlaceholderPlaces } from './statCodePlaceholderPlaces';
import { useStatEditorWorld } from './useStatEditorWorld';

/** What every script box in an editor reads: the world's names, and what a template's placeholder slot picks from. */
export interface ScriptWorldNames {
  names: StatCodeNames;
  placeholderPlaces: CodeTraitPlace[];
}

/** The world's names as script boxes read them. Off world, only the placeholders the item carries. */
export function useScriptWorldNames(): ScriptWorldNames {
  const { placeholders, placeholderGroups, placeholderOwners, traits, traitGroups, playEntities, entityGroups, dictionaries } = useStatEditorWorld();
  const playStats = useGameDataOptional()?.playStats;
  // `stats` is the world's play stats in every box.
  const names = useMemo(() => statCodeWorldNames({
    playStats: playStats ?? [], playEntities, traits, traitGroups, entityGroups, placeholders, placeholderOwners, dictionaries,
  }), [playStats, playEntities, traits, traitGroups, entityGroups, placeholders, placeholderOwners, dictionaries]);
  const placeholderPlaces = useMemo(
    () => worldPlaceholderPlaces({ list: placeholders, owners: placeholderOwners, groups: placeholderGroups }),
    [placeholders, placeholderOwners, placeholderGroups],
  );
  return { names, placeholderPlaces };
}
