import { randomUUID } from '@/lib/uuid';
import { User } from 'lucide-react';
import { linkToSource, unlink, type LibrarySource } from '@/lib/linkedContent';
import { thumbFit } from '@/lib/thumbAspect';
import { cn } from '@/lib/utils';
import type { Entity } from '@/types';
import AddFromLibraryModal from './AddFromLibraryModal';

/**
 * Pick one or more entities from the local library and add a copy of each to the world being edited.
 * Every copy gets a fresh id so the world owns what it holds; the link, when the author keeps it, is what
 * makes the copy follow the library item.
 */
const AddEntityModal = ({ open, resume, onOpenChange, onAdd }: {
  open: boolean;
  /** This opening continues the last one, so the picks stay as the author left them. */
  resume?: boolean;
  onOpenChange: (open: boolean) => void;
  /** The whole batch at once: what each copy expects of the world is settled for all of them together. */
  onAdd: (picks: { item: Entity; source?: LibrarySource }[]) => void;
}) => (
  <AddFromLibraryModal
    open={open}
    resume={resume}
    onOpenChange={onOpenChange}
    kind="entity"
    title="Add Entity"
    description="Add saved entities from your library to this world."
    emptyMessage="No saved entities yet. Save one to your library from this world, or import one from the Entities tab on the main menu."
    confirmLabel="Add Entity"
    renderRow={(item) => (
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-muted flex items-center justify-center">
        {item.image ? (
          <img src={item.image} alt={item.name} className={cn('h-full w-full', thumbFit('portrait'))} />
        ) : (
          <User className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    )}
    onConfirm={(picks, link) => onAdd(picks.map(({ source, data }) => {
      const entity = unlink(data as Entity);
      return {
        item: { ...entity, id: randomUUID(), ...(link ? { link: linkToSource(source) } : {}) },
        ...(link ? { source } : {}),
      };
    }))}
  />
);

export default AddEntityModal;
