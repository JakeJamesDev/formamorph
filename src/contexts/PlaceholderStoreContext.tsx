import { createContext, useContext, useState, useMemo, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import type { Placeholder } from '@/types';

/**
 * The placeholder CRUD the placeholder-editing widgets need, scoped to whatever list is being edited.
 * Decouples `PlaceholderList`/`PlaceholderManager`/`PlaceholderEditor` from any specific global store: the
 * World Editor binds this to the current world's placeholders; a standalone library item binds it to an
 * isolated adapter over the placeholders it carries.
 */
export interface PlaceholderStore {
  placeholders: Placeholder[];
  setPlaceholders: Dispatch<SetStateAction<Placeholder[]>>;
  addPlaceholder: (placeholder: Placeholder) => void;
  updatePlaceholder: (updated: Placeholder) => void;
  removePlaceholder: (id: string) => void;
}

/** Build a {@link PlaceholderStore} over any `[value, setValue]` pair — the single source of the CRUD, so both
 *  the world-bound store and the library's isolated adapter derive their mutators the same way. */
// eslint-disable-next-line react-refresh/only-export-components
export function placeholderStore(
  placeholders: Placeholder[],
  setPlaceholders: Dispatch<SetStateAction<Placeholder[]>>,
): PlaceholderStore {
  return {
    placeholders,
    setPlaceholders,
    addPlaceholder: (p) => setPlaceholders((prev) => [...prev, p]),
    updatePlaceholder: (u) => setPlaceholders((prev) => prev.map((p) => (p.id === u.id ? u : p))),
    removePlaceholder: (id) => setPlaceholders((prev) => prev.filter((p) => p.id !== id)),
  };
}

/** Local-state implementation of a `PlaceholderStore`, for a self-owned list (e.g. the world's placeholders). */
// eslint-disable-next-line react-refresh/only-export-components
export function usePlaceholderStoreState(initial: Placeholder[] = []): PlaceholderStore {
  const [placeholders, setPlaceholders] = useState<Placeholder[]>(initial);
  return useMemo(() => placeholderStore(placeholders, setPlaceholders), [placeholders]);
}

const PlaceholderStoreContext = createContext<PlaceholderStore | null>(null);

/** Access the scoped placeholder store; throws if used outside a `PlaceholderStoreProvider`. */
// eslint-disable-next-line react-refresh/only-export-components
export const usePlaceholderStore = (): PlaceholderStore => {
  const store = useContext(PlaceholderStoreContext);
  if (!store) throw new Error('usePlaceholderStore must be used within a PlaceholderStoreProvider');
  return store;
};

/** Provides a `PlaceholderStore` to the placeholder-editing widgets below it. */
export const PlaceholderStoreProvider = ({ value, children }: { value: PlaceholderStore; children: ReactNode }) => (
  <PlaceholderStoreContext.Provider value={value}>{children}</PlaceholderStoreContext.Provider>
);
