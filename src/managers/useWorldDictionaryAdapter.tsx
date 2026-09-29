import type { ReactNode } from 'react';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import { useDictionaryStore } from '@/contexts/DictionaryStoreContext';
import { useGameData } from '@/contexts/GameDataContext';
import { randomUUID } from '@/lib/uuid';
import type { FocusFieldHint } from '@/types';
import type { DictionaryBookPanelTab } from '@/views/dictionaryBookPanelTabs';
import type { DictionaryPanelTab } from '@/views/dictionaryPanelTabs';
import { focusFieldForItem } from '@/views/findFocus';
import DictionaryBookManager from './DictionaryBookManager';
import DictionaryManager from './DictionaryManager';
import DictionaryTree from './DictionaryTree';
import { useDictionarySearchRows } from './useDictionarySearchRows';

/**
 * The World Editor's Dictionary tab as a List Editor adapter: the book tree, a flat search over books and
 * entries, and the book or entry panel. The panels' tabs and the book's placeholder row are held by the host.
 * `dialog` is the search rows' book delete confirmation; the host renders it.
 */
export function useWorldDictionaryAdapter({
  selectedId, onSelect, bookTab, onBookTabChange, bookPlaceholderId, onBookPlaceholderIdChange,
  onOpenWorldPlaceholder, entryTab, onEntryTabChange, focusField,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  bookTab: DictionaryBookPanelTab;
  onBookTabChange: (tab: DictionaryBookPanelTab) => void;
  bookPlaceholderId: string | null;
  onBookPlaceholderIdChange: (id: string | null) => void;
  onOpenWorldPlaceholder: (id: string) => void;
  entryTab: DictionaryPanelTab;
  onEntryTabChange: (tab: DictionaryPanelTab) => void;
  focusField: FocusFieldHint | null;
}): { adapter: ListEditorAdapter; dialog: ReactNode } {
  const { placeholders, placementLetters, placeholderOwners } = useGameData();
  const { dictionaries, addDictionary } = useDictionaryStore();
  const { rows, dialog } = useDictionarySearchRows({ selectedId, onSelect, withBooks: true });

  // A book's id opens its panel; an entry's opens the entry panel under its book.
  const shown = (id: string | null) => {
    const book = dictionaries.find((b) => b.id === id);
    if (book) return { book };
    const entryBook = dictionaries.find((b) => b.entries.some((e) => e.id === id));
    return { entry: entryBook?.entries.find((e) => e.id === id), entryBook };
  };

  const detail = (id: string | null) => {
    const { book, entry, entryBook } = shown(id);
    if (book) {
      return (
        <DictionaryBookManager
          key={book.id}
          book={book}
          tab={bookTab}
          onTabChange={onBookTabChange}
          placeholderId={bookPlaceholderId}
          onPlaceholderIdChange={onBookPlaceholderIdChange}
          onOpenWorldPlaceholder={onOpenWorldPlaceholder}
          focusField={focusFieldForItem(focusField, book.id)}
        />
      );
    }
    return entry && (
      <DictionaryManager
        key={entry.id}
        entry={entry}
        placeholders={placeholders}
        ownerId={entryBook?.id}
        tab={entryTab}
        onTabChange={onEntryTabChange}
        focusField={focusFieldForItem(focusField, entry.id)}
      />
    );
  };

  // The + adds a whole book; entries are added per book.
  const addBook = (typed: string) => {
    const id = randomUUID();
    addDictionary({ id, name: typed || 'New Dictionary', enabled: true, entries: [] });
    onSelect(id);
  };

  const adapter: ListEditorAdapter = {
    // The tree clears the selection with an empty id; the shell's stale clear turns it into none.
    tree: <DictionaryTree selectedId={selectedId} onSelect={onSelect} />,
    rows,
    names: { placeholders, letters: placementLetters, owners: placeholderOwners },
    noun: 'dictionaries',
    detail,
    // Both panels keep their tab strip above a body that scrolls itself.
    fills: () => true,
    add: { label: 'Add to Dictionary', onAdd: addBook },
    placeholder: 'Search or add new dictionaries',
    holds: (id) => { const { book, entry } = shown(id); return !!(book ?? entry); },
    // The tree draws its own empty hint.
    isEmpty: false,
    emptyHint: null,
  };
  return { adapter, dialog };
}
