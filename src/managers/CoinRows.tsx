import { useState } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorldInput } from '@/components/editor/WorldField';
import { addCoin, coinItemChoices, lacksBaseCoin, setCoinWorth } from '@/lib/currency';
import { itemStackable } from '@/lib/items';
import type { Currency, CurrencyCoin, Item } from '@/types';

/** A coin's worth, typed freely and applied when focus leaves. A worth the rules refuse snaps back with a note. */
function WorthInput({ worth, onCommit }: { worth: number; onCommit: (worth: number) => boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  return (
    <>
      <WorldInput
        aria-label="Coin Worth"
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
      {refused && <Hint role="alert">Use a whole number no other coin has. Only one coin is worth 1.</Hint>}
    </>
  );
}

/** The coin rows of one Currency: each an item and its worth in the base unit. */
export default function CoinRows({ currency, coins, items, currencies, label, onChange }: {
  currency: Currency;
  coins: readonly CurrencyCoin[];
  items: readonly Item[];
  currencies: readonly Currency[];
  label: (name: string) => string;
  onChange: (coins: CurrencyCoin[]) => void;
}) {
  const nameOf = (itemId: string) => items.find((item) => item.id === itemId)?.name;
  const choices = coinItemChoices(items, currencies);
  const move = (at: number, to: number) => {
    const next = [...coins];
    [next[at], next[to]] = [next[to], next[at]];
    onChange(next);
  };

  return (
    <div className="w-full space-y-2" data-testid={`coin-rows-${currency.id}`}>
      {lacksBaseCoin(coins, items) && <Hint>Add a coin worth 1, the smallest coin.</Hint>}
      {coins.map((coin, at) => {
        const item = items.find((other) => other.id === coin.itemId);
        return (
          <div key={coin.itemId} className="flex flex-wrap items-center gap-2">
            <Select value={coin.itemId} onValueChange={(itemId) => onChange(coins.map((other, index) => (index === at ? { ...other, itemId } : other)))}>
              <SelectTrigger className="h-8 w-48" aria-label="Coin Item">
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {coinItemChoices(items, currencies, coin.itemId).map((choice) => (
                  <SelectItem key={choice.id} value={choice.id}>{label(choice.name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <WorthInput key={coin.worth} worth={coin.worth} onCommit={(worth) => {
              const next = setCoinWorth(coins, at, worth);
              if (next) onChange(next);
              return !!next;
            }} />
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move ${nameOf(coin.itemId) ?? 'Coin'} Up`} disabled={at === 0} onClick={() => move(at, at - 1)}>
              <ArrowUp className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move ${nameOf(coin.itemId) ?? 'Coin'} Down`} disabled={at === coins.length - 1} onClick={() => move(at, at + 1)}>
              <ArrowDown className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove ${nameOf(coin.itemId) ?? 'Coin'}`} onClick={() => onChange(coins.filter((_, index) => index !== at))}>
              <X className="h-4 w-4" aria-hidden />
            </Button>
            {item && !itemStackable(item) && <Hint>{label(item.name)} is not Stackable.</Hint>}
          </div>
        );
      })}
      <Select value="" onValueChange={(itemId) => onChange(addCoin(coins, itemId, items))} disabled={choices.length === 0}>
        <SelectTrigger className="h-8 w-48" aria-label="Add Coin">
          <SelectValue placeholder={choices.length === 0 ? 'No Stackable items left' : 'Add Coin'} />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => <SelectItem key={choice.id} value={choice.id}>{label(choice.name)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
