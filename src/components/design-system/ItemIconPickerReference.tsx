import { useId, useState } from 'react';
import { ItemIconPicker } from '@/components/ItemIconPicker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Hint, SectionTitle } from '@/components/ui/typography';
import { ITEM_ICON_NONE } from '@/lib/itemIcons';

/** One labeled picker bound to local state. */
function PickerSample({ title, note, initial }: { title: string; note: string; initial?: string }) {
  const [value, setValue] = useState(initial);
  const labelId = useId();
  return (
    <section aria-labelledby={labelId} className="min-w-0 space-y-2 rounded-md border p-3">
      <SectionTitle id={labelId}>{title}</SectionTitle>
      <Hint>{note}</Hint>
      <ItemIconPicker value={value} derivedId="sword" onPick={setValue} labelId={labelId} />
    </section>
  );
}

export function ItemIconPickerReference() {
  return (
    <Card role="region" aria-labelledby="item-icon-picker-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="item-icon-picker-reference-title" className="text-heading">Icon Grid Picker Reference</CardTitle>
        <CardDescription>Open a picker to see the grid, then type to search</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3 md:grid-cols-3">
        <PickerSample title="Auto" note="Shows the icon the item's name gives" />
        <PickerSample title="Specific Icon" note="Shows the picked icon and its name" initial="lantern" />
        <PickerSample title="None" note="Shows the item's image" initial={ITEM_ICON_NONE} />
      </CardContent>
    </Card>
  );
}
