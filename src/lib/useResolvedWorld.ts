import { useCallback, useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { usePlaceholderSession } from '@/contexts/PlaceholderSessionContext';
import { resolvePlaceholders } from '@/lib/placeholders';
import { activePlaceholderPins, inAuthoredOrder, refreshChosenTraits, traitOrderIndex, traitScopedPins } from '@/lib/traitEffects';
import {
  resolveEntityNames, resolveLocationNames, resolveStatNames, resolveTraitNames, resolveTraitGroupNames,
  resolveDictionaryEntryNames,
} from '@/lib/resolveWorldNames';
import type {
  Connection, DictionaryEntry, Entity, GameLocation, PlayerStat, Stat, Trait, TraitGroup,
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
  /** The authored travel links, forwarded as-is: endpoints are ids and carry no name to resolve. */
  connections: Connection[];
  stats: Stat[];
  traits: Trait[];
  traitGroups: TraitGroup[];
  /** The runtime dictionary (GameplayContext's), entry by entry. */
  dictionary: DictionaryEntry[];
  /** Where the player is, re-read from the resolved world. Gameplay stores a whole location object, so the
   *  copy it holds was resolved when the player arrived — this looks it up again by id, so a pin switched
   *  on since then moves the name everywhere it is read. */
  currentLocation: GameLocation | null;
  playerStats: PlayerStat[];
  viewStats: PlayerStat[];
  traitOrder: ReturnType<typeof traitOrderIndex>;
  traitPins: ReturnType<typeof activePlaceholderPins>;
  /** Resolve any authored string with the same rolls and pins these collections used. */
  resolvePH: (text: string) => string;
  /** Resolve with pins not yet in state — for a string written in the same pass that applies the traits
   *  carrying them, which `resolvePH` would resolve against the pins as they stood before. */
  resolveWith: (extraPins: Record<string, string>, text: string) => string;
  /** Resolve a TRAIT'S OWN text (description, its card's stat names): its pins over the active ones, so a
   *  pinning trait reads its own value whatever else is ticked. Trait names in `traits` already use this. */
  resolveTraitText: (trait: Trait, text: string) => string;
}

/**
 * The authored world resolved against the session's rolls — available anywhere under
 * `PlaceholderSessionProvider`, which is to say from the enter-world flow onward, not just in gameplay.
 *
 * `pins` are the caller's, because the pins that apply differ by screen: in play they come from the active
 * traits, while the trait picker feeds it the *draft* selection so a pinned value updates as the player
 * checks boxes. Pins mask a roll and never overwrite it, so the roll underneath survives an unchecked box.
 *
 * Outside a session the rolls are empty and a Wildcard resolves to nothing. That is deliberate: rolling
 * lazily here would draw a different value on every render, so a missing `beginSession` must show up rather
 * than quietly work.
 */
export function useResolvedAuthoredWorld(pins: Record<string, string> = NO_PINS) {
  const {
    stats: rawStats, locations: rawLocations, connections, entities: rawEntities,
    traits: rawTraits, traitGroups: rawTraitGroups, placeholders,
  } = useGameData();
  const { rolls } = usePlaceholderSession();

  const resolvePH = useCallback(
    (text: string) => resolvePlaceholders(text, { placeholders, rolls, pins }),
    [placeholders, rolls, pins],
  );
  // Resolve with pins that aren't in state yet. State updates are async, so code that applies traits and
  // then writes a string in the same pass (the init effect's log lines) would otherwise resolve against the
  // pins as they were *before* it ran, and freeze that.
  const resolveWith = useCallback(
    (extraPins: Record<string, string>, text: string) =>
      resolvePlaceholders(text, { placeholders, rolls, pins: { ...pins, ...extraPins } }),
    [placeholders, rolls, pins],
  );
  const resolveTraitText = useCallback(
    (trait: Trait, text: string) =>
      resolvePlaceholders(text, { placeholders, rolls, pins: traitScopedPins(trait, pins, placeholders) }),
    [placeholders, rolls, pins],
  );

  // Each mapper hands back the original array when nothing held a chip, so a world without placeholders
  // produces no new identities and nothing downstream re-renders for this.
  const entities = useMemo(() => resolveEntityNames(rawEntities, resolvePH), [rawEntities, resolvePH]);
  const locations = useMemo(() => resolveLocationNames(rawLocations, resolvePH), [rawLocations, resolvePH]);
  const stats = useMemo(() => resolveStatNames(rawStats, resolvePH), [rawStats, resolvePH]);
  const traits = useMemo(
    () => resolveTraitNames(rawTraits, (t) => (text) => resolveTraitText(t, text)),
    [rawTraits, resolveTraitText],
  );
  const traitGroups = useMemo(() => resolveTraitGroupNames(rawTraitGroups, resolvePH), [rawTraitGroups, resolvePH]);

  return { entities, locations, connections, stats, traits, traitGroups, resolvePH, resolveWith, resolveTraitText };
}

const NO_PINS: Record<string, string> = {};

export function useResolvedWorld(): ResolvedWorld {
  const { traits: rawTraits, traitGroups: rawTraitGroups, placeholders } = useGameData();
  const {
    playerStats: rawPlayerStats, viewStats: rawViewStats, runtimeDictionary: rawDictionary,
    currentLocation: storedLocation, playerTraits, disabledTraitIds,
  } = useGameplay();

  const traitOrder = useMemo(() => traitOrderIndex(rawTraits, rawTraitGroups), [rawTraits, rawTraitGroups]);
  const traitPins = useMemo(() => {
    const off = new Set(disabledTraitIds);
    const active = inAuthoredOrder(refreshChosenTraits(playerTraits, rawTraits).filter((t) => !off.has(t.id)), traitOrder);
    return activePlaceholderPins(active, placeholders);
  }, [playerTraits, disabledTraitIds, rawTraits, traitOrder, placeholders]);

  const {
    entities, locations, connections, stats, traits, traitGroups, resolvePH, resolveWith, resolveTraitText,
  } = useResolvedAuthoredWorld(traitPins);

  // Every write to gameplay's `currentLocation` is a member of `locations`, so its id is the durable part —
  // the object it stored is a snapshot of how the name read on arrival. Falls back to the stored copy for a
  // location the world no longer has.
  const currentLocation = useMemo(
    () => (storedLocation ? locations.find((l) => l.id === storedLocation.id) ?? storedLocation : null),
    [storedLocation, locations],
  );

  const dictionary = useMemo(() => resolveDictionaryEntryNames(rawDictionary, resolvePH), [rawDictionary, resolvePH]);
  // The save's own stats carry a copy of each authored name, and every stat delta the AI sends is matched by
  // name. Resolved on the way out of state, never in, so the world stays the authority: a re-rolled or
  // re-authored value reaches an existing save on its next load.
  const playerStats = useMemo(() => resolveStatNames(rawPlayerStats, resolvePH), [rawPlayerStats, resolvePH]);
  const viewStats = useMemo(() => resolveStatNames(rawViewStats, resolvePH), [rawViewStats, resolvePH]);

  return {
    entities, locations, connections, stats, traits, traitGroups, dictionary, currentLocation,
    playerStats, viewStats, traitOrder, traitPins, resolvePH, resolveWith, resolveTraitText,
  };
}
