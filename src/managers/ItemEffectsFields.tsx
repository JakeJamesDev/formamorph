import { useMemo, useState } from 'react';
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
import { itemTraitOptions, itemUsable } from '@/lib/items';
import { TURN_TIME_UNITS, joinTurnHours, splitTurnHours, type TurnTimeUnit } from '@/lib/gameClock';
import { useRuleSource } from '@/contexts/RuleSourceContext';
import type { Item, ItemEffectDuration, ItemStatEffect, ItemStatFacet, ItemTiming, ItemTraitEffect, Stat, Trait } from '@/types';

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
  { value: 'consumed', label: 'After Consumed' },
  { value: 'firstObtain', label: 'On First Obtain' },
];

/** The timings `item` offers: After Consumed only when it is Consumable or has charges (Q16). */
const timingsFor = (item: Item) => TIMINGS.filter((t) => t.value !== 'consumed' || itemUsable(item));

/** A row the editor shows. An After Consumed row of an item that can't be used stays stored and hidden. */
const shown = (item: Item, row: { timing: ItemTiming }) => row.timing !== 'consumed' || itemUsable(item);

/** A new timing, with a one-hour duration when it turns After Consumed. */
const timingPatch = (timing: ItemTiming, duration: ItemEffectDuration | undefined) =>
  ({ timing, ...(timing === 'consumed' && !duration && { duration: { kind: 'time', hours: 1 } as const }) });

const UNIT_LABELS: Record<TurnTimeUnit, [one: string, many: string]> = {
  minutes: ['Minute', 'Minutes'],
  hours: ['Hour', 'Hours'],
  days: ['Day', 'Days'],
  weeks: ['Week', 'Weeks'],
};

/** An After Consumed row's duration: Permanent, or an amount of story time (Q7). */
function DurationField({ value, onChange, frame }: {
  value: ItemEffectDuration | undefined; onChange: (duration: ItemEffectDuration) => void; frame: ReturnType<typeof fieldFrame>;
}) {
  const hours = value?.kind === 'time' ? value.hours : null;
  const [draft, setDraft] = useState(() => ({ hours, ...splitTurnHours(hours ?? 1) }));
  // A change from elsewhere (undo, another row) replaces the draft.
  if (draft.hours !== hours) setDraft({ hours, ...splitTurnHours(hours ?? 1) });
  const edit = (patch: Partial<Pick<typeof draft, 'amount' | 'unit'>>) => {
    const merged = { ...draft, ...patch };
    const next = joinTurnHours(merged.amount, merged.unit);
    const usable = next !== null && next > 0 ? next : null;
    setDraft({ ...merged, hours: usable ?? draft.hours });
    if (usable !== null) onChange({ kind: 'time', hours: usable });
  };
  return (
    <>
      <Select
        value={hours === null ? 'permanent' : draft.unit}
        onValueChange={(v) => (v === 'permanent' ? onChange({ kind: 'permanent' }) : edit({ unit: v as TurnTimeUnit }))}
      >
        <SelectTrigger className="w-32" aria-label="Duration" {...frame}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="permanent">Permanent</SelectItem>
          {TURN_TIME_UNITS.map((unit) => (
            <SelectItem key={unit} value={unit}>{UNIT_LABELS[unit][Number(draft.amount) === 1 ? 0 : 1]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hours !== null && (
        <WorldInput
          type="number" min={0} step="any" aria-label="Duration Amount" className="w-20"
          value={draft.amount} onChange={(e) => edit({ amount: e.target.value })}
        />
      )}
    </>
  );
}

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
      {rows.map((row, index) => shown(item, row) && (
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
          <Select value={row.timing} onValueChange={(timing) => update(index, timingPatch(timing as ItemTiming, row.duration))}>
            <SelectTrigger className="w-40" aria-label="Timing" {...fieldFrame('statEffects', row.id, 'timing')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timingsFor(item).map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {row.timing === 'consumed' && (
            <DurationField value={row.duration} onChange={(duration) => update(index, { duration })} frame={fieldFrame('statEffects', row.id, 'duration')} />
          )}
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

/** The item's trait effect rows: a trait and a timing each. The picker lists each owner's own traits, every id
 *  once, Automatic ones left out (Q117). */
export const ItemTraitEffectsFields = ({ item, apply }: { item: Item; apply: (patch: Partial<Item>) => void }) => {
  const source = useRuleSource();
  const label = (name: string) => (source ? labelPlaceholders(name, source.placeholders) : name);
  const owners = useMemo(() => itemTraitOptions(source?.gateInput.owners ?? []), [source]);
  const known = useMemo(() => new Map<string, Trait>(owners.flatMap((o) => o.traits.map((t) => [t.id, t]))), [owners]);
  const rows = item.traitEffects;
  const write = (next: ItemTraitEffect[]) => apply({ traitEffects: next });
  const update = (index: number, patch: Partial<ItemTraitEffect>) => write(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const add = () => write([...rows, { id: randomUUID(), traitId: '', timing: 'equipped' }]);

  return (
    <div className="space-y-2">
      <Label>Trait Effects</Label>
      <Hint>Gives whoever owns it a trait from their own list</Hint>
      {rows.map((row, index) => shown(item, row) && (
        <div key={row.id} className="flex flex-wrap items-center gap-2">
          <Select value={row.traitId || undefined} onValueChange={(traitId) => update(index, { traitId })}>
            <SelectTrigger className="w-44" aria-label="Trait" {...fieldFrame('traitEffects', row.id, 'traitId')}>
              <SelectValue placeholder="Select trait">{known.get(row.traitId) ? label(known.get(row.traitId)!.name) : row.traitId}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {owners.map((owner) => (
                <SelectGroup key={owner.id}>
                  <SelectLabel>{label(owner.name)}</SelectLabel>
                  {owner.traits.map((t) => <SelectItem key={t.id} value={t.id}>{label(t.name)}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Select value={row.timing} onValueChange={(timing) => update(index, timingPatch(timing as ItemTiming, row.duration))}>
            <SelectTrigger className="w-40" aria-label="Timing" {...fieldFrame('traitEffects', row.id, 'timing')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timingsFor(item).map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {row.timing === 'consumed' && (
            <DurationField value={row.duration} onChange={(duration) => update(index, { duration })} frame={fieldFrame('traitEffects', row.id, 'duration')} />
          )}
          <Button variant="ghost" size="icon" aria-label="Remove Trait Effect" onClick={() => write(rows.filter((_, i) => i !== index))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button size="sm" onClick={add}>Add Trait Effect</Button>
    </div>
  );
};
