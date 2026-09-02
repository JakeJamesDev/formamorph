import { useCallback, useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { resolvePlaceholders } from '@/lib/placeholders';
import { collectPins } from '@/lib/placeholderPins';
import { inAuthoredOrder, traitOrderIndex } from '@/lib/traitEffects';

/**
 * A gameplay-bound placeholder resolver: replaces `{{ph…}}` chips in authored text with their frozen
 * per-playthrough values (the world's placeholders + the save's rolls). Rolls are primed eagerly when a save
 * activates, so this is a pure lookup — safe to call during render (no `setRoll`). Use at every boundary that
 * emits authored text to the player or the AI.
 *
 * Every pin in force is layered on top — the active traits', the location's, the stat bands' and the
 * value pins under them — so a pinned value reads the same here as it does in the AI's context. The
 * underlying roll is untouched — leaving the source's condition brings it back.
 */
export function usePlaceholderResolver(): (text: string) => string {
  const { placeholders, traits, traitGroups, locations } = useGameData();
  // View-aliased (equal to live on the latest page): a past page resolves with the pins that were in
  // force on that turn, not whatever the player has toggled or walked into since.
  const { placeholderRolls, viewTraits, viewDisabledTraitIds, viewStats, viewLocationId } = useGameplay();
  const pins = useMemo(() => collectPins({
    traits: inAuthoredOrder(viewTraits, traitOrderIndex(traits, traitGroups)),
    disabledTraitIds: viewDisabledTraitIds,
    location: locations.find((l) => l.id === viewLocationId),
    stats: viewStats,
    placeholders,
    rolls: placeholderRolls,
  }), [viewTraits, viewDisabledTraitIds, traits, traitGroups, locations, viewLocationId, viewStats, placeholders, placeholderRolls]);
  return useCallback(
    (text: string) => resolvePlaceholders(text, { placeholders, rolls: placeholderRolls, pins }),
    [placeholders, placeholderRolls, pins],
  );
}
