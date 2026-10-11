import { useMemo } from 'react';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { usePlaceholderStoreOptional } from '@/contexts/PlaceholderStoreContext';
import { usePlacementLetters } from '@/contexts/PlacementLettersContext';
import { NO_OWNERS } from './placeholderHomes';

type World = NonNullable<ReturnType<typeof useGameDataOptional>>;

/** What the stat editor reads of the world: the lists its chips, code names and completions draw on. */
export type StatEditorWorld = Pick<World,
  'placeholders' | 'placeholderGroups' | 'placeholderOwners' | 'placementLetters' | 'traits' | 'traitGroups' | 'playEntities'
  | 'entityGroups' | 'dictionaries'>;

/**
 * The world's lists for the stat editor. Off world, as in the library entity editor, only the placeholders the
 * item carries exist; every other list is empty.
 */
export function useStatEditorWorld(): StatEditorWorld {
  const world = useGameDataOptional();
  const store = usePlaceholderStoreOptional();
  const letters = usePlacementLetters();
  const placeholders = store?.placeholders;
  return useMemo(() => world ?? {
    placeholders: placeholders ?? [],
    placeholderGroups: [],
    placeholderOwners: NO_OWNERS,
    placementLetters: letters,
    traits: [],
    traitGroups: [],
    playEntities: [],
    entityGroups: [],
    dictionaries: [],
  }, [world, placeholders, letters]);
}
