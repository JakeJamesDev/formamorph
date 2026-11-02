import { useState, type FocusEvent } from 'react';
import { Meta } from '@/components/ui/typography';
import { WorldInput } from '@/components/editor/WorldField';
import { valueOfCoins, type CoinAmount } from '@/lib/currency';

const countOrZero = (text: string): number => {
  const count = Math.floor(Number(text));
  return Number.isFinite(count) && count > 0 ? count : 0;
};

/**
 * One Value field per coin, largest first. Each keystroke stores the total in base units. The fields hold what
 * the author typed until focus leaves the whole group, then they show the stored total's Breakdown.
 */
export default function CoinValueFields({ id, fields, hasValue, label, onChange }: {
  id: string;
  /** The stored Value split into every coin, zeros kept. */
  fields: readonly CoinAmount[];
  /** False for an item with no Value: its fields read blank. */
  hasValue: boolean;
  label: (name: string) => string;
  onChange: (value: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const shown = (at: number) => draft?.[at] ?? (hasValue ? String(fields[at].count) : '');

  const typeInto = (at: number, text: string) => {
    const next = fields.map((_, index) => (index === at ? text : shown(index)));
    setDraft(next);
    onChange(next.every((entry) => entry.trim() === '') ? undefined : valueOfCoins(fields.map((coin, index) => ({ ...coin, count: countOrZero(next[index]) }))));
  };
  const onGroupBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setDraft(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Value" onBlur={onGroupBlur}>
      {fields.map((coin, at) => (
        <div key={coin.itemId} className="flex items-center gap-1">
          <WorldInput
            id={at === 0 ? id : undefined}
            type="number"
            min={0}
            className="w-24"
            aria-label={`Value in ${coin.name}`}
            value={shown(at)}
            onChange={(e) => typeInto(at, e.target.value)}
          />
          <Meta>{label(coin.name)}</Meta>
        </div>
      ))}
    </div>
  );
}
