import { useMemo } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { discoveredAsEntities } from '@/lib/runtimeCharacters';
import { normalizeVisibleEntities } from '@/lib/sceneEntities';
import { firstShowableEntity, shownEntityStats, statPanelOptions, statPanelSelection } from '@/lib/statPanelEntities';
import { withTraitToggles, type OwnerStatTraits } from '@/lib/statOwners';
import { hasEntityVisual } from './EntityVisual';

/**
 * The entity the in-game stat panel shows below the player's stats: who the picker lists, which one is shown,
 * and that entity's visible stat rows. With no pick it reads the entity view's own fallback, so both places
 * open on the same entity. `showPicker` is false when no listed entity has a stat the player can see. `inForce`
 * gives each entity's stat traits in force on the viewed turn, which switch its stats on and off.
 */
export function useStatPanelEntity(inForce: OwnerStatTraits) {
  const {
    viewEntityStats, viewVisibleEntities: scene, gameStates, currentPage, discoveredEntities, selectedEntityId,
  } = useGameplay();
  const { entities: cast, persona } = useResolvedWorld();
  const values = useMemo(() => withTraitToggles(viewEntityStats, inForce), [viewEntityStats, inForce]);
  const pickable = useMemo(() => [...cast, ...discoveredAsEntities(discoveredEntities)], [cast, discoveredEntities]);
  const history = useMemo(
    () => [...gameStates.slice(0, currentPage).map((state) => normalizeVisibleEntities(state?.visibleEntities)), scene],
    [gameStates, currentPage, scene],
  );
  const options = useMemo(
    () => statPanelOptions({ entities: pickable, persona: persona?.entity ?? null, scene, history, values, keep: selectedEntityId }),
    [pickable, persona, scene, history, values, selectedEntityId],
  );
  const shownId = statPanelSelection(selectedEntityId, options, firstShowableEntity(scene, pickable, hasEntityVisual)?.id);
  // The persona sits outside the cast but can be picked, so its authored grouping is found through it too.
  const shownEntity = [...pickable, ...(persona ? [persona.entity] : [])].find((entity) => entity.id === shownId);
  return {
    options,
    // The entity's authored stats and groups, which decide where each row sits.
    authored: shownEntity ? { entity: shownEntity, stats: shownEntity.stats ?? [], groups: shownEntity.statGroups ?? [] } : null,
    shown: options.find((option) => option.id === shownId),
    rows: shownEntityStats(shownId ? values[shownId] : undefined),
    showPicker: options.some((option) => shownEntityStats(values[option.id]).length > 0),
  };
}
