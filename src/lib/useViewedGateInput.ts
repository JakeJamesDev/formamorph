import { useMemo } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { useResolvedWorld } from './useResolvedWorld';
import { inPlayOwners } from './ownedTraitsInPlay';
import { worldEntitiesOf } from './persona';
import { refreshChosenTraits } from './traitEffects';
import { traitGateInput } from './traitRuntime';
import { daypartAt } from './gameClock';
import type { GateInput } from './traitGates';

/** Every owner's traits, stats and clock on the turn on screen, live or paged back (Q34), as the gate module reads them. */
export function useViewedGateInput(): GateInput {
  const { viewTraits, viewDisabledTraitIds, viewOwnedTraits, viewEntityStats, personaRef, viewGameTime, calendar } = useGameplay();
  const daypart = daypartAt(viewGameTime, calendar);
  const { traits, traitGroups, viewStats, entities: cast, persona, traitEntities, traitLibrary } = useResolvedWorld();
  return useMemo(() => traitGateInput(
    {
      // The save froze each chosen trait as the world stood on turn 1; its gate is read from the world.
      traits: refreshChosenTraits(viewTraits, traits),
      disabledTraitIds: viewDisabledTraitIds,
      ownedTraits: viewOwnedTraits,
      stats: viewStats,
      entityStats: viewEntityStats,
    },
    {
      traits, groups: traitGroups, entities: worldEntitiesOf(cast, persona), persona: personaRef ?? { source: 'none' }, daypart,
      ...inPlayOwners({ traits, traitGroups, entities: traitEntities }, personaRef, traitLibrary),
    },
  ), [viewTraits, viewDisabledTraitIds, viewOwnedTraits, viewStats, viewEntityStats, traits, traitGroups, cast, persona, personaRef, daypart, traitEntities, traitLibrary]);
}
