import { randomUUID } from "@/lib/uuid";
import DictionaryStorageService from '@/services/DictionaryStorageService';
import type { Dictionary } from '@/types';
import AddFromLibraryModal from './AddFromLibraryModal';

/**
 * Pick one or more dictionaries from the local library and add a copy of each to the world being edited.
 * Every copy gets fresh ids (book + entries) so it's independent of the library original.
 */
const AddDictionaryModal = ({ open, onOpenChange, onAdd }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (book: Dictionary) => void;
}) => (
  <AddFromLibraryModal
    open={open}
    onOpenChange={onOpenChange}
    onAdd={onAdd}
    title="Add Dictionary"
    description="Add copies of saved dictionaries from your library to this world."
    emptyMessage="No saved dictionaries yet — import one from the Dictionaries tab on the main menu first."
    loadMetadata={() => DictionaryStorageService.getDictionaryMetadata()}
    loadRecord={(id) => DictionaryStorageService.getDictionaryData(id)}
    copy={(book) => ({
      ...book,
      id: randomUUID(),
      entries: book.entries.map((e) => ({ ...e, id: randomUUID() })),
    })}
    renderRow={(d) => (
      <>
        <span className="min-w-0 flex-grow truncate">{d.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {d.entryCount ?? 0} {d.entryCount === 1 ? 'entry' : 'entries'}
        </span>
      </>
    )}
  />
);

export default AddDictionaryModal;
