import { useMemo } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { useResolvedWorld } from './useResolvedWorld';
import { inPlayOwners } from './ownedTraitsInPlay';
import { worldEntitiesOf } from './persona';
import { refreshChosenTraits } from './traitEffects';
import { traitGateInput, type GateStatState } from './traitRuntime';
import { daypartAt } from './gameClock';
import type { GateInput } from './traitGates';
import type { Trait, WorldOptionValues } from '@/types';

/** One turn's state the gate input reads; its global stats come from the resolved world under `stats`. */
type TurnGateState = Omit<GateStatState, 'stats' | 'traits'> & { traits: Trait[]; stats: 'viewStats' | 'globalStats'; gameTime: number; optionValues: WorldOptionValues };

/** Every owner's traits, stats and clock in one turn, as the gate module reads them. */
function useGateInput({ traits: chosen, disabledTraitIds, ownedTraits, appliedValues, stats: statsKey, entityStats, gameTime, optionValues }: TurnGateState): GateInput {
  const { personaRef, calendar, itemInstances } = useGameplay();
  const gameData = useGameDataOptional();
  const worldItems = gameData?.items;
  const worldOptions = gameData?.options;
  const daypart = daypartAt(gameTime, calendar);
  const resolved = useResolvedWorld();
  const { traits, traitGroups, entities: cast, persona, traitEntities, traitLibrary } = resolved;
  const stats = resolved[statsKey];
  return useMemo(() => traitGateInput(
    // The save froze each chosen trait as the world stood on turn 1; its gate is read from the world.
    { traits: refreshChosenTraits(chosen, traits), disabledTraitIds, ownedTraits, appliedValues, stats, entityStats },
    {
      traits, groups: traitGroups, entities: worldEntitiesOf(cast, persona), persona: personaRef ?? { source: 'none' }, daypart,
      ...(worldItems ? { items: worldItems } : {}), itemInstances, options: worldOptions, optionValues,
      ...inPlayOwners({ traits, traitGroups, entities: traitEntities }, personaRef, traitLibrary),
    },
  ), [chosen, disabledTraitIds, ownedTraits, appliedValues, stats, entityStats, traits, traitGroups, cast, persona, personaRef, daypart, worldItems, itemInstances, worldOptions, optionValues, traitEntities, traitLibrary]);
}

/** The gate input of the turn on screen, live or paged back (Q34). */
export function useViewedGateInput(): GateInput {
  const play = useGameplay();
  return useGateInput({
    traits: play.viewTraits, disabledTraitIds: play.viewDisabledTraitIds, ownedTraits: play.viewOwnedTraits, appliedValues: play.viewAppliedTraitValues,
    stats: 'viewStats', entityStats: play.viewEntityStats, gameTime: play.viewGameTime, optionValues: play.viewWorldOptionValues,
  });
}

/** The gate input of the current turn, whatever page is on screen. */
export function useLiveGateInput(): GateInput {
  const play = useGameplay();
  return useGateInput({
    traits: play.globalTraits, disabledTraitIds: play.disabledTraitIds, ownedTraits: play.ownedTraits, appliedValues: play.appliedTraitValues,
    stats: 'globalStats', entityStats: play.entityStats, gameTime: play.gameTime, optionValues: play.worldOptionValues,
  });
}
