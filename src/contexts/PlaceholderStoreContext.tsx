import { createContext, useContext, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import type { PlaceholderHome, PlaceholderHomesWorld, PlaceholderOwners, PlaceholderSlices } from '@/lib/placeholderHomes';
import { releasePlaceholderOwners, removePlaceholderCascade } from '@/lib/placeholderTree';
import type { Placeholder } from '@/types';

/**
 * The placeholder CRUD the placeholder-editing widgets need, scoped to whatever list is being edited.
 * Decouples `PlaceholderList`/`PlaceholderManager`/`PlaceholderEditor` from any specific global store: the
 * World Editor binds this to the current world's combined view, routing each write to the list that holds
 * the id; a standalone library item binds it to an isolated adapter over the placeholders it carries.
 */
export interface PlaceholderStore {
  placeholders: Placeholder[];
  setPlaceholders: Dispatch<SetStateAction<Placeholder[]>>;
  /** Add to the list `home` names; absent, the store's own default list (the world's shared one). A store
   *  bound to a single list ignores it. */
  addPlaceholder: (placeholder: Placeholder, home?: PlaceholderHome) => void;
  updatePlaceholder: (updated: Placeholder) => void;
  /** Removes the placeholder and everything it owns — see `removePlaceholderCascade`. */
  removePlaceholder: (id: string) => void;
  /** The ids chips place outside the placeholder list, read only when a drag has to decide whether it may
   *  take a placeholder privately. A thunk, so the scan a world-sized answer needs is paid on the drop
   *  rather than on every render. Omit where nothing outside the list can hold a chip. */
  placedIds?: () => ReadonlySet<string>;
  /** Who owns each scoped placeholder, for the surfaces that read a chip as `Molly.Eyes`. Absent on a store
   *  bound to one list, where nothing is scoped. */
  owners?: PlaceholderOwners;
  /** The world's lists, for the tab that draws an owner node per entity or book and moves records between
   *  them. Absent on a store bound to one list. */
  lists?: PlaceholderHomesWorld;
  /** Write every list at once — what a drop that moves a record between owners needs. */
  setLists?: (next: PlaceholderSlices) => void;
  /** The one list this store edits when it is bound to an owner's own section rather than the whole tab:
   *  the list draws only that owner's rows and a create lands there. Reads still see every placeholder. */
  scope?: PlaceholderHome;
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
    // An edit that drops a chip value releases what it pointed at: where a placeholder sits and what it
    // belongs to can never disagree, and an edit is the only thing that can put them out of step.
    updatePlaceholder: (u) =>
      setPlaceholders((prev) => releasePlaceholderOwners(prev.map((p) => (p.id === u.id ? u : p)))),
    removePlaceholder: (id) => setPlaceholders((prev) => removePlaceholderCascade(prev, id)),
  };
}

const PlaceholderStoreContext = createContext<PlaceholderStore | null>(null);

/** Access the scoped placeholder store; throws if used outside a `PlaceholderStoreProvider`. */
// eslint-disable-next-line react-refresh/only-export-components
export const usePlaceholderStore = (): PlaceholderStore => {
  const store = useContext(PlaceholderStoreContext);
  if (!store) throw new Error('usePlaceholderStore must be used within a PlaceholderStoreProvider');
  return store;
};

/** The store if one is bound, `null` otherwise — for widgets that also render outside an editor, where a
 *  placeholder is only ever displayed and there is nothing to write back to. */
// eslint-disable-next-line react-refresh/only-export-components
export const usePlaceholderStoreOptional = (): PlaceholderStore | null => useContext(PlaceholderStoreContext);

/** Provides a `PlaceholderStore` to the placeholder-editing widgets below it. */
export const PlaceholderStoreProvider = ({ value, children }: { value: PlaceholderStore; children: ReactNode }) => (
  <PlaceholderStoreContext.Provider value={value}>{children}</PlaceholderStoreContext.Provider>
);
