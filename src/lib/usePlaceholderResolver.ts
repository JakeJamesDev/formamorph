import { useCallback, useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { usePlaceholderSession } from '@/contexts/PlaceholderSessionContext';
import { resolveEntityText, resolvePlaceholders, type ResolveOptions } from '@/lib/placeholders';
import { activeOwnedTraitIds, addedCharacters, bearerPins, inPlayLibrary, type PinSet } from '@/lib/ownedTraitsInPlay';
import { inAuthoredOrder, traitOrderIndex } from '@/lib/traitEffects';
import { usePersonaName } from '@/lib/useResolvedWorld';
import type { ResolveEntityText } from '@/lib/resolveWorldNames';

/**
 * A gameplay-bound placeholder resolver: replaces `{{ph…}}` chips in authored text with their frozen
 * per-playthrough values (the session's Placeholder Set + the save's rolls). Rolls are primed eagerly when a save
 * activates, so this is a pure lookup — safe to call during render (no `setRoll`). Use at every boundary that
 * emits authored text to the player or the AI.
 *
 * Every pin in force is layered on top — the player's active traits', the location's, the stat bands', the Code
 * Pins, and the value pins under them — so a pinned value reads the same here as it does in the AI's context. The
 * underlying roll is untouched — leaving the source's condition brings it back.
 */
export function usePlaceholderResolver(): (text: string) => string {
  const { opts } = useViewPins();
  return useCallback((text: string) => resolvePlaceholders(text, opts), [opts]);
}

/** {@link usePlaceholderResolver} for an entity's own text, with that entity as the Character Name. */
export function useEntityTextResolver(): ResolveEntityText {
  const { opts, pinSet } = useViewPins();
  return useCallback<ResolveEntityText>(
    (entity, text) => resolveEntityText(entity, text, { ...opts, pins: pinSet.of(entity.id), copies: pinSet.copies(entity.id) }),
    [opts, pinSet],
  );
}

function useViewPins(): { opts: ResolveOptions; pinSet: PinSet } {
  const { traits, traitGroups, locations, entities, worldPlaceholders } = useGameData();
  const { placeholders } = usePlaceholderSession();
  // View-aliased (equal to live on the latest page): a past page resolves with the pins that were in
  // force on that turn, not whatever the player has toggled or walked into since.
  const {
    placeholderRolls, viewTraits, viewDisabledTraitIds, viewOwnedTraits, viewStats, viewLocationId, viewCodePins,
    personaRef, libraryPersona, discoveredEntities,
  } = useGameplay();
  const pinSet = useMemo(() => bearerPins({
    world: { traits, traitGroups, entities },
    persona: personaRef,
    library: inPlayLibrary({ traits, traitGroups, entities }, libraryPersona, addedCharacters(discoveredEntities)),
    playerTraits: inAuthoredOrder(viewTraits, traitOrderIndex(traits, traitGroups)),
    disabledTraitIds: viewDisabledTraitIds,
    owned: activeOwnedTraitIds(viewOwnedTraits),
    sharedPlaceholders: worldPlaceholders,
  }, {
    location: locations.find((l) => l.id === viewLocationId),
    stats: viewStats,
    placeholders,
    rolls: placeholderRolls,
    codePins: viewCodePins,
  }), [
    viewTraits, viewDisabledTraitIds, viewOwnedTraits, traits, traitGroups, entities, worldPlaceholders, personaRef,
    libraryPersona, discoveredEntities, locations, viewLocationId, viewStats, placeholders, placeholderRolls, viewCodePins,
  ]);
  const pins = pinSet.world;
  const name = usePersonaName(placeholderRolls, pins);
  const opts = useMemo(
    () => ({ placeholders, rolls: placeholderRolls, pins, player: { name } }),
    [placeholders, placeholderRolls, pins, name],
  );
  return { opts, pinSet };
}
