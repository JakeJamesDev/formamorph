import { useId } from 'react';
import { Plus, X } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Tip } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorldInput } from '@/components/editor/WorldField';
import { fieldFrame } from '@/lib/historyField';
import { placementsAt, wholeCount } from '@/lib/items';
import { labelPlaceholders } from '@/lib/placementLetters';
import { randomUUID } from '@/lib/uuid';
import type { Placement, PlacementWhere } from '@/types';

interface PlacementsSectionProps {
  where: PlacementWhere;
  label: string;
  hint: string;
}

/** The starting Item Copies placed at one place: item, quantity and Hidden per row. */
const PlacementsSection = ({ where, label, hint }: PlacementsSectionProps) => {
  const { items, placements, setPlacements, placeholders } = useGameData();
  const labelId = useId();
  const rows = placementsAt(placements, where);
  const name = (itemId: string) => labelPlaceholders(items.find((i) => i.id === itemId)?.name ?? '', placeholders) || 'Unnamed Item';

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
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <Select value={p.source.itemId} onValueChange={(itemId) => update({ ...p, source: { kind: 'item', itemId } })}>
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
                  onCheckedChange={(checked) => {
                    const { hidden: _drop, ...rest } = p;
                    update(checked === true ? { ...rest, hidden: true } : rest);
                  }}
                />
                Hidden
              </Label>
              <Tip tip="Delete">
                <Button variant="ghost" size="icon" aria-label={`Delete ${name(p.source.itemId)}`} onClick={() => remove(p.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </Tip>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" size="sm" onClick={add} disabled={!items.length}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />Add Item
      </Button>
    </div>
  );
};

export default PlacementsSection;
