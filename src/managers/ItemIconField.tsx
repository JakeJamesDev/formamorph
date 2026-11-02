import { useId } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { ItemIconPicker } from '@/components/ItemIconPicker';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { fieldFrame } from '@/lib/historyField';
import { deriveItemIcon, itemSlotNames } from '@/lib/itemIcons';
import { labelPlaceholders } from '@/lib/placementLetters';
import type { Item } from '@/types';

/** What an item shows on the doll and in rows. Auto stores nothing, so picking it removes the value. */
export function ItemIconField({ item, apply }: { item: Item; apply: (patch: Partial<Item>) => void }) {
  const { slots, placeholders } = useGameData();
  const labelId = useId();
  const hintId = useId();
  const label = (text: string) => labelPlaceholders(text, placeholders);
  return (
    <div className="space-y-2" {...fieldFrame('icon')}>
      <Label id={labelId}>Icon</Label>
      <Hint id={hintId}>Picks what the <b>Inventory</b> tab shows. <b>None</b> shows the item&apos;s image.</Hint>
      <ItemIconPicker
        value={item.icon}
        derivedId={deriveItemIcon(label(item.name), itemSlotNames(item, slots, label))}
        onPick={(icon) => apply({ icon })}
        labelId={labelId}
        describedBy={hintId}
      />
    </div>
  );
}
