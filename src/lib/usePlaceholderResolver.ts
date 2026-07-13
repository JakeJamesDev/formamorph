import { useCallback } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { resolvePlaceholders } from '@/lib/placeholders';

/**
 * A gameplay-bound placeholder resolver: replaces `{{ph…}}` chips in authored text with their frozen
 * per-playthrough values (the world's placeholders + the save's rolls). Rolls are primed eagerly when a save
 * activates, so this is a pure lookup — safe to call during render (no `setRoll`). Use at every boundary that
 * emits authored text to the player or the AI.
 */
export function usePlaceholderResolver(): (text: string) => string {
  const { placeholders } = useGameData();
  const { placeholderRolls } = useGameplay();
  return useCallback(
    (text: string) => resolvePlaceholders(text, { placeholders, rolls: placeholderRolls }),
    [placeholders, placeholderRolls],
  );
}
