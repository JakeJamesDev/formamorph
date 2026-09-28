import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/** A list's search term. `typed` is the trimmed text an add names its item from. */
export type ListSearch = {
  term: string;
  typed: string;
  setTerm: (term: string) => void;
  clear: () => void;
};

/** Holds a list's search term for a `ListSearchToolbar`; the caller reads it to filter and clears it to navigate. */
export function useListSearch(): ListSearch {
  const [term, setTerm] = useState('');
  const clear = useCallback(() => setTerm(''), []);
  return useMemo(() => ({ term, typed: term.trim(), setTerm, clear }), [term, clear]);
}

/** What a + menu's rows use: run an add with the typed text, then clear the box and close the menu. */
export type ListAddApi = { add: (action: (typed: string) => void) => void };

export const ListAddContext = createContext<ListAddApi | null>(null);

/** The menu's add API, for a row that is not a `ListMenuRow` (a drill-in's pick). */
export function useListAdd(): ListAddApi {
  const api = useContext(ListAddContext);
  if (!api) throw new Error('useListAdd needs a ListSearchToolbar menu around it');
  return api;
}
