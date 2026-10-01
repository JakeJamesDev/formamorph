import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGameData } from './GameDataContext';
import { primeRolls, weightedPick } from '@/lib/placeholders';
import { bearerPriming } from '@/lib/ownedTraitsInPlay';
import { allPinTexts, valuePinRollChips } from '@/lib/placeholderPins';
import { entityTexts } from '@/lib/entityTexts';
import { overviewTexts } from '@/lib/overviewTexts';
import { bookTexts, libraryPlaceholderSet, primeLibraryRolls } from '@/lib/libraryPlaceholders';
import { sameElements } from '@/lib/placeholderHomes';
import type { Dictionary, Entity, Placeholder, PlaceholderRolls } from '@/types';

/**
 * A world session: the frozen placeholder rolls for one playthrough, and the lifecycle that decides when
 * they are drawn and when they are thrown away.
 *
 * Rolls used to live in `GameplayContext`, which mounts only once the game view is on screen — so the
 * pre-game picker screens, which are the surfaces most helped by a settled name, were the ones that could
 * not have one. The session begins earlier (at Enter World) and outlives the game view, so every screen
 * from the trait picker onward reads the same values.
 *
 * The session owns rolls and the Placeholder Set they are drawn from, which the playthrough's library content
 * extends: the library persona, the characters added at Enter World and the library books picked there.
 * Everything else about a playthrough still lives in `GameplayContext` and still gets a fresh mount per game.
 *
 * A trait can *pin* a placeholder, but a pin is layered over a roll at resolve time and never overwrites
 * it — which is what makes rolling this early safe. A screen can show a rolled value and have it change
 * live as traits are picked, with the roll intact underneath.
 */
interface PlaceholderSession {
  /** True between `beginSession` and `endSession`. Priming only runs while this holds. */
  sessionActive: boolean;
  rolls: PlaceholderRolls;
  setRolls: React.Dispatch<React.SetStateAction<PlaceholderRolls>>;
  /**
   * Start a playthrough. Pass a save's rolls to resume it: they are seeded before priming can run, and
   * priming keeps existing rolls, so a loaded save is never re-rolled.
   */
  beginSession: (initialRolls?: PlaceholderRolls) => void;
  /** End the playthrough and drop its rolls, so the next entry draws fresh ones. */
  endSession: () => void;
  /** The Placeholder Set play resolves against: the world's list, then the library persona's own, then the
   *  added characters' and the library books'. */
  placeholders: Placeholder[];
  /**
   * Set the library persona whose placeholders join the set, or null. Its Wildcards are drawn at once and
   * returned, so a caller that renders in the same pass reads the rolls the session keeps. Earlier rolls stay,
   * so a switch back reads the same values.
   */
  setPersona: (persona: Entity | null) => PlaceholderRolls;
  /** Set the characters added at Enter World and the library books picked there, whose placeholders join the
   *  set. Drawn and returned at once, as `setPersona` draws. */
  setLibraryAdditions: (characters: readonly Entity[], books: readonly Dictionary[]) => PlaceholderRolls;
}

interface LibraryAdditions {
  characters: readonly Entity[];
  books: readonly Dictionary[];
}

const NO_ADDITIONS: LibraryAdditions = { characters: [], books: [] };

/** Every library item whose pool joins the set, in set order. */
const libraryItems = (persona: Entity | null, { characters, books }: LibraryAdditions): (Entity | Dictionary)[] =>
  [...(persona ? [persona] : []), ...characters, ...books];

const PlaceholderSessionContext = createContext<PlaceholderSession | undefined>(undefined);

const NO_ROLLS: PlaceholderRolls = {};

/** Same rolls, key for key. Priming only ever adds keys, so this is an add-nothing check. */
function sameRolls(a: PlaceholderRolls, b: PlaceholderRolls): boolean {
  const same = (x: Record<string, string> = {}, y: Record<string, string> = {}) => {
    const keys = Object.keys(y);
    return keys.length === Object.keys(x).length && keys.every((k) => x[k] === y[k]);
  };
  return same(a.world, b.world) && same(a.unique, b.unique);
}

