import { useMemo, useRef } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { evaluateGates, hasAnyGate, sameVerdicts, worldHasGates, type GateVerdicts, type InPlaySource } from '@/lib/inPlayGates';
import { inPlayWorldFrom, playedEntityIdOf, type InPlayWorld } from '@/lib/inPlayWorld';
import { addedCharacters, inPlayLibrary, inPlayOwners } from '@/lib/ownedTraitsInPlay';
import { refreshChosenTraits } from '@/lib/traitEffects';
import { traitGateInput } from '@/lib/traitRuntime';
import { daypartAt } from '@/lib/gameClock';
import type { GateInput } from '@/lib/traitGates';

/** The same verdicts object while the ids it switches off and locks stay the same. */
function useSameVerdicts(verdicts: GateVerdicts): GateVerdicts {
  const last = useRef(verdicts);
  if (last.current !== verdicts && !sameVerdicts(last.current, verdicts)) last.current = verdicts;
  return last.current;
}

/** The In-Play World for the playthrough in state: the one place a hook below GameViewer takes entity and location verdicts from. */
export function useInPlayWorld(): InPlayWorld {
  const { locations, connections, playEntities, traits, traitGroups, items, options } = useGameData();
  const {
    personaRef, libraryPersona, discoveredEntities, globalStats, globalTraits, disabledTraitIds, ownedTraits, entityStats,
    gameTime, calendar, itemCopies, worldOptionValues, currentLocation,
  } = useGameplay();
  const playerAt = currentLocation?.id ?? null;
  const playedEntityId = playedEntityIdOf(personaRef, playEntities);
  const library = useMemo(
    () => inPlayLibrary({ traits, traitGroups, entities: playEntities }, libraryPersona, addedCharacters(discoveredEntities)),
    [traits, traitGroups, playEntities, libraryPersona, discoveredEntities],
  );
  // The library entities, then the runtime characters, each gated by its own rows.
  const others = useMemo(() => {
    const libraryIds = new Set(library.map((e) => e.id));
    return [...library, ...discoveredEntities.map((d) => d.entity).filter((e) => !libraryIds.has(e.id))];
  }, [library, discoveredEntities]);
  const source = useMemo<InPlaySource>(
    () => ({ entities: playEntities, locations, connections, others }),
    [playEntities, locations, connections, others],
  );
  const gated = useMemo(
    () => worldHasGates(playEntities, locations) || others.some(hasAnyGate), [playEntities, locations, others],
  );
  const daypart = daypartAt(gameTime, calendar);
  // Every owner reads as committed, off ones frozen (Q47); built only when some entity or location has a gate.
  const gate = useMemo<GateInput | undefined>(() => (gated ? traitGateInput(
    { traits: refreshChosenTraits(globalTraits, traits), disabledTraitIds, ownedTraits, stats: globalStats, entityStats },
    {
      traits, groups: traitGroups, entities: [...playEntities, ...others], persona: personaRef ?? { source: 'none' }, daypart,
      ...(items.length ? { items } : {}), itemCopies, options, optionValues: worldOptionValues,
      ...inPlayOwners({ traits, traitGroups, entities: playEntities }, personaRef, library),
    },
  ) : undefined), [
    gated, globalTraits, traits, disabledTraitIds, ownedTraits, globalStats, entityStats, traitGroups, playEntities, others, library,
    personaRef, daypart, items, itemCopies, options, worldOptionValues,
  ]);
  const verdicts = useSameVerdicts(useMemo(() => evaluateGates(source, { playedEntityId, playerAt, gate }), [source, playedEntityId, playerAt, gate]));
  return useMemo(() => inPlayWorldFrom(source, verdicts, playedEntityId), [source, verdicts, playedEntityId]);
}
