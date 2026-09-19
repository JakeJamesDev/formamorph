import { useCallback, useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { usePlaceholderSession } from '@/contexts/PlaceholderSessionContext';
import { resolvePlaceholders } from '@/lib/placeholders';
import { collectPins, traitScopedPins } from '@/lib/placeholderPins';
import { resolvePersona, type ResolvedPersona } from '@/lib/persona';
import { personaPlaceholderSet } from '@/lib/personaPlaceholders';
import { inAuthoredOrder, refreshChosenTraits, traitOrderIndex } from '@/lib/traitEffects';
import {
  resolveEntityNames, resolveLocationNames, resolveStatNames, resolveTraitNames, resolveTraitGroupNames,
  resolveDictionaryEntryNames,
} from '@/lib/resolveWorldNames';
import type {
  CodePins, Connection, DictionaryEntry, Entity, GameLocation, PlaceholderRolls, PlayerStat, Stat, Trait, TraitGroup,
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
 * Pins are derived from the *authored* world on purpose: the active traits, the current location and each
 * stat's band are decided by id and by number, so they can be known before resolution exists — which breaks
 * the cycle, since the pins those sources carry are an input to resolution itself. Live pins, not the
 * paged-back turn's: stat deltas are keyed by resolved name in the live turn, so a name resolved with a past
 * turn's pins would stop matching them.
 */
export interface ResolvedWorld {
  /** The cast: the authored entities without the one the player plays (see lib/persona). */
  entities: Entity[];
  /** Who the player plays, or null. */
  persona: ResolvedPersona | null;
  /** The persona's name and aliases, which the planner reads as the player. */
  playerNames: string[];
  /** The save names a persona its source no longer holds. False while a library read is in flight. */
  personaUnresolved: boolean;
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
  /** Every pin in force: the active traits', the current location's, each live stat's band's, and the Code
   *  Pins, with value pins settled underneath. */
  pins: Record<string, string>;
  /** `pins` as they would stand under other Code Pins, traits or stats — what a re-roll reads from the
   *  pre-turn ones, and what a turn's own pass reads from writes React has not rendered yet. */
  pinsFor: (codePins: CodePins, over?: PinSources) => Record<string, string>;
  /** Resolve any authored string with the same rolls and pins these collections used. */
  resolvePH: (text: string) => string;
  /** Resolve against a whole pin map of the caller's own, as `pinsFor` builds. */
  resolveFor: (pins: Record<string, string>, text: string) => string;
  /** `resolveTraitText` against a pin map of the caller's own. */
  resolveTraitFor: (pins: Record<string, string>, trait: Trait, text: string) => string;
  /** Resolve with pins not yet in state — for a string written in the same pass that applies the traits
   *  carrying them, which `resolvePH` would resolve against the pins as they stood before. */
  resolveWith: (extraPins: Record<string, string>, text: string) => string;
  /** Resolve opening text, where the Player Name chip reads "you" with no persona. */
  resolveOpening: (text: string, over?: OpeningOverrides) => string;
  /** Resolve a TRAIT'S OWN text (description, its card's stat names): its pins over the active ones, so a
   *  pinning trait reads its own value whatever else is ticked. Trait names in `traits` already use this. */
  resolveTraitText: (trait: Trait, text: string) => string;
}

/** What a new game's first draw knows before React renders it into state. */
export interface OpeningOverrides {
  extraPins?: Record<string, string>;
  /** The persona chosen at entry. Absent, the persona in state is named. */
  persona?: ResolvedPersona | null;
  /** The rolls drawn for that persona, which state does not hold yet. */
  rolls?: PlaceholderRolls;
}

/** The pin-carrying state `pinsFor` reads, where the caller has a copy newer than the one in state. */
export interface PinSources {
  /** The chosen traits as the save holds them, before the world refresh `pinsFor` applies. */
  traits?: Trait[];
  disabledTraitIds?: string[];
  stats?: PlayerStat[];
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
export function useResolvedAuthoredWorld(
  pins: Record<string, string> = NO_PINS,
  /** Who the Player Name chip names. Absent, it reads "the player". */
  personaName: string | null = null,
) {
  const {
    stats: rawStats, locations: rawLocations, connections, entities: rawEntities,
    traits: rawTraits, traitGroups: rawTraitGroups,
  } = useGameData();
  const { rolls, placeholders } = usePlaceholderSession();

  const player = useMemo(() => ({ name: personaName }), [personaName]);
  const resolvePH = useCallback(
    (text: string) => resolvePlaceholders(text, { placeholders, rolls, pins, player }),
    [placeholders, rolls, pins, player],
  );
  const resolveFor = useCallback(
    (withPins: Record<string, string>, text: string) =>
      resolvePlaceholders(text, { placeholders, rolls, pins: withPins, player }),
    [placeholders, rolls, player],
  );
  // Resolve with pins that aren't in state yet. State updates are async, so code that applies traits and
  // then writes a string in the same pass (the init effect's log lines) would otherwise resolve against the
  // pins as they were *before* it ran, and freeze that.
  const resolveWith = useCallback(
    (extraPins: Record<string, string>, text: string) => resolveFor({ ...pins, ...extraPins }, text),
    [resolveFor, pins],
  );
  const resolveOpening = useCallback((text: string, over: OpeningOverrides = {}) => {
    const withPins = { ...pins, ...over.extraPins };
    const set = over.persona?.source === 'library' ? personaPlaceholderSet(placeholders, over.persona.entity) : placeholders;
    const withRolls = over.rolls ?? rolls;
    const name = over.persona === undefined
      ? personaName
      : over.persona && resolvePlaceholders(over.persona.entity.name, { placeholders: set, rolls: withRolls, pins: withPins });
    return resolvePlaceholders(text, { placeholders: set, rolls: withRolls, pins: withPins, player: { name, kind: 'opening' } });
  }, [placeholders, rolls, pins, personaName]);
  const resolveTraitFor = useCallback(
    (withPins: Record<string, string>, trait: Trait, text: string) =>
      resolvePlaceholders(text, { placeholders, rolls, pins: traitScopedPins(trait, withPins, placeholders), player }),
    [placeholders, rolls, player],
  );
  const resolveTraitText = useCallback(
    (trait: Trait, text: string) => resolveTraitFor(pins, trait, text),
    [resolveTraitFor, pins],
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

  return {
    entities, locations, connections, stats, traits, traitGroups,
    resolvePH, resolveFor, resolveWith, resolveOpening, resolveTraitText, resolveTraitFor,
  };
}

const NO_PINS: Record<string, string> = {};

/** The persona's name with its chips resolved, which the Player Name chip renders. Null with no persona. */
export function usePersonaName(rolls: PlaceholderRolls, pins: Record<string, string>): string | null {
  const { entities } = useGameData();
  const { placeholders } = usePlaceholderSession();
  const { personaRef, libraryPersona } = useGameplay();
  // Read from the authored entities, because the resolved ones render the chip this name feeds.
  return useMemo(() => {
    const found = resolvePersona(personaRef, entities, libraryPersona ? [libraryPersona] : []).persona;
    return found ? resolvePlaceholders(found.entity.name, { placeholders, rolls, pins }) : null;
  }, [personaRef, entities, libraryPersona, placeholders, rolls, pins]);
}

export function useResolvedWorld(): ResolvedWorld {
  const { traits: rawTraits, traitGroups: rawTraitGroups, locations: rawLocations } = useGameData();
  const { rolls, placeholders } = usePlaceholderSession();
  const {
    playerStats: rawPlayerStats, viewStats: rawViewStats, runtimeDictionary: rawDictionary,
    currentLocation: storedLocation, playerTraits, disabledTraitIds, codePins,
    personaRef, libraryPersona, personaPending,
  } = useGameplay();

  const traitOrder = useMemo(() => traitOrderIndex(rawTraits, rawTraitGroups), [rawTraits, rawTraitGroups]);
  // The location by id and the stats by number: both are state, so a move or a stat crossing a band
  // re-collects here and every name below follows.
  const storedLocationId = storedLocation?.id;
  const pinsFor = useCallback((withCodePins: CodePins, over: PinSources = {}) => collectPins({
    traits: inAuthoredOrder(refreshChosenTraits(over.traits ?? playerTraits, rawTraits), traitOrder),
    disabledTraitIds: over.disabledTraitIds ?? disabledTraitIds,
    location: rawLocations.find((l) => l.id === storedLocationId),
    stats: over.stats ?? rawPlayerStats,
    placeholders,
    rolls,
    codePins: withCodePins,
  }), [playerTraits, disabledTraitIds, rawTraits, traitOrder, rawLocations, storedLocationId, rawPlayerStats, placeholders, rolls]);
  const pins = useMemo(() => pinsFor(codePins), [pinsFor, codePins]);
  const personaName = usePersonaName(rolls, pins);

  const {
    entities: worldEntities, locations, connections, stats, traits, traitGroups,
    resolvePH, resolveFor, resolveWith, resolveOpening, resolveTraitText, resolveTraitFor,
  } = useResolvedAuthoredWorld(pins, personaName);
  // Resolved like the world's entities, so the side panel and the planner read its name, not its chips.
  const libraryEntities = useMemo(
    () => (libraryPersona ? resolveEntityNames([libraryPersona], resolvePH) : []),
    [libraryPersona, resolvePH],
  );
  const { persona, cast: entities, playerNames, unresolved } = useMemo(
    () => resolvePersona(personaRef, worldEntities, libraryEntities),
    [personaRef, worldEntities, libraryEntities],
  );

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
    entities, persona, playerNames, personaUnresolved: unresolved && !personaPending,
    locations, connections, stats, traits, traitGroups, dictionary, currentLocation,
    playerStats, viewStats, traitOrder, pins, pinsFor,
    resolvePH, resolveFor, resolveWith, resolveOpening, resolveTraitText, resolveTraitFor,
  };
}
