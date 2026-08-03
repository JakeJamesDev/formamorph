import { useCallback, useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { resolvePlaceholders } from '@/lib/placeholders';
import { activePlaceholderPins, inAuthoredOrder, traitOrderIndex } from '@/lib/traitEffects';

/**
 * A gameplay-bound placeholder resolver: replaces `{{ph…}}` chips in authored text with their frozen
 * per-playthrough values (the world's placeholders + the save's rolls). Rolls are primed eagerly when a save
 * activates, so this is a pure lookup — safe to call during render (no `setRoll`). Use at every boundary that
 * emits authored text to the player or the AI.
 *
 * Active traits' placeholder pins are layered on top, so a pinned value reads the same here as it does in
 * the AI's context. The underlying roll is untouched — switching the trait off brings it back.
 */
export function usePlaceholderResolver(): (text: string) => string {
  const { placeholders, traits, traitGroups } = useGameData();
  // View-aliased (equal to live on the latest page): a past page resolves with the pins that were in
  // force on that turn, not whatever the player has toggled since.
  const { placeholderRolls, viewTraits, viewDisabledTraitIds } = useGameplay();
  const pins = useMemo(() => {
    const off = new Set(viewDisabledTraitIds);
    const active = inAuthoredOrder(viewTraits.filter((t) => !off.has(t.id)), traitOrderIndex(traits, traitGroups));
    return activePlaceholderPins(active);
  }, [viewTraits, viewDisabledTraitIds, traits, traitGroups]);
  return useCallback(
    (text: string) => resolvePlaceholders(text, { placeholders, rolls: placeholderRolls, pins }),
    [placeholders, placeholderRolls, pins],
  );
}
