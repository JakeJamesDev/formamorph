import { useCallback, useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { usePlaceholderSession } from '@/contexts/PlaceholderSessionContext';
import { resolveEntityText, resolvePlaceholders, type ResolveOptions } from '@/lib/placeholders';
import { collectPins } from '@/lib/placeholderPins';
import { inAuthoredOrder, traitOrderIndex } from '@/lib/traitEffects';
import { usePersonaName } from '@/lib/useResolvedWorld';
import type { ResolveEntityText } from '@/lib/resolveWorldNames';

/**
 * A gameplay-bound placeholder resolver: replaces `{{ph…}}` chips in authored text with their frozen
 * per-playthrough values (the session's Placeholder Set + the save's rolls). Rolls are primed eagerly when a save
 * activates, so this is a pure lookup — safe to call during render (no `setRoll`). Use at every boundary that
 * emits authored text to the player or the AI.
 *
 * Every pin in force is layered on top — the active traits', the location's, the stat bands', the Code
 * Pins, and the value pins under them — so a pinned value reads the same here as it does in the AI's context. The
 * underlying roll is untouched — leaving the source's condition brings it back.
 */
export function usePlaceholderResolver(): (text: string) => string {
  const opts = useViewResolveOptions();
  return useCallback((text: string) => resolvePlaceholders(text, opts), [opts]);
}

/** {@link usePlaceholderResolver} for an entity's own text, with that entity as the Character Name. */
export function useEntityTextResolver(): ResolveEntityText {
  const opts = useViewResolveOptions();
  return useCallback<ResolveEntityText>((entity, text) => resolveEntityText(entity, text, opts), [opts]);
}

function useViewResolveOptions(): ResolveOptions {
  const { traits, traitGroups, locations } = useGameData();
  const { placeholders } = usePlaceholderSession();
  // View-aliased (equal to live on the latest page): a past page resolves with the pins that were in
  // force on that turn, not whatever the player has toggled or walked into since.
  const { placeholderRolls, viewTraits, viewDisabledTraitIds, viewStats, viewLocationId, viewCodePins } = useGameplay();
  const pins = useMemo(() => collectPins({
    traits: inAuthoredOrder(viewTraits, traitOrderIndex(traits, traitGroups)),
    disabledTraitIds: viewDisabledTraitIds,
    location: locations.find((l) => l.id === viewLocationId),
    stats: viewStats,
    placeholders,
    rolls: placeholderRolls,
    codePins: viewCodePins,
  }), [
    viewTraits, viewDisabledTraitIds, traits, traitGroups, locations, viewLocationId, viewStats, placeholders,
    placeholderRolls, viewCodePins,
  ]);
  const name = usePersonaName(placeholderRolls, pins);
  return useMemo(
    () => ({ placeholders, rolls: placeholderRolls, pins, player: { name } }),
    [placeholders, placeholderRolls, pins, name],
  );
}
