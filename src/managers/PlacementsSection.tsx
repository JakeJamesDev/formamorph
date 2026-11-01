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
import { placementsAt, wholeCount } from '@/lib/items';
import { labelPlaceholders } from '@/lib/placementLetters';
import { randomUUID } from '@/lib/uuid';
import type { Item, Placement, PlacementWhere } from '@/types';

/** The select value for no chosen slot. */
const FIRST_FREE = 'first-free';

interface PlacementsSectionProps {
  where: PlacementWhere;
  label: string;
  hint: string;
}

/** Why a row's starting equip will start carried, in the author's words. */
const gapText = (gap: StartingEquipGap, item: string, slotName: (slotId: string) => string): string => {
  switch (gap.kind) {
    case 'noBody': return `Body is None. ${item} starts carried.`;
    case 'noSlot': return `${gap.body.name || 'This Body'} has no ${gap.slotIds.map(slotName).join(' or ')} slot. ${item} starts carried.`;
  }
};

/** `p` with its starting slot set, or back to the first free one when `slotId` is absent. */
const withSlot = (p: Placement, slotId: string | undefined): Placement => {
  const { slotId: _drop, ...rest } = p;
  return slotId ? { ...rest, slotId } : rest;
};

/** `p` with the optional flag on, or without it. Unticking Equipped also clears the starting slot. */
const withFlag = (p: Placement, flag: 'hidden' | 'equipped', on: boolean): Placement => {
  const { [flag]: _drop, ...rest } = p;
  if (on) return { ...rest, [flag]: true };
  return flag === 'equipped' ? withSlot(rest, undefined) : rest;
};

/** The starting Item Copies placed at one place: item, quantity, Hidden and, on an owner, Equipped per row. */
const PlacementsSection = ({ where, label, hint }: PlacementsSectionProps) => {
  const { items, placements, setPlacements, placeholders, slots, bodies, entities } = useGameData();
  const labelId = useId();
  const rows = placementsAt(placements, where);
  const itemOf = (itemId: string) => items.find((i) => i.id === itemId);
  const name = (itemId: string) => labelPlaceholders(itemOf(itemId)?.name ?? '', placeholders) || 'Unnamed Item';
  /** The rule a row can equip under: its item's, never at a location. */
  const ruleOf = (item: Item | undefined) => (where.kind !== 'location' ? item?.slotRule : undefined);
  const slotName = (slotId: string) => slots.find((slot) => slot.id === slotId)?.name ?? '';

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
            const rule = ruleOf(item);
            const gap = p.equipped && rule && where.kind !== 'location' ? startingEquipGap({ bodies, entities }, where, rule) : null;
            const warn = gap && gapText(gap, name(p.source.itemId), slotName);
            return (
              <li key={p.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Select
                    value={p.source.itemId}
                    onValueChange={(itemId) => update({
                      ...withSlot(withFlag(p, 'equipped', !!p.equipped && !!ruleOf(itemOf(itemId))), undefined), source: { kind: 'item', itemId },
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
                  {rule && (
                    <Label className="flex items-center gap-1.5 font-normal">
                      <Checkbox
                        aria-label={`${name(p.source.itemId)} Equipped`}
                        checked={!!p.equipped}
                        onCheckedChange={(checked) => update(withFlag(p, 'equipped', checked === true))}
                      />
                      Equipped
                    </Label>
                  )}
                  {p.equipped && rule?.mode === 'either' && rule.slotIds.length >= 2 && (
                    <Select value={p.slotId && rule.slotIds.includes(p.slotId) ? p.slotId : FIRST_FREE} onValueChange={(slotId) => update(withSlot(p, slotId === FIRST_FREE ? undefined : slotId))}>
                      <SelectTrigger className="w-40" aria-label={`${name(p.source.itemId)} Slot`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={FIRST_FREE}>First Free Slot</SelectItem>
                        {rule.slotIds.map((id) => <SelectItem key={id} value={id}>{slotName(id) || 'Unnamed Slot'}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
