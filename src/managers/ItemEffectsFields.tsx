import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorldInput } from '@/components/editor/WorldField';
import { fieldFrame } from '@/lib/historyField';
import { labelPlaceholders } from '@/lib/placementLetters';
import { resolvedEntityStats } from '@/lib/statLinks';
import { randomUUID } from '@/lib/uuid';
import type { Item, ItemStatEffect, ItemStatFacet, ItemTiming, Stat } from '@/types';

const FACETS: { value: ItemStatFacet; label: string }[] = [
  { value: 'value', label: 'Value' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'regen', label: 'Regen' },
];

/** The timings this editor offers. */
const TIMINGS: { value: ItemTiming; label: string }[] = [
  { value: 'equipped', label: 'While Equipped' },
  { value: 'owned', label: 'While Owned' },
  { value: 'firstObtain', label: 'On First Obtain' },
];

/** The item's stat effect rows: a stat, a facet, a timing and an amount each (Q50, Q51). */
export const ItemEffectsFields = ({ item, apply }: { item: Item; apply: (patch: Partial<Item>) => void }) => {
  const { stats, statGroups, entities, placeholders } = useGameData();
  const label = (name: string) => labelPlaceholders(name, placeholders);
  // Each owner's own stats under its name, every stat id once (Q108).
  const owners = useMemo(() => {
    const seen = new Set<string>();
    return entities.flatMap((entity) => {
      const own = resolvedEntityStats({ stats, statGroups }, entity).filter((s) => !seen.has(s.id) && seen.add(s.id));
      return own.length ? [{ id: entity.id, name: entity.name, stats: own }] : [];
    });
  }, [entities, stats, statGroups]);
  const known = useMemo(() => new Map<string, Stat>(owners.flatMap((o) => o.stats.map((s) => [s.id, s]))), [owners]);
  const rows = item.statEffects;
  const write = (next: ItemStatEffect[]) => apply({ statEffects: next });
  const update = (index: number, patch: Partial<ItemStatEffect>) => write(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const add = () => write([...rows, { id: randomUUID(), statId: '', facet: 'value', timing: 'equipped', amount: 0, op: 'add' }]);

  return (
    <div className="space-y-2">
      <Label>Stat Effects</Label>
      <Hint>Changes the stats of whoever owns it</Hint>
      {rows.map((row, index) => (
        <div key={row.id} className="flex flex-wrap items-center gap-2">
          <Select value={row.statId || undefined} onValueChange={(statId) => update(index, { statId })}>
            <SelectTrigger className="w-44" aria-label="Stat" {...fieldFrame('statEffects', row.id, 'statId')}>
              <SelectValue placeholder="Select stat">{known.get(row.statId) ? label(known.get(row.statId)!.name) : row.statId}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {owners.map((owner) => (
                <SelectGroup key={owner.id}>
                  <SelectLabel>{label(owner.name)}</SelectLabel>
                  {owner.stats.map((s) => <SelectItem key={s.id} value={s.id}>{label(s.name)}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Select value={row.facet} onValueChange={(facet) => update(index, { facet: facet as ItemStatFacet })}>
            <SelectTrigger className="w-28" aria-label="Facet" {...fieldFrame('statEffects', row.id, 'facet')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FACETS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={row.timing} onValueChange={(timing) => update(index, { timing: timing as ItemTiming })}>
            <SelectTrigger className="w-40" aria-label="Timing" {...fieldFrame('statEffects', row.id, 'timing')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMINGS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <WorldInput
            type="number"
            aria-label="Amount"
            className="w-24"
            value={row.amount}
            onChange={(e) => {
              const amount = Number(e.target.value);
              if (Number.isFinite(amount)) update(index, { amount });
            }}
            {...fieldFrame('statEffects', row.id, 'amount')}
          />
          <Button variant="ghost" size="icon" aria-label="Remove Stat Effect" onClick={() => write(rows.filter((_, i) => i !== index))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button size="sm" onClick={add}>Add Stat Effect</Button>
    </div>
  );
};
