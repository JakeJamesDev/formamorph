import { useState } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { X } from 'lucide-react';
import { EditorRow, EditorRowList } from '@/components/EditorRow';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { dragStyle, droppedMove } from '@/lib/sortableDrag';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorldInput } from '@/components/editor/WorldField';
import { addCurrencyItem, currencyItemChoices, lacksBaseItem, setItemWorth } from '@/lib/currency';
import { itemStackable } from '@/lib/items';
import type { Currency, CurrencyItem, Item } from '@/types';

/** An item's worth, typed freely and applied when focus leaves. A worth the rules refuse snaps back with a note. */
function WorthInput({ worth, onCommit }: { worth: number; onCommit: (worth: number) => boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  return (
    <>
      <WorldInput
        aria-label="Item Worth"
        aria-invalid={refused}
        type="number"
        min={1}
        className="h-8 w-28"
        value={draft ?? worth}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft === null) return;
          setRefused(draft.trim() === '' || !onCommit(Number(draft)));
          setDraft(null);
        }}
      />
      {refused && <Hint role="alert">Use a whole number no other item has. Only one item is worth 1.</Hint>}
    </>
  );
}

// The rows are their own drag boundary, so an item row never leaves its Currency.
const ROW_LIST_MODIFIERS = [restrictToVerticalAxis, restrictToParentElement];

/** The Currency Item rows of one Currency: each an item and its worth in the base unit. */
export default function ItemRows({ currency, rows, items, currencies, label, onChange }: {
  currency: Currency;
  rows: readonly CurrencyItem[];
  items: readonly Item[];
  currencies: readonly Currency[];
  label: (name: string) => string;
  onChange: (rows: CurrencyItem[]) => void;
}) {
  const choices = currencyItemChoices(items, currencies);
  const sortable = rows.map((row) => ({ ...row, id: row.itemId }));
  const onDragEnd = (event: DragEndEvent) => {
    const move = droppedMove(sortable, event);
    if (move) onChange(arrayMove([...rows], ...move));
  };

  return (
    <div className="grid gap-2" data-testid={`item-rows-${currency.id}`}>
      {lacksBaseItem(rows, items) && <Hint>Add an item worth 1, the smallest one</Hint>}
      {rows.length > 0 && (
        <EditorDndContext modifiers={ROW_LIST_MODIFIERS} onDragEnd={onDragEnd}>
          <StableSortableContext items={sortable} strategy={verticalListSortingStrategy}>
            <EditorRowList className="min-w-0" aria-label={`${currency.name || 'Currency'} Items`}>
              {rows.map((row, at) => (
                <SortableItemRow
                  key={row.itemId}
                  row={row}
                  item={items.find((other) => other.id === row.itemId)}
                  choices={currencyItemChoices(items, currencies, row.itemId)}
                  label={label}
                  onItem={(itemId) => onChange(rows.map((other, index) => (index === at ? { ...other, itemId } : other)))}
                  onWorth={(worth) => {
                    const next = setItemWorth(rows, at, worth);
                    if (next) onChange(next);
                    return !!next;
                  }}
                  onRemove={() => onChange(rows.filter((_, index) => index !== at))}
                />
              ))}
            </EditorRowList>
          </StableSortableContext>
        </EditorDndContext>
      )}
      <Select value="" onValueChange={(itemId) => onChange(addCurrencyItem(rows, itemId, items))} disabled={choices.length === 0}>
        <SelectTrigger className="h-8 w-48" aria-label="Add Item">
          <SelectValue placeholder={choices.length === 0 ? 'No Stackable items left' : 'Add Item'} />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => <SelectItem key={choice.id} value={choice.id}>{label(choice.name)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/** One item row: a grip, the item, its worth and Remove. */
function SortableItemRow({ row, item, choices, label, onItem, onWorth, onRemove }: {
  row: CurrencyItem;
  item: Item | undefined;
  choices: readonly Item[];
  label: (name: string) => string;
  onItem: (itemId: string) => void;
  onWorth: (worth: number) => boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, ...drag } = useSortable({ id: row.itemId });
  const name = item?.name ?? 'Item';
  return (
    <EditorRow
      setNodeRef={setNodeRef}
      style={dragStyle(drag)}
      gripProps={{ ...attributes, ...listeners }}
      selected={false}
      onSelect={() => undefined}
      label={(
        <div className="flex flex-wrap items-center gap-2">
          <Select value={row.itemId} onValueChange={onItem}>
            <SelectTrigger className="h-8 w-48" aria-label="Item">
              <SelectValue placeholder="Select item" />
            </SelectTrigger>
            <SelectContent>
              {choices.map((choice) => (
                <SelectItem key={choice.id} value={choice.id}>{label(choice.name)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <WorthInput key={row.worth} worth={row.worth} onCommit={onWorth} />
          {item && !itemStackable(item) && <Hint>{label(item.name)} isn&apos;t Stackable</Hint>}
        </div>
      )}
      actions={[{ icon: <X className="h-4 w-4" />, destructive: true, title: `Remove ${name}`, onClick: onRemove }]}
    />
  );
}
