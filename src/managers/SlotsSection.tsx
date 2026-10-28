import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Tip } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { WorldInput } from '@/components/editor/WorldField';
import { fieldFrame } from '@/lib/historyField';
import { itemsInSlot, slotCapacity, wholeCount } from '@/lib/items';
import { randomUUID } from '@/lib/uuid';
import type { Slot } from '@/types';

/** The world's equipment slots: a name and a capacity each. The Persona and every entity share them (Q15). */
const SlotsSection = () => {
  const { slots, setSlots, updateSlot, removeSlot, items } = useGameData();
  const [pending, setPending] = useState<Slot | null>(null);
  const pendingCount = pending ? itemsInSlot(items, pending.id) : 0;

  const add = () => setSlots([...slots, { id: randomUUID(), name: 'New Slot' }]);
  // A slot no item uses goes at once; one in use asks first (Q78).
  const askRemove = (slot: Slot) => (itemsInSlot(items, slot.id) ? setPending(slot) : removeSlot(slot.id));

  return (
    <div className="space-y-2" {...fieldFrame('slots')}>
      <Label id="world-slots-label">Slots</Label>
      <Hint>Lists where items equip, such as Hand. Capacity sets how many fit.</Hint>
      {slots.length > 0 && (
        <ul aria-labelledby="world-slots-label" className="space-y-2">
          {slots.map((slot) => (
            <li key={slot.id} className="flex items-center gap-2">
              <WorldInput
                aria-label="Slot Name"
                className="min-w-0 flex-1"
                value={slot.name}
                onChange={(e) => updateSlot({ ...slot, name: e.target.value })}
              />
              <WorldInput
                aria-label={`${slot.name || 'Slot'} Capacity`}
                type="number"
                min={1}
                className="w-20"
                value={slotCapacity(slot)}
                onChange={(e) => {
                  const typed = wholeCount(e.target.value);
                  if (typed === undefined) return;
                  const capacity = Math.max(1, typed);
                  const { capacity: _drop, ...rest } = slot;
                  updateSlot(capacity === 1 ? rest : { ...slot, capacity });
                }}
              />
              <Tip tip="Delete">
                <Button variant="ghost" size="icon" aria-label={`Delete ${slot.name || 'Slot'}`} onClick={() => askRemove(slot)}>
                  <X className="h-4 w-4" />
                </Button>
              </Tip>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />Add Slot
      </Button>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title={`Delete ${pending?.name || 'Slot'}?`}
        description={`${pendingCount} ${pendingCount === 1 ? 'item equips' : 'items equip'} into this slot. They can no longer be equipped.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (pending) removeSlot(pending.id);
          setPending(null);
        }}
      />
    </div>
  );
};

export default SlotsSection;
