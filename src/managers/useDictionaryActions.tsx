import { useState, type ReactNode } from 'react';
import { OPEN_TREE, revealKeys, type TreeCollapse, type TreeCollapseState } from '@/components/treeCollapse';
import { Copy, FilePlus, X } from 'lucide-react';
import type { ListEditorRow } from '@/components/listEditorHooks';
import { useDictionaryStore } from '@/contexts/DictionaryStoreContext';
import { blankDictionaryEntry, dictionaryEntryLabel, duplicateEntryInBooks } from '@/lib/dictionaryTree';
import { OWNER_NAME_SEPARATOR } from '@/lib/placementLetters';
import type { Dictionary } from '@/types';
import { useRemoveBook } from './useRemoveBook';

/** Which books and zones the dictionary tree folds. A host holds it so a search, which unmounts the tree, keeps it. */
export type DictionaryCollapse = {
  collapsed: ReadonlySet<string>;
  toggle: (bookId: string) => void;
  expand: (bookId: string) => void;
  /** Zone keys, `<bookId>:<position>`. */
  zones: ReadonlySet<string>;
  toggleZone: (key: string) => void;
  /** The selection whose book and zone the tree last opened. */
  revealed: string | null;
  /** Opens the given books and zones for a newly selected entry, and records the selection as revealed. */
  reveal: (selectedId: string, keys: readonly string[]) => void;
};

const toggled = (set: ReadonlySet<string>, key: string) => {
  const next = new Set(set);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
};

/** Books and zones share one set. A host's `TreeCollapse` keeps it for the visit; without one the set is local. */
export function useDictionaryCollapse(host?: TreeCollapse): DictionaryCollapse {
  const [own, setOwn] = useState<TreeCollapseState>(OPEN_TREE);
  const state = host?.value ?? own;
  const update = host?.update ?? setOwn;
  const toggle = (key: string) => update((prev) => ({ ...prev, collapsed: toggled(prev.collapsed, key) }));
  return {
    collapsed: state.collapsed,
    zones: state.collapsed,
    toggle,
    toggleZone: toggle,
    expand: (bookId) => update((prev) => {
      if (!prev.collapsed.has(bookId)) return prev;
      const next = new Set(prev.collapsed);
      next.delete(bookId);
      return { ...prev, collapsed: next };
    }),
    revealed: state.revealed,
    reveal: (selectedId, keys) => update((prev) => revealKeys(prev, selectedId, keys)),
  };
}

export type DictionaryActions = {
  /** Adds an entry to the book, unfolds the book, and selects the entry. */
  addEntry: (bookId: string, name?: string) => void;
  duplicateEntry: (id: string) => void;
  removeEntry: (id: string) => void;
  /** Asks before it deletes the book. */
  askRemoveBook: (bookId: string) => void;
  /** The book delete confirmation; the caller renders it. */
  dialog: ReactNode;
};

/** The dictionary list's row actions, shared by the tree and the flat search rows. */
export function useDictionaryActions({ selectedId, onSelect, collapse }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  collapse: DictionaryCollapse;
}): DictionaryActions {
  const { dictionaries, setDictionaries, addDictionaryEntry, removeDictionaryEntry } = useDictionaryStore();
  const { ask: askRemoveBook, dialog } = useRemoveBook({ selectedId, onSelect });
  return {
    addEntry: (bookId, name = '') => {
      const entry = blankDictionaryEntry(name);
      addDictionaryEntry(bookId, entry);
      collapse.expand(bookId);
      onSelect(entry.id);
    },
    duplicateEntry: (id) => {
      const { books, newId } = duplicateEntryInBooks(dictionaries, id);
      setDictionaries(books);
      if (newId) onSelect(newId);
    },
    removeEntry: (id) => { removeDictionaryEntry(id); if (id === selectedId) onSelect(null); },
    askRemoveBook,
    dialog,
  };
}

/**
 * The flat search rows over the books, with the tree rows' actions. `withBooks` lists each book and reads its
 * entries as `Book › Entry`; without it, entries read bare, for a host that edits one book.
 */
export function dictionarySearchRows(dictionaries: Dictionary[], actions: DictionaryActions, withBooks: boolean): ListEditorRow[] {
  return dictionaries.flatMap((book) => [
    ...(withBooks ? [{
      id: book.id,
      name: book.name,
      labelClass: 'font-medium',
      actions: [
        { icon: <FilePlus className="h-4 w-4" />, title: 'Add entry', onClick: () => actions.addEntry(book.id) },
        { icon: <X className="h-4 w-4" />, destructive: true, title: 'Delete dictionary', onClick: () => actions.askRemoveBook(book.id) },
      ],
    }] : []),
    ...book.entries.map((entry): ListEditorRow => ({
      id: entry.id,
      name: withBooks ? `${book.name}${OWNER_NAME_SEPARATOR}${dictionaryEntryLabel(entry)}` : dictionaryEntryLabel(entry),
      actions: [
        { icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => actions.duplicateEntry(entry.id) },
        { icon: <X className="h-4 w-4" />, destructive: true, title: 'Delete', onClick: () => actions.removeEntry(entry.id) },
      ],
    })),
  ]);
}
