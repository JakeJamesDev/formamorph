import { useId, type ReactNode } from 'react';
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
import { bodyInForce, startingEquipGap, type StartingEquipGap } from '@/lib/bodies';
import { placementsAt, wholeCount } from '@/lib/items';
import { itemsInTabOrder } from '@/lib/itemGroupTree';
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

/** Starting placement rows: item, quantity, Hidden and, on an owner, Equipped per row. `recipient` adds a control
 *  that moves a row to another place; absent, every row stays at `where`. */
export function PlacementRows({ rows, onRowsChange, where, recipient, ariaPrefix = '', labelledBy }: {
  rows: readonly Placement[];
  onRowsChange: (next: Placement[]) => void;
  /** Where a new row goes. */
  where: PlacementWhere;
  recipient?: (p: Placement, onWhere: (where: PlacementWhere) => void) => ReactNode;
  /** Names each control after its list ("On Sword Quantity"), with its trailing space. */
  ariaPrefix?: string;
  labelledBy?: string;
}) {
  const { items: worldItems, itemGroups, placeholders, slots, bodies, entities } = useGameData();
  const items = itemsInTabOrder(itemGroups, worldItems);
  const itemOf = (itemId: string) => items.find((i) => i.id === itemId);
  const name = (itemId: string) => labelPlaceholders(itemOf(itemId)?.name ?? '', placeholders) || 'Unnamed Item';
  const aria = (p: Placement, part: string) => `${ariaPrefix}${name(p.source.itemId)} ${part}`;
  /** The rule a row can equip under: its item's, never at a location. */
  const ruleOf = (at: PlacementWhere, item: Item | undefined) => (at.kind !== 'location' ? item?.slotRule : undefined);
  const slotName = (slotId: string) => slots.find((slot) => slot.id === slotId)?.name ?? '';

  const update = (next: Placement) => onRowsChange(rows.map((p) => (p.id === next.id ? next : p)));
  const remove = (id: string) => onRowsChange(rows.filter((p) => p.id !== id));
  const add = () => {
    if (!items[0]) return;
    onRowsChange([...rows, { id: randomUUID(), where, quantity: 1, source: { kind: 'item', itemId: items[0].id } }]);
  };

  return (
    <>
      {rows.length > 0 && (
        <ul aria-labelledby={labelledBy} className="space-y-2">
          {rows.map((p) => {
            const item = itemOf(p.source.itemId);
            const rule = ruleOf(p.where, item);
            const owner = p.where.kind === 'location' ? undefined : p.where;
            const held = new Set(owner && bodyInForce({ bodies, entities }, owner, undefined)?.entries.map((e) => e.slotId));
            const gap = p.equipped && rule && owner ? startingEquipGap({ bodies, entities }, owner, rule, p.slotId) : null;
            const warn = gap && gapText(gap, name(p.source.itemId), slotName);
            return (
              <li key={p.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Select
                    value={p.source.itemId}
                    onValueChange={(itemId) => update({
                      ...withFlag(p, 'equipped', !!p.equipped && !!ruleOf(p.where, itemOf(itemId))), source: { kind: 'item', itemId },
                    })}
                  >
                    <SelectTrigger className="min-w-0 flex-1" aria-label={`${ariaPrefix}Item`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((i) => <SelectItem key={i.id} value={i.id}>{name(i.id)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {recipient?.(p, (next) => update({ ...withFlag(p, 'equipped', !!p.equipped && !!ruleOf(next, item)), where: next }))}
                  <WorldInput
                    aria-label={aria(p, 'Quantity')}
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
                      aria-label={aria(p, 'Hidden')}
                      checked={!!p.hidden}
                      onCheckedChange={(checked) => update(withFlag(p, 'hidden', checked === true))}
                    />
                    Hidden
                  </Label>
                  {rule && (
                    <Label className="flex items-center gap-1.5 font-normal">
                      <Checkbox
                        aria-label={aria(p, 'Equipped')}
                        checked={!!p.equipped}
                        onCheckedChange={(checked) => update(withFlag(p, 'equipped', checked === true))}
                      />
                      Equipped
                    </Label>
                  )}
                  {p.equipped && rule?.mode === 'either' && rule.slotIds.length >= 2 && (
                    <Select value={p.slotId && rule.slotIds.includes(p.slotId) ? p.slotId : FIRST_FREE} onValueChange={(slotId) => update(withSlot(p, slotId === FIRST_FREE ? undefined : slotId))}>
                      <SelectTrigger className="w-40" aria-label={aria(p, 'Slot')}>
                        {/* A named slot the Body lacks has no item, so the trigger names it and the warning explains. */}
                        <SelectValue>{p.slotId && rule.slotIds.includes(p.slotId) ? slotName(p.slotId) || 'Unnamed Slot' : 'First Free Slot'}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={FIRST_FREE}>First Free Slot</SelectItem>
                        {rule.slotIds.filter((id) => held.has(id)).map((id) => <SelectItem key={id} value={id}>{slotName(id) || 'Unnamed Slot'}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <Tip tip="Delete">
                    <Button variant="ghost" size="icon" className={DESTRUCTIVE_ROW_ACTION_HOVER} aria-label={`Delete ${ariaPrefix}${name(p.source.itemId)}`} onClick={() => remove(p.id)}>
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
    </>
  );
}

/** The starting Item Instances placed at one place. */
const PlacementsSection = ({ where, label, hint }: PlacementsSectionProps) => {
  const { items, placements, setPlacements } = useGameData();
  const labelId = useId();
  const rows = placementsAt(placements, where);
  // Edited rows keep their place in the world's list; a new row goes on the end.
  const onRowsChange = (next: Placement[]) => {
    const before = new Set(rows.map((p) => p.id));
    const byId = new Map(next.map((p) => [p.id, p]));
    setPlacements([
      ...placements.flatMap((p) => (!before.has(p.id) ? [p] : byId.has(p.id) ? [byId.get(p.id) as Placement] : [])),
      ...next.filter((p) => !before.has(p.id)),
    ]);
  };

  return (
    <div className="space-y-2" {...fieldFrame('placements')}>
      <Label id={labelId}>{label}</Label>
      <Hint>{items.length ? hint : 'Add items on the Items tab first'}</Hint>
      <PlacementRows rows={rows} onRowsChange={onRowsChange} where={where} labelledBy={labelId} />
    </div>
  );
};

export default PlacementsSection;
