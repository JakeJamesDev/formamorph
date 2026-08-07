import { useCallback, useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { resolvePlaceholders } from '@/lib/placeholders';
import { activePlaceholderPins, inAuthoredOrder, refreshChosenTraits, traitOrderIndex } from '@/lib/traitEffects';
import {
  resolveEntityNames, resolveLocationNames, resolveStatNames, resolveTraitNames, resolveTraitGroupNames,
  resolveDictionaryEntryNames,
} from '@/lib/resolveWorldNames';
import type {
  DictionaryEntry, Entity, GameLocation, PlayerStat, Stat, Trait, TraitGroup,
} from '@/types';

/**
 * The authored world with every name resolved — the one place gameplay should read it from.
 *
 * A name is read for three different jobs (matched against AI prose, used as a map or delta key, and shown
 * to the player), so resolving per use would guarantee drift. This resolves once and hands back the same
 * shapes, which is what makes the many downstream sites correct without knowing placeholders exist.
 *
 * **Reach for this instead of `useGameData()` anywhere below GameViewer.** Reading the context directly gets
 * the authored values with their chips still in them; that is only correct for roll priming, which has to
 * see the chips it is rolling for.
 *
 * Pins are derived from the *authored* traits on purpose: trait order and the active set are decided by id,
 * so they can be known before resolution exists — which breaks the cycle, since the pins those traits carry
 * are an input to resolution itself. Live pins, not the paged-back turn's: stat deltas are keyed by resolved
 * name in the live turn, so a name resolved with a past turn's pins would stop matching them.
 */
export interface ResolvedWorld {
  entities: Entity[];
  locations: GameLocation[];
  stats: Stat[];
  traits: Trait[];
  traitGroups: TraitGroup[];
  /** The runtime dictionary (GameplayContext's), entry by entry. */
  dictionary: DictionaryEntry[];
  playerStats: PlayerStat[];
  viewStats: PlayerStat[];
  traitOrder: ReturnType<typeof traitOrderIndex>;
  traitPins: ReturnType<typeof activePlaceholderPins>;
  /** Resolve any authored string with the same rolls and pins these collections used. */
  resolvePH: (text: string) => string;
}

export function useResolvedWorld(): ResolvedWorld {
  const {
    stats: rawStats, locations: rawLocations, entities: rawEntities,
    traits: rawTraits, traitGroups: rawTraitGroups, placeholders,
  } = useGameData();
  const {
    playerStats: rawPlayerStats, viewStats: rawViewStats, runtimeDictionary: rawDictionary,
    placeholderRolls, playerTraits, disabledTraitIds,
  } = useGameplay();

  const traitOrder = useMemo(() => traitOrderIndex(rawTraits, rawTraitGroups), [rawTraits, rawTraitGroups]);
  const traitPins = useMemo(() => {
    const off = new Set(disabledTraitIds);
    const active = inAuthoredOrder(refreshChosenTraits(playerTraits, rawTraits).filter((t) => !off.has(t.id)), traitOrder);
    return activePlaceholderPins(active);
  }, [playerTraits, disabledTraitIds, rawTraits, traitOrder]);

  const resolvePH = useCallback(
    (text: string) => resolvePlaceholders(text, { placeholders, rolls: placeholderRolls, pins: traitPins }),
    [placeholders, placeholderRolls, traitPins],
  );

  // Each mapper hands back the original array when nothing held a chip, so a world without placeholders
  // produces no new identities and nothing downstream re-renders for this.
  const entities = useMemo(() => resolveEntityNames(rawEntities, resolvePH), [rawEntities, resolvePH]);
  const locations = useMemo(() => resolveLocationNames(rawLocations, resolvePH), [rawLocations, resolvePH]);
  const stats = useMemo(() => resolveStatNames(rawStats, resolvePH), [rawStats, resolvePH]);
  const traits = useMemo(() => resolveTraitNames(rawTraits, resolvePH), [rawTraits, resolvePH]);
  const traitGroups = useMemo(() => resolveTraitGroupNames(rawTraitGroups, resolvePH), [rawTraitGroups, resolvePH]);
  const dictionary = useMemo(() => resolveDictionaryEntryNames(rawDictionary, resolvePH), [rawDictionary, resolvePH]);
  // The save's own stats carry a copy of each authored name, and every stat delta the AI sends is matched by
  // name. Resolved on the way out of state, never in, so the world stays the authority: a re-rolled or
  // re-authored value reaches an existing save on its next load.
  const playerStats = useMemo(() => resolveStatNames(rawPlayerStats, resolvePH), [rawPlayerStats, resolvePH]);
  const viewStats = useMemo(() => resolveStatNames(rawViewStats, resolvePH), [rawViewStats, resolvePH]);

  return {
    entities, locations, stats, traits, traitGroups, dictionary,
    playerStats, viewStats, traitOrder, traitPins, resolvePH,
  };
}
