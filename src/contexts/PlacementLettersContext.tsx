import { createContext, useContext, useRef, type ReactNode } from 'react';
import { EMPTY_LETTERS, sameLetters, type PlacementLetters } from '@/lib/placementLetters';

/**
 * The placement-letter index the chip surfaces read: every in-field chip, every read-only pill and every
 * chip vocabulary under the provider letters its Unique chips from one walk of the document. The World
 * Editor binds it to the world; a library modal binds it to the one item it edits. Outside any provider a
 * Unique chip reads `Name (Unique)` rather than a letter, since nothing has walked the text around it.
 */
const PlacementLettersContext = createContext<PlacementLetters>(EMPTY_LETTERS);

// eslint-disable-next-line react-refresh/only-export-components
export const usePlacementLetters = (): PlacementLetters => useContext(PlacementLettersContext);

/**
 * `next` unless it letters the same placements as the last index handed in, in which case that one: the
 * walk runs on every keystroke, and the index's identity is what every chip vocabulary memoizes on. A
 * keystroke that adds no chip must not rebuild them all.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useStablePlacementLetters(next: PlacementLetters): PlacementLetters {
  const ref = useRef(next);
  if (!sameLetters(ref.current, next)) ref.current = next;
  return ref.current;
}

export const PlacementLettersProvider = ({ letters, children }: { letters: PlacementLetters; children: ReactNode }) => (
  <PlacementLettersContext.Provider value={letters}>{children}</PlacementLettersContext.Provider>
);
