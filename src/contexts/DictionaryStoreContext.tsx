import { randomUUID } from "@/lib/uuid";
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Dictionary, DictionaryEntry } from '@/types';

/** A fresh, empty "Default" book — the ≥1-book invariant's seed. */
const makeDefaultBook = (): Dictionary => ({ id: randomUUID(), name: 'Default', enabled: true, entries: [] });

/**
 * The book/entry CRUD the dictionary editing widgets need, scoped to whatever collection of books is being
 * edited. Decouples `DictionaryTree`/`DictionaryBookManager`/`DictionaryManager` from any specific global
 * store: the World Editor binds this to the current world's books; the standalone library editor binds it
 * to an isolated single-book store.
 */
export interface DictionaryStore {
  dictionaries: Dictionary[];
  setDictionaries: React.Dispatch<React.SetStateAction<Dictionary[]>>;
  addDictionary: (book: Dictionary) => void;
  updateDictionary: (updated: Dictionary) => void;
  removeDictionary: (bookId: string) => void;
  addDictionaryEntry: (bookId: string, entry: DictionaryEntry) => void;
  updateDictionaryEntry: (entry: DictionaryEntry) => void;
  removeDictionaryEntry: (entryId: string) => void;
}

/**
 * Local-state implementation of a `DictionaryStore`. The single source of the book/entry CRUD, reused by
 * `GameDataContext` (bound to the world's books) and the standalone dictionary editor (an isolated book).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useDictionaryStoreState(initial: Dictionary[] = []): DictionaryStore {
  const [dictionaries, setDictionaries] = useState<Dictionary[]>(initial);

  const addDictionary = useCallback((book: Dictionary) => {
    setDictionaries(prev => [...prev, book]);
  }, []);

  const updateDictionary = useCallback((updated: Dictionary) => {
    setDictionaries(prev => prev.map(book => (book.id === updated.id ? updated : book)));
  }, []);

  // Deleting the last book reseeds an empty "Default" so a collection always has ≥1 book.
  const removeDictionary = useCallback((bookId: string) => {
    setDictionaries(prev => {
      const next = prev.filter(book => book.id !== bookId);
      return next.length ? next : [makeDefaultBook()];
    });
  }, []);

  const addDictionaryEntry = useCallback((bookId: string, newEntry: DictionaryEntry) => {
    setDictionaries(prev => prev.map(book =>
      book.id === bookId ? { ...book, entries: [...book.entries, newEntry] } : book
    ));
  }, []);

  // Entry ids are globally unique, so update/remove search across all books — no book context needed.
  const updateDictionaryEntry = useCallback((updatedEntry: DictionaryEntry) => {
    setDictionaries(prev => prev.map(book => ({
      ...book,
      entries: book.entries.map(entry => (entry.id === updatedEntry.id ? updatedEntry : entry)),
    })));
  }, []);

  const removeDictionaryEntry = useCallback((entryId: string) => {
    setDictionaries(prev => prev.map(book => ({
      ...book,
      entries: book.entries.filter(entry => entry.id !== entryId),
    })));
  }, []);

  return {
    dictionaries, setDictionaries,
    addDictionary, updateDictionary, removeDictionary,
    addDictionaryEntry, updateDictionaryEntry, removeDictionaryEntry,
  };
}

const DictionaryStoreContext = createContext<DictionaryStore | null>(null);

/** Access the scoped dictionary store; throws if used outside a `DictionaryStoreProvider`. */
// eslint-disable-next-line react-refresh/only-export-components
export const useDictionaryStore = (): DictionaryStore => {
  const store = useContext(DictionaryStoreContext);
  if (!store) throw new Error('useDictionaryStore must be used within a DictionaryStoreProvider');
  return store;
};

/** Provides a `DictionaryStore` to the dictionary editing widgets below it. */
export const DictionaryStoreProvider = ({ value, children }: { value: DictionaryStore; children: ReactNode }) => (
  <DictionaryStoreContext.Provider value={value}>{children}</DictionaryStoreContext.Provider>
);
