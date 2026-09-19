import { randomUUID } from "@/lib/uuid";
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { markEdited } from '@/lib/linkedContent';
import { followedLibraryId } from '@/lib/publishLinks';
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
  /** Which library items the author owns, so an edit to a copy of one stays Linked. Empty until told. */
  setOwnedLibraryIds: (ids: Iterable<string>) => void;
}

/**
 * Local-state implementation of a `DictionaryStore`. The single source of the book/entry CRUD, reused by
 * `GameDataContext` (bound to the world's books) and the standalone dictionary editor (an isolated book).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useDictionaryStoreState(initial: Dictionary[] = []): DictionaryStore {
  const [dictionaries, setDictionaries] = useState<Dictionary[]>(initial);
  // A ref, not state: read inside the edit callbacks and never rendered.
  const ownedLibraryIds = useRef(new Set<string>());
  const setOwnedLibraryIds = useCallback((ids: Iterable<string>) => {
    ownedLibraryIds.current = new Set(ids);
  }, []);
  const edited = useCallback(
    (book: Dictionary) => markEdited(book, ownedLibraryIds.current.has(followedLibraryId(book) ?? '')),
    [],
  );

  const addDictionary = useCallback((book: Dictionary) => {
    setDictionaries(prev => [...prev, book]);
  }, []);

  // An edit to a book that follows a source makes it a local replacement, unless the author owns the
  // source. A caller that hands over a different `link` is managing the link itself (linking, unlinking,
  // taking a source update), so its record stands: only a content edit, which carries the book's own link
  // through untouched, marks it.
  const updateDictionary = useCallback((updated: Dictionary) => {
    setDictionaries(prev => prev.map(book => (
      book.id === updated.id ? (book.link === updated.link ? edited(updated) : updated) : book
    )));
  }, [edited]);

  // Deleting the last book reseeds an empty "Default" so a collection always has ≥1 book.
  const removeDictionary = useCallback((bookId: string) => {
    setDictionaries(prev => {
      const next = prev.filter(book => book.id !== bookId);
      return next.length ? next : [makeDefaultBook()];
    });
  }, []);

  const addDictionaryEntry = useCallback((bookId: string, newEntry: DictionaryEntry) => {
    setDictionaries(prev => prev.map(book =>
      book.id === bookId ? edited({ ...book, entries: [...book.entries, newEntry] }) : book
    ));
  }, [edited]);

  // Entry ids are globally unique, so update/remove search across all books — no book context needed.
  // The book holding the changed entry is what a source follows, so the edit lands on the book's record.
  const updateDictionaryEntry = useCallback((updatedEntry: DictionaryEntry) => {
    setDictionaries(prev => prev.map(book => (
      book.entries.some(entry => entry.id === updatedEntry.id)
        ? edited({
          ...book,
          entries: book.entries.map(entry => (entry.id === updatedEntry.id ? updatedEntry : entry)),
        })
        : book
    )));
  }, [edited]);

  const removeDictionaryEntry = useCallback((entryId: string) => {
    setDictionaries(prev => prev.map(book => (
      book.entries.some(entry => entry.id === entryId)
        ? edited({ ...book, entries: book.entries.filter(entry => entry.id !== entryId) })
        : book
    )));
  }, [edited]);

  return {
    dictionaries, setDictionaries,
    addDictionary, updateDictionary, removeDictionary,
    addDictionaryEntry, updateDictionaryEntry, removeDictionaryEntry,
    setOwnedLibraryIds,
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

/** Provides a `DictionaryStore` to the dictionary editing widgets below it; null hides the one above. */
export const DictionaryStoreProvider = ({ value, children }: { value: DictionaryStore | null; children: ReactNode }) => (
  <DictionaryStoreContext.Provider value={value}>{children}</DictionaryStoreContext.Provider>
);
