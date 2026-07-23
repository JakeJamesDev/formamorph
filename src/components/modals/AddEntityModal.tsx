import { randomUUID } from "@/lib/uuid";
import { User } from 'lucide-react';
import EntityStorageService from '@/services/EntityStorageService';
import type { Entity } from '@/types';
import AddFromLibraryModal from './AddFromLibraryModal';

/**
 * Pick one or more characters from the local library and add a copy of each to the world being edited.
 * Every copy gets a fresh id so it's independent of the library original.
 */
const AddEntityModal = ({ open, onOpenChange, onAdd }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (entity: Entity) => void;
}) => (
  <AddFromLibraryModal
    open={open}
    onOpenChange={onOpenChange}
    onAdd={onAdd}
    title="Add Character"
    description="Add copies of saved characters from your library to this world."
    emptyMessage="No saved characters yet — import one from the Entities tab on the main menu first."
    loadMetadata={() => EntityStorageService.getEntityMetadata()}
    loadRecord={(id) => EntityStorageService.getEntityData(id)}
    copy={(entity) => ({ ...entity, id: randomUUID() })}
    renderRow={(e) => (
      <>
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-muted flex items-center justify-center">
          {e.image ? (
            <img src={e.image} alt={e.name} className="h-full w-full object-cover" />
          ) : (
            <User className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <span className="min-w-0 flex-grow truncate">{e.name}</span>
      </>
    )}
  />
);

export default AddEntityModal;
