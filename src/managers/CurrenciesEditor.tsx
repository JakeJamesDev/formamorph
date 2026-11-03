import { useMemo, useState } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, X } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { EditorRow, EditorRowList } from '@/components/EditorRow';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorldInput } from '@/components/editor/WorldField';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useCardCollapse } from '@/lib/cardCollapse';
import { currencyStatGroups, type CurrencyStatGroup } from '@/lib/currency/statGroups';
import { currencyUsedBy } from '@/lib/currencyDeletes';
import { fieldFrame } from '@/lib/historyField';
import { labelPlaceholders } from '@/lib/placementLetters';
import { dragStyle, droppedMove } from '@/lib/sortableDrag';
import { randomUUID } from '@/lib/uuid';
import type { Currency, CurrencyBacking, Item } from '@/types';
import ItemRows from './ItemRows';

const GROUP_HEADING = { global: 'Global Stats', linked: 'Linked to Personas' };

const groupHeading = (group: CurrencyStatGroup): string => (group.kind === 'persona' ? group.persona.name : GROUP_HEADING[group.kind]);

const KIND_LABEL: Record<CurrencyBacking['kind'], string> = { stat: 'Stat', items: 'Items', name: 'Name Only' };

/** The Items tab's Currencies entry: the world's money, in order. The first is the one a new item takes. */
const CurrenciesEditor = () => {
  const { currencies, setCurrencies, updateCurrency, removeCurrency, stats, statGroups, entities, placeholders, items } = useGameData();
  const groups = useMemo(() => currencyStatGroups({ stats, statGroups, entities }), [stats, statGroups, entities]);
  const collapse = useCardCollapse(currencies.map((c) => c.id));
  const [pending, setPending] = useState<{ currency: Currency; text: string } | null>(null);
  // A Currency no item is priced in goes at once; one in use asks first.
  const askRemove = (currency: Currency) => {
    const text = currencyUsedBy(items, currency.id);
    if (text) setPending({ currency, text });
    else removeCurrency(currency.id);
  };
  const add = () => setCurrencies([...currencies, { id: randomUUID(), name: 'New Currency', backing: { kind: 'name' } }]);
  const onDragEnd = (event: DragEndEvent) => {
    const move = droppedMove(currencies, event);
    if (move) setCurrencies(arrayMove(currencies, ...move));
  };

  return (
    <div className="space-y-6" data-testid="currencies-editor">
      <div className="space-y-2">
        <h2 id="world-currencies-label" className="font-medium">Currencies</h2>
        <Hint>Lists the money in your world. New items take the first one.</Hint>
      </div>
      <div className="space-y-2" {...fieldFrame('currencies')}>
        {currencies.length > 0 && (
          <EditorDndContext onDragEnd={onDragEnd}>
            <StableSortableContext items={currencies} strategy={verticalListSortingStrategy}>
              <EditorRowList aria-labelledby="world-currencies-label">
                {currencies.map((currency, index) => (
                  <SortableCurrency
                    key={currency.id}
                    currency={currency}
                    isDefault={index === 0}
                    expanded={collapse.isOpen(currency.id)}
                    onToggle={() => collapse.toggle(currency.id)}
                    currencies={currencies}
                    items={items}
                    groups={groups}
                    label={(name) => labelPlaceholders(name, placeholders)}
                    onChange={updateCurrency}
                    onRemove={() => askRemove(currency)}
                  />
                ))}
              </EditorRowList>
            </StableSortableContext>
          </EditorDndContext>
        )}
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1 h-4 w-4" aria-hidden />Add Currency
        </Button>
      </div>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title={`Delete ${labelPlaceholders(pending?.currency.name ?? '', placeholders) || 'Currency'}?`}
        description={pending?.text ?? ''}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (pending) removeCurrency(pending.currency.id);
          setPending(null);
        }}
      />
    </div>
  );
};

/** A Currency's row: its name, its Default mark and type, and its fields below while expanded. */
function SortableCurrency({ currency, currencies, items, groups, isDefault, expanded, onToggle, label, onChange, onRemove }: {
  currency: Currency;
  currencies: readonly Currency[];
  items: readonly Item[];
  groups: readonly CurrencyStatGroup[];
  isDefault: boolean;
  expanded: boolean;
  onToggle: () => void;
  label: (name: string) => string;
  onChange: (currency: Currency) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, ...drag } = useSortable({ id: currency.id });
  const { backing } = currency;
  const firstStat = groups[0]?.stats[0];
  const title = label(currency.name) || 'Currency';
  const pickKind = (kind: string) => {
    if (kind === backing.kind) return;
    if (kind === 'name') onChange({ ...currency, backing: { kind: 'name' } });
    else if (kind === 'stat' && firstStat) onChange({ ...currency, backing: { kind: 'stat', statId: firstStat.id } });
    else if (kind === 'items') onChange({ ...currency, backing: { kind: 'items', items: [] } });
  };
  return (
    // The node wraps the row and its fields, so an expanded Currency moves as one piece.
    <div ref={setNodeRef} style={dragStyle(drag)}>
      <EditorRow
        gripProps={{ ...attributes, ...listeners }}
        selected={false}
        onSelect={onToggle}
        selectionLabel={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
        lead="chevron"
        collapsed={!expanded}
        onToggleCollapse={onToggle}
        attached={expanded}
        label={title}
        meta={<span className="block truncate max-sm:max-w-20">{[isDefault ? 'Default' : '', KIND_LABEL[backing.kind]].filter(Boolean).join(' · ')}</span>}
        actions={[{ icon: <X className="h-4 w-4" />, destructive: true, title: `Delete ${title}`, onClick: onRemove }]}
      />
      {expanded && (
        <div className="grid gap-3 rounded-b-md border border-t-0 border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <WorldInput
              aria-label="Currency Name"
              className="h-8 w-40"
              value={currency.name}
              onChange={(e) => onChange({ ...currency, name: e.target.value })}
            />
            <Select value={backing.kind} onValueChange={pickKind}>
              <SelectTrigger className="h-8 w-32" aria-label="Currency Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stat" disabled={!firstStat}>{KIND_LABEL.stat}</SelectItem>
                <SelectItem value="name">{KIND_LABEL.name}</SelectItem>
                <SelectItem value="items">{KIND_LABEL.items}</SelectItem>
              </SelectContent>
            </Select>
            {backing.kind === 'stat' && (
              <Select value={backing.statId} onValueChange={(statId) => onChange({ ...currency, backing: { kind: 'stat', statId } })}>
                <SelectTrigger className="h-8 w-48" aria-label="Currency Stat">
                  <SelectValue placeholder="Select stat" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectGroup key={group.kind === 'persona' ? group.persona.id : group.kind}>
                      <SelectLabel>{label(groupHeading(group))}</SelectLabel>
                      {group.stats.map((stat) => <SelectItem key={stat.id} value={stat.id}>{label(stat.name)}</SelectItem>)}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {backing.kind === 'items' && (
            <ItemRows
              currency={currency}
              rows={backing.items}
              items={items}
              currencies={currencies}
              label={label}
              onChange={(rows) => onChange({ ...currency, backing: { kind: 'items', items: rows } })}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default CurrenciesEditor;
