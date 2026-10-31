import { useId } from 'react';
import { Plus, TriangleAlert, X } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { DESTRUCTIVE_ROW_ACTION_HOVER } from '@/components/EditorRow';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Tip } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorldInput } from '@/components/editor/WorldField';
import { fieldFrame } from '@/lib/historyField';
import { startingEquipGap, type StartingEquipGap } from '@/lib/bodies';
import { placementsAt, slotSizeOf, wholeCount } from '@/lib/items';
import { labelPlaceholders } from '@/lib/placementLetters';
import { randomUUID } from '@/lib/uuid';
import type { Item, Placement, PlacementWhere } from '@/types';

interface PlacementsSectionProps {
  where: PlacementWhere;
  label: string;
  hint: string;
}

/** Why a row's starting equip will start carried, in the author's words. */
const gapText = (gap: StartingEquipGap, item: string, slot: string): string => {
  switch (gap.kind) {
    case 'noBody': return `Body is None. ${item} starts carried.`;
    case 'noSlot': return `${gap.body.name || 'This Body'} has no ${slot} slot. ${item} starts carried.`;
    case 'tooSmall': return `${gap.body.name || 'This Body'} holds ${gap.capacity} ${slot}. ${item} starts carried.`;
  }
};

/** `p` with the optional flag on, or without it. */
const withFlag = (p: Placement, flag: 'hidden' | 'equipped', on: boolean): Placement => {
  const { [flag]: _drop, ...rest } = p;
  return on ? { ...rest, [flag]: true } : rest;
};

/** The starting Item Copies placed at one place: item, quantity, Hidden and, on an owner, Equipped per row. */
const PlacementsSection = ({ where, label, hint }: PlacementsSectionProps) => {
  const { items, placements, setPlacements, placeholders, slots, bodies, entities } = useGameData();
  const labelId = useId();
  const rows = placementsAt(placements, where);
  const itemOf = (itemId: string) => items.find((i) => i.id === itemId);
  const name = (itemId: string) => labelPlaceholders(itemOf(itemId)?.name ?? '', placeholders) || 'Unnamed Item';
  /** The slot a row can equip into: its item's, never at a location. */
  const slotOf = (item: Item | undefined) =>
    (where.kind !== 'location' && item?.slotId ? slots.find((slot) => slot.id === item.slotId) : undefined);

  const update = (next: Placement) => setPlacements(placements.map((p) => (p.id === next.id ? next : p)));
  const remove = (id: string) => setPlacements(placements.filter((p) => p.id !== id));
  const add = () => {
    if (!items[0]) return;
    setPlacements([...placements, { id: randomUUID(), where, quantity: 1, source: { kind: 'item', itemId: items[0].id } }]);
  };

  return (
    <div className="space-y-2" {...fieldFrame('placements')}>
      <Label id={labelId}>{label}</Label>
      <Hint>{items.length ? hint : 'Add items on the Items tab first'}</Hint>
      {rows.length > 0 && (
        <ul aria-labelledby={labelId} className="space-y-2">
          {rows.map((p) => {
            const item = itemOf(p.source.itemId);
            const slot = slotOf(item);
            const gap = p.equipped && slot && where.kind !== 'location' ? startingEquipGap({ bodies, entities }, where, slot.id, slotSizeOf(item)) : null;
            const warn = gap && slot && gapText(gap, name(p.source.itemId), slot.name);
            return (
              <li key={p.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Select
                    value={p.source.itemId}
                    onValueChange={(itemId) => update({
                      ...withFlag(p, 'equipped', !!p.equipped && !!slotOf(itemOf(itemId))), source: { kind: 'item', itemId },
                    })}
                  >
                    <SelectTrigger className="min-w-0 flex-1" aria-label="Item">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((i) => <SelectItem key={i.id} value={i.id}>{name(i.id)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <WorldInput
                    aria-label={`${name(p.source.itemId)} Quantity`}
                    type="number"
                    min={1}
                    className="w-20"
                    value={p.quantity}
                    onChange={(e) => {
                      const typed = wholeCount(e.target.value);
                      if (typed !== undefined) update({ ...p, quantity: Math.max(1, typed) });
                    }}
                  />
                  <Label className="flex items-center gap-1.5 font-normal">
                    <Checkbox
                      aria-label={`${name(p.source.itemId)} Hidden`}
                      checked={!!p.hidden}
                      onCheckedChange={(checked) => update(withFlag(p, 'hidden', checked === true))}
                    />
                    Hidden
                  </Label>
                  {slot && (
                    <Label className="flex items-center gap-1.5 font-normal">
                      <Checkbox
                        aria-label={`${name(p.source.itemId)} Equipped`}
                        checked={!!p.equipped}
                        onCheckedChange={(checked) => update(withFlag(p, 'equipped', checked === true))}
                      />
                      Equipped
                    </Label>
                  )}
                  <Tip tip="Delete">
                    <Button variant="ghost" size="icon" className={DESTRUCTIVE_ROW_ACTION_HOVER} aria-label={`Delete ${name(p.source.itemId)}`} onClick={() => remove(p.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </Tip>
                </div>
                {warn && (
                  <p role="status" className="flex items-start gap-1 text-helper text-warning">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    {warn}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Button variant="outline" size="sm" onClick={add} disabled={!items.length}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />Add Item
      </Button>
    </div>
  );
};

export default PlacementsSection;
