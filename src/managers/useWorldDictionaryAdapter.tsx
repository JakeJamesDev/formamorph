import type { ReactNode } from 'react';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import { useDictionaryStore } from '@/contexts/DictionaryStoreContext';
import { useGameData } from '@/contexts/GameDataContext';
import { randomUUID } from '@/lib/uuid';
import type { Dictionary, FocusFieldHint } from '@/types';
import type { DictionaryBookPanelTab } from '@/views/dictionaryBookPanelTabs';
import type { DictionaryPanelTab } from '@/views/dictionaryPanelTabs';
import { focusFieldForItem } from '@/views/findFocus';
import DictionaryBookManager from './DictionaryBookManager';
import DictionaryManager from './DictionaryManager';
import DictionaryTree from './DictionaryTree';
import { dictionarySearchRows, useDictionaryActions, useDictionaryCollapse } from './useDictionaryActions';

/**
 * The World Editor's Dictionary tab as a List Editor adapter: the book tree, a flat search over books and
 * entries, and the book or entry panel. The panels' tabs and the book's placeholder row are held by the host.
 * The tree's folds live here, so a search keeps them. `dialog` is the search rows' book delete confirmation;
 * the host renders it. `book` is the open book, or the book of the open entry.
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
}): { adapter: ListEditorAdapter; dialog: ReactNode; book: Dictionary | undefined } {
  const { placeholders, placementLetters, placeholderOwners } = useGameData();
  const { dictionaries, addDictionary } = useDictionaryStore();
  const collapse = useDictionaryCollapse();
  const actions = useDictionaryActions({ selectedId, onSelect, collapse });

  // A book's id opens its panel; an entry's opens the entry panel under its book.
  const lookup = (id: string | null) => {
    const book = dictionaries.find((b) => b.id === id);
    if (book) return { book };
    const entryBook = dictionaries.find((b) => b.entries.some((e) => e.id === id));
    return { entry: entryBook?.entries.find((e) => e.id === id), entryBook };
  };

  const detail = (id: string | null) => {
    const { book, entry, entryBook } = lookup(id);
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
        surfaceTabs="worldEditorEntry"
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
    tree: <DictionaryTree selectedId={selectedId} onSelect={onSelect} collapse={collapse} />,
    rows: () => dictionarySearchRows(dictionaries, actions, true),
    names: { placeholders, letters: placementLetters, owners: placeholderOwners },
    noun: 'dictionaries',
    detail,
    // Both panels keep their tab strip above a body that scrolls itself.
    fills: () => true,
    add: { label: 'Add to Dictionary', onAdd: addBook },
    placeholder: 'Search or add new dictionaries',
    holds: (id) => { const { book, entry } = lookup(id); return !!(book ?? entry); },
    // The tree draws its own empty hint.
    isEmpty: false,
    emptyHint: null,
  };
  const open = lookup(selectedId);
  return { adapter, dialog: actions.dialog, book: open.book ?? open.entryBook };
}
