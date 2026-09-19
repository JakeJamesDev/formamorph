import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGameData } from './GameDataContext';
import { primeRolls, weightedPick } from '@/lib/placeholders';
import { allPinTexts, valuePinRollChips } from '@/lib/placeholderPins';
import { entityTexts } from '@/lib/entityTexts';
import { openingTexts } from '@/lib/openings';
import { personaPlaceholderSet, primePersonaRolls } from '@/lib/personaPlaceholders';
import type { Entity, Placeholder, PlaceholderRolls } from '@/types';

/**
 * A world session: the frozen placeholder rolls for one playthrough, and the lifecycle that decides when
 * they are drawn and when they are thrown away.
 *
 * Rolls used to live in `GameplayContext`, which mounts only once the game view is on screen — so the
 * pre-game picker screens, which are the surfaces most helped by a settled name, were the ones that could
 * not have one. The session begins earlier (at Enter World) and outlives the game view, so every screen
 * from the trait picker onward reads the same values.
 *
 * The session owns rolls and the Placeholder Set they are drawn from, which a library persona extends.
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
  /** The Placeholder Set play resolves against: the world's list, then the library persona's own. */
  placeholders: Placeholder[];
  /**
   * Set the library persona whose placeholders join the set, or null. Its Wildcards are drawn at once and
   * returned, so a caller that renders in the same pass reads the rolls the session keeps. Earlier rolls stay,
   * so a switch back reads the same values.
   */
  setPersona: (persona: Entity | null) => PlaceholderRolls;
}

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
  const {
    worldOverview, entities, locations, dictionaries, stats, traits, traitGroups, placeholders: worldPlaceholders,
  } = useGameData();
  const placeholders = useMemo(() => personaPlaceholderSet(worldPlaceholders, persona), [worldPlaceholders, persona]);

  // `setPersona` draws against the latest rolls and world list without waiting for a render.
  const rollsRef = useRef(rolls);
  rollsRef.current = rolls;
  const worldPlaceholdersRef = useRef(worldPlaceholders);
  worldPlaceholdersRef.current = worldPlaceholders;

  // Read synchronously by `beginSession`, which can be called twice before React re-renders.
  const activeRef = useRef(false);

  // Re-entrant on purpose: the enter-world flow opens the session, and the handoff into the game view opens
  // it again. Without the guard that second call would discard the rolls the pickers just showed. Seeding
  // rolls (a save resuming) always wins, since that is never the redundant call.
  const beginSession = useCallback((initialRolls?: PlaceholderRolls) => {
    if (initialRolls) setRolls(initialRolls);
    else if (!activeRef.current) {
      setRolls(NO_ROLLS);
      setPersonaState(null);
    }
    activeRef.current = true;
    setSessionActive(true);
  }, []);

  const endSession = useCallback(() => {
    activeRef.current = false;
    setSessionActive(false);
    setRolls(NO_ROLLS);
    setPersonaState(null);
  }, []);

  const setPersona = useCallback((next: Entity | null) => {
    setPersonaState(next);
    if (!next) return rollsRef.current;
    const drawn = primePersonaRolls(worldPlaceholdersRef.current, next, rollsRef.current);
    if (drawn === rollsRef.current) return drawn;
    rollsRef.current = drawn;
    // A roll already in state wins, so an update queued ahead of this one is never overwritten.
    setRolls((prev) => ({
      world: { ...drawn.world, ...prev.world },
      unique: { ...drawn.unique, ...prev.unique },
    }));
    return drawn;
  }, []);

  // Eager priming: roll every Wildcard placement across the world's authored text once the session opens,
  // so resolution stays a pure lookup everywhere else. Names are primed alongside descriptions — a name
  // resolved from an unprimed roll would draw a new value on every render. Trait pins are chip-capable and
  // read the moment their trait is on, so their chips are primed too, whichever traits get picked.
  useEffect(() => {
    if (!sessionActive || placeholders.length === 0) return;
    const texts = [
      worldOverview.systemPrompt || '',
      worldOverview.readme || '',
      worldOverview.introReadme || '',
      ...openingTexts(worldOverview),

      ...entities.flatMap(entityTexts),
      ...locations.flatMap((l) => [l.name, l.playerDescription, l.aiDescription, l.aiSummary, l.description, l.imageTags]),
      ...dictionaries.flatMap((b) => b.entries.flatMap((en) => [en.name, ...(en.key ?? []), ...(en.secondaryKeys ?? []), en.value])),
      ...stats.flatMap((s) => [s.name, s.description, ...(s.descriptors ?? []).map((d) => d.description)]),
      ...traits.flatMap((t) => [t.name, t.playerDescription, t.aiDescription]),
      ...traitGroups.flatMap((g) => [g.name, g.playerDescription, g.aiDescription]),
      ...(persona ? entityTexts(persona) : []),
    ].filter((t): t is string => !!t);
    // Keep the previous object when nothing new was rolled. `primeRolls` always returns a fresh object, and
    // this effect depends on `rolls` so a save restoring mid-session gets its missing placements primed —
    // without the identity guard those two facts are a render loop.
    // A placeholder whose values pin something reads its own world roll, so it gets one whether or not any
    // text places it.
    const pinTexts = allPinTexts({ traits, locations, stats, placeholders });
    setRolls((prev) => {
      const next = primeRolls(placeholders, [...texts, ...valuePinRollChips(placeholders)], prev, weightedPick, pinTexts);
      return sameRolls(prev, next) ? prev : next;
    });
  }, [sessionActive, rolls, placeholders, entities, locations, dictionaries, stats, traits, traitGroups, worldOverview, persona]);

  return (
    <PlaceholderSessionContext.Provider
      value={useMemo(
        () => ({ sessionActive, rolls, setRolls, beginSession, endSession, placeholders, setPersona }),
        [sessionActive, rolls, beginSession, endSession, placeholders, setPersona],
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
