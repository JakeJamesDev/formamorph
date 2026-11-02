import { useId } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, X } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EditorRow, EditorRowList } from '@/components/EditorRow';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { fieldFrame } from '@/lib/historyField';
import { labelPlaceholders } from '@/lib/placementLetters';
import { dragStyle, droppedMove } from '@/lib/sortableDrag';
import type { Item, SlotRule } from '@/types';

const LIST_MODIFIERS = [restrictToVerticalAxis, restrictToParentElement];

/** The slots an item equips into, in the order it tries them, and at 2 or more whether it takes one or all (Q36). */
export function ItemSlotRuleField({ item, apply }: { item: Item; apply: (patch: Partial<Item>) => void }) {
  const { slots, placeholders } = useGameData();
  const labelId = useId();
  const rule = item.slotRule;
  const slotIds = rule?.slotIds ?? [];
  const nameOf = (slotId: string) => labelPlaceholders(slots.find((s) => s.id === slotId)?.name ?? '', placeholders) || 'Unnamed Slot';
  const itemName = labelPlaceholders(item.name, placeholders);
  const open = slots.filter((s) => !slotIds.includes(s.id));
  const rows = slotIds.map((id) => ({ id }));
  const write = (next: string[], mode: SlotRule['mode'] = rule?.mode ?? 'either') =>
    apply({ slotRule: next.length ? { mode, slotIds: next } : undefined });
  const onDragEnd = (event: DragEndEvent) => {
    const move = droppedMove(rows, event);
    if (move) write(arrayMove(slotIds, ...move));
  };

  return (
    <div className="space-y-2" {...fieldFrame('slotRule')}>
      <Label id={labelId}>Slots</Label>
      <Hint>Picks the slots it equips into. Add slots in <b>Equipment Settings</b>.</Hint>
      {slotIds.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={rule?.mode ?? 'either'} onValueChange={(mode) => write(slotIds, mode === 'all' ? 'all' : 'either')}>
            <SelectTrigger className="w-48" aria-label="Slot Mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="either">Either of</SelectItem>
              <SelectItem value="all">All of</SelectItem>
            </SelectContent>
          </Select>
          <Hint>{rule?.mode === 'all' ? 'Takes every slot below at once' : 'Takes the first free slot below'}</Hint>
        </div>
      )}
      {slotIds.length > 0 && (
        <EditorDndContext modifiers={LIST_MODIFIERS} onDragEnd={onDragEnd}>
          <StableSortableContext items={rows} strategy={verticalListSortingStrategy}>
            <EditorRowList className="min-w-0" aria-labelledby={labelId}>
              {rows.map(({ id }) => (
                <SlotRow
                  key={id}
                  id={id}
                  name={nameOf(id)}
                  itemName={itemName}
                  onRemove={() => write(slotIds.filter((slotId) => slotId !== id))}
                />
              ))}
            </EditorRowList>
          </StableSortableContext>
        </EditorDndContext>
      )}
      {open.length > 0 && (
        <Select value="" onValueChange={(slotId) => write([...slotIds, slotId])}>
          <SelectTrigger className="h-8 w-auto gap-1 text-label" aria-label={`Add a slot to ${itemName}`}>
            <Plus className="h-4 w-4" aria-hidden />
            <SelectValue placeholder="Add Slot" />
          </SelectTrigger>
          <SelectContent>
            {open.map((s) => <SelectItem key={s.id} value={s.id}>{nameOf(s.id)}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

/** One slot of the rule: a grip to reorder it, and Remove. */
function SlotRow({ id, name, itemName, onRemove }: { id: string; name: string; itemName: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, ...drag } = useSortable({ id });
  return (
    <EditorRow
      setNodeRef={setNodeRef}
      style={dragStyle(drag)}
      gripProps={{ ...attributes, ...listeners }}
      selected={false}
      onSelect={() => undefined}
      label={name}
      actions={[{ icon: <X className="h-4 w-4" />, destructive: true, title: `Remove ${name} from ${itemName}`, onClick: onRemove }]}
    />
  );
}
