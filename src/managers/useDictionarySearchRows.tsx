import { Copy, FilePlus, X } from 'lucide-react';
import type { ListEditorRow } from '@/components/listEditorHooks';
import { useDictionaryStore } from '@/contexts/DictionaryStoreContext';
import { blankDictionaryEntry, dictionaryEntryLabel, duplicateEntryInBooks } from '@/lib/dictionaryTree';
import { OWNER_NAME_SEPARATOR } from '@/lib/placementLetters';
import { useRemoveBook } from './useRemoveBook';

/**
 * The flat search rows over the store's books, with the tree rows' actions. `withBooks` lists each book and
 * reads its entries as `Book › Entry`; without it, entries read bare, for a host that edits one book.
 * The caller renders `dialog`, the book delete confirmation.
 */
export function useDictionarySearchRows({ selectedId, onSelect, withBooks }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  withBooks: boolean;
}) {
  const { dictionaries, setDictionaries, addDictionaryEntry, removeDictionaryEntry } = useDictionaryStore();
  const { ask: askRemoveBook, dialog } = useRemoveBook({ selectedId, onSelect });

  const addEntry = (bookId: string, name = '') => {
    const entry = blankDictionaryEntry(name);
    addDictionaryEntry(bookId, entry);
    onSelect(entry.id);
  };
  const duplicateEntry = (id: string) => {
    const { books, newId } = duplicateEntryInBooks(dictionaries, id);
    setDictionaries(books);
    if (newId) onSelect(newId);
  };

  const rows = (): ListEditorRow[] => dictionaries.flatMap((book) => [
    ...(withBooks ? [{
      id: book.id,
      name: book.name,
      labelClass: 'font-medium',
      actions: [
        { icon: <FilePlus className="h-4 w-4" />, title: 'Add entry', onClick: () => addEntry(book.id) },
        { icon: <X className="h-4 w-4" />, title: 'Delete dictionary', onClick: () => askRemoveBook(book.id) },
      ],
    }] : []),
    ...book.entries.map((entry): ListEditorRow => ({
      id: entry.id,
      name: withBooks ? `${book.name}${OWNER_NAME_SEPARATOR}${dictionaryEntryLabel(entry)}` : dictionaryEntryLabel(entry),
      actions: [
        { icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => duplicateEntry(entry.id) },
        {
          icon: <X className="h-4 w-4" />, title: 'Delete',
          onClick: () => { removeDictionaryEntry(entry.id); if (entry.id === selectedId) onSelect(null); },
        },
      ],
    })),
  ]);

  return { rows, addEntry, dialog };
}
