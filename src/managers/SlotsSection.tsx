import { useState } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, X } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { EditorRow, EditorRowList } from '@/components/EditorRow';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { WorldInput } from '@/components/editor/WorldField';
import { fieldFrame } from '@/lib/historyField';
import { slotUsedBy } from '@/lib/bodies';
import { dragStyle, droppedMove } from '@/lib/sortableDrag';
import { randomUUID } from '@/lib/uuid';
import type { Slot } from '@/types';

/** The world's equipment slots, by name and in order. Each Body gives a slot its capacity. */
const SlotsSection = () => {
  const { slots, setSlots, updateSlot, removeSlot, items, bodies } = useGameData();
  const [pending, setPending] = useState<{ slot: Slot; text: string } | null>(null);

  const add = () => setSlots([...slots, { id: randomUUID(), name: 'New Slot' }]);
  // A slot nothing uses goes at once; one in use asks first (Q25).
  const askRemove = (slot: Slot) => {
    const text = slotUsedBy(items, bodies, slot.id);
    if (text) setPending({ slot, text });
    else removeSlot(slot.id);
  };
  const onDragEnd = (event: DragEndEvent) => {
    const move = droppedMove(slots, event);
    if (move) setSlots(arrayMove(slots, ...move));
  };

  return (
    <div className="space-y-2" {...fieldFrame('slots')}>
      <Label id="world-slots-label">Slots</Label>
      <Hint>Lists where items equip, such as Hand</Hint>
      {slots.length > 0 && (
        <EditorDndContext onDragEnd={onDragEnd}>
          <StableSortableContext items={slots} strategy={verticalListSortingStrategy}>
            <EditorRowList aria-labelledby="world-slots-label">
              {slots.map((slot) => (
                <SortableSlot key={slot.id} slot={slot} onRename={(name) => updateSlot({ ...slot, name })} onRemove={() => askRemove(slot)} />
              ))}
            </EditorRowList>
          </StableSortableContext>
        </EditorDndContext>
      )}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />Add Slot
      </Button>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title={`Delete ${pending?.slot.name || 'Slot'}?`}
        description={pending?.text ?? ''}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (pending) removeSlot(pending.slot.id);
          setPending(null);
        }}
      />
    </div>
  );
};

/** One slot: a grip, its name field and Delete. */
function SortableSlot({ slot, onRename, onRemove }: { slot: Slot; onRename: (name: string) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, ...drag } = useSortable({ id: slot.id });
  return (
    <EditorRow
      setNodeRef={setNodeRef}
      style={dragStyle(drag)}
      gripProps={{ ...attributes, ...listeners }}
      selected={false}
      onSelect={() => undefined}
      label={<WorldInput aria-label="Slot Name" className="h-8" value={slot.name} onChange={(e) => onRename(e.target.value)} />}
      actions={[{ icon: <X className="h-4 w-4" />, destructive: true, title: `Delete ${slot.name || 'Slot'}`, onClick: onRemove }]}
    />
  );
}

export default SlotsSection;
