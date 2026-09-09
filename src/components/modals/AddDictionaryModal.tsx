import { randomUUID } from '@/lib/uuid';
import { linkToSource, unlink } from '@/lib/linkedContent';
import type { LibrarySource } from '@/lib/linkedContent';
import type { Dictionary } from '@/types';
import AddFromLibraryModal from './AddFromLibraryModal';

/**
 * Pick one or more dictionaries from the local library and add a copy of each to the world being edited.
 * Every copy gets fresh ids (book + entries) so the world owns what it holds; the link, when the author
 * keeps it, is what makes the copy follow the library item.
 */
const AddDictionaryModal = ({ open, onOpenChange, onAdd }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (book: Dictionary, source?: LibrarySource) => void;
}) => (
  <AddFromLibraryModal
    open={open}
    onOpenChange={onOpenChange}
    kind="dictionary"
    title="Add Dictionary"
    description="Add saved dictionaries from your library to this world."
    emptyMessage="No saved dictionaries yet. Save one to your library from this world, or import one from the Dictionaries tab on the main menu."
    confirmLabel="Add Dictionary"
    renderRow={(item) => (
      <span className="text-meta text-muted-foreground shrink-0 order-last">
        {item.entryCount ?? 0} {item.entryCount === 1 ? 'entry' : 'entries'}
      </span>
    )}
    onConfirm={(picks, link) => {
      for (const { source, data } of picks) {
        const book = unlink(data as Dictionary);
        onAdd({
          ...book,
          id: randomUUID(),
          entries: book.entries.map((e) => ({ ...e, id: randomUUID() })),
          ...(link ? { link: linkToSource(source) } : {}),
        }, link ? source : undefined);
      }
    }}
  />
);

export default AddDictionaryModal;
