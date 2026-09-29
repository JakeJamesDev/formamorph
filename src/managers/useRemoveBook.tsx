import { useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useDictionaryStore } from '@/contexts/DictionaryStoreContext';

/**
 * Asks before it deletes a dictionary and its entries, and clears the selection when it held that book.
 * The caller renders `dialog`.
 */
export function useRemoveBook({ selectedId, onSelect }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}): { ask: (bookId: string) => void; dialog: ReactNode } {
  const { removeDictionary } = useDictionaryStore();
  const [bookToDelete, setBookToDelete] = useState<string | null>(null);
  const dialog = (
    <ConfirmDialog
      open={!!bookToDelete}
      onOpenChange={(open) => !open && setBookToDelete(null)}
      title="Delete Dictionary"
      description="Delete this dictionary and all of its entries? This cannot be undone."
      onConfirm={() => {
        if (bookToDelete) { removeDictionary(bookToDelete); if (bookToDelete === selectedId) onSelect(null); }
        setBookToDelete(null);
      }}
    />
  );
  return { ask: setBookToDelete, dialog };
}
