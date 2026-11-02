import { useState } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

/** The Currency Item rows of one Currency: each an item and its worth in the base unit. */
export default function ItemRows({ currency, rows, items, currencies, label, onChange }: {
  currency: Currency;
  rows: readonly CurrencyItem[];
  items: readonly Item[];
  currencies: readonly Currency[];
  label: (name: string) => string;
  onChange: (rows: CurrencyItem[]) => void;
}) {
  const nameOf = (itemId: string) => items.find((item) => item.id === itemId)?.name;
  const choices = currencyItemChoices(items, currencies);
  const move = (at: number, to: number) => {
    const next = [...rows];
    [next[at], next[to]] = [next[to], next[at]];
    onChange(next);
  };

  return (
    <div className="w-full space-y-2" data-testid={`item-rows-${currency.id}`}>
      {lacksBaseItem(rows, items) && <Hint>Add an item worth 1, the smallest one</Hint>}
      {rows.map((row, at) => {
        const item = items.find((other) => other.id === row.itemId);
        return (
          <div key={row.itemId} className="flex flex-wrap items-center gap-2">
            <Select value={row.itemId} onValueChange={(itemId) => onChange(rows.map((other, index) => (index === at ? { ...other, itemId } : other)))}>
              <SelectTrigger className="h-8 w-48" aria-label="Item">
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {currencyItemChoices(items, currencies, row.itemId).map((choice) => (
                  <SelectItem key={choice.id} value={choice.id}>{label(choice.name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <WorthInput key={row.worth} worth={row.worth} onCommit={(worth) => {
              const next = setItemWorth(rows, at, worth);
              if (next) onChange(next);
              return !!next;
            }} />
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move ${nameOf(row.itemId) ?? 'Item'} Up`} disabled={at === 0} onClick={() => move(at, at - 1)}>
              <ArrowUp className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move ${nameOf(row.itemId) ?? 'Item'} Down`} disabled={at === rows.length - 1} onClick={() => move(at, at + 1)}>
              <ArrowDown className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove ${nameOf(row.itemId) ?? 'Item'}`} onClick={() => onChange(rows.filter((_, index) => index !== at))}>
              <X className="h-4 w-4" aria-hidden />
            </Button>
            {item && !itemStackable(item) && <Hint>{label(item.name)} isn&apos;t Stackable</Hint>}
          </div>
        );
      })}
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