export function PlaceholderSessionProvider({ children }: { children: ReactNode }) {
  const [sessionActive, setSessionActive] = useState(false);
  const [rolls, setRolls] = useState<PlaceholderRolls>(NO_ROLLS);
  const [persona, setPersonaState] = useState<Entity | null>(null);
  const [additions, setAdditions] = useState<LibraryAdditions>(NO_ADDITIONS);
  const {
    worldOverview, entities, locations, dictionaries, stats, traits, traitGroups, placeholders: worldPlaceholders,
  } = useGameData();
  const placeholders = useMemo(
    () => libraryPlaceholderSet(worldPlaceholders, libraryItems(persona, additions)),
    [worldPlaceholders, persona, additions],
  );

  // The setters draw against the latest rolls, world list and library content without waiting for a render.
  const rollsRef = useRef(rolls);
  rollsRef.current = rolls;
  const worldPlaceholdersRef = useRef(worldPlaceholders);
  worldPlaceholdersRef.current = worldPlaceholders;
  const personaRef = useRef(persona);
  personaRef.current = persona;
  const additionsRef = useRef(additions);
  additionsRef.current = additions;

  // Read synchronously by `beginSession`, which can be called twice before React re-renders.
  const activeRef = useRef(false);

  // Re-entrant on purpose: the enter-world flow opens the session, and the handoff into the game view opens
  // it again. Without the guard that second call would discard the rolls the pickers just showed. Seeding
  // rolls (a save resuming) always wins, since that is never the redundant call.
  // The refs move with the state, so a setter called in the same pass draws against the cleared session.
  const clearSession = useCallback(() => {
    setRolls((rollsRef.current = NO_ROLLS));
    setPersonaState((personaRef.current = null));
    setAdditions((additionsRef.current = NO_ADDITIONS));
  }, []);

  const beginSession = useCallback((initialRolls?: PlaceholderRolls) => {
    if (initialRolls) setRolls(initialRolls);
    else if (!activeRef.current) clearSession();
    activeRef.current = true;
    setSessionActive(true);
  }, [clearSession]);

  const endSession = useCallback(() => {
    activeRef.current = false;
    setSessionActive(false);
    clearSession();
  }, [clearSession]);

  // Draws the items' Wildcards against the whole set the refs hold, and queues the rolls.
  const drawFor = useCallback((items: readonly (Entity | Dictionary)[]) => {
    const set = libraryPlaceholderSet(worldPlaceholdersRef.current, libraryItems(personaRef.current, additionsRef.current));
    const drawn = primeLibraryRolls(set, items, rollsRef.current);
    if (drawn === rollsRef.current) return drawn;
    rollsRef.current = drawn;
    // A roll already in state wins, so an update queued ahead of this one is never overwritten.
    setRolls((prev) => ({
      world: { ...drawn.world, ...prev.world },
      unique: { ...drawn.unique, ...prev.unique },
    }));
    return drawn;
  }, []);

  const setPersona = useCallback((next: Entity | null) => {
    setPersonaState(next);
    personaRef.current = next;
    return next ? drawFor([next]) : rollsRef.current;
  }, [drawFor]);

  const setLibraryAdditions = useCallback((characters: readonly Entity[], books: readonly Dictionary[]) => {
    const prev = additionsRef.current;
    if (sameElements(prev.characters, characters) && sameElements(prev.books, books)) return rollsRef.current;
    const next = { characters, books };
    setAdditions(next);
    additionsRef.current = next;
    return drawFor([...characters, ...books]);
  }, [drawFor]);

  // Eager priming: roll every Wildcard placement across the world's authored text once the session opens,
  // so resolution stays a pure lookup everywhere else. Names are primed alongside descriptions — a name
  // resolved from an unprimed roll would draw a new value on every render. Trait pins are chip-capable and
  // read the moment their trait is on, so their chips are primed too, whichever traits get picked.
  useEffect(() => {
    if (!sessionActive || placeholders.length === 0) return;
    // Each bearer's tree: owned text and linked originals, and pins bound for that bearer.
    const library = [...(persona ? [persona] : []), ...additions.characters];
    const perBearer = bearerPriming({ traits, traitGroups, entities }, library, worldPlaceholders);
    const texts = [
      ...overviewTexts(worldOverview),
      ...entities.flatMap(entityTexts),
      ...locations.flatMap((l) => [l.name, l.playerDescription, l.aiDescription, l.aiSummary, l.description, l.imageTags]),
      ...[...dictionaries, ...additions.books].flatMap(bookTexts),
      ...stats.flatMap((s) => [s.name, s.description, ...(s.descriptors ?? []).map((d) => d.description)]),
      ...traits.flatMap((t) => [t.name, t.playerDescription, t.aiDescription]),
      ...traitGroups.flatMap((g) => [g.name, g.playerDescription, g.aiDescription]),
      ...library.flatMap(entityTexts),
      ...perBearer.texts,
    ].filter((t): t is string => !!t);
    // Keep the previous object when nothing new was rolled. `primeRolls` always returns a fresh object, and
    // this effect depends on `rolls` so a save restoring mid-session gets its missing placements primed —
    // without the identity guard those two facts are a render loop.
    // A placeholder whose values pin something reads its own world roll, so it gets one whether or not any
    // text places it.
    const pinTexts = allPinTexts({
      traits: [...traits, ...perBearer.pinTraits], entities: [...entities, ...library], locations, stats, placeholders,
    });
    setRolls((prev) => {
      let next = primeRolls(placeholders, [...texts, ...valuePinRollChips(placeholders)], prev, weightedPick, pinTexts);
      // A blueprint chip in trait text rolls each bearer's copy, so each bearer's text is walked again through it.
      for (const { texts: own, copies } of perBearer.copyTexts) next = primeRolls(placeholders, own, next, weightedPick, pinTexts, copies);
      return sameRolls(prev, next) ? prev : next;
    });
  }, [
    sessionActive, rolls, placeholders, worldPlaceholders, entities, locations, dictionaries, stats, traits, traitGroups,
    worldOverview, persona, additions,
  ]);

  return (
    <PlaceholderSessionContext.Provider
      value={useMemo(
        () => ({ sessionActive, rolls, setRolls, beginSession, endSession, placeholders, setPersona, setLibraryAdditions }),
        [sessionActive, rolls, beginSession, endSession, placeholders, setPersona, setLibraryAdditions],
      )}
    >
      {children}
    </PlaceholderSessionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlaceholderSession(): PlaceholderSession {
  const ctx = useContext(PlaceholderSessionContext);
  if (!ctx) throw new Error('usePlaceholderSession must be used within a PlaceholderSessionProvider');
  return ctx;
}
