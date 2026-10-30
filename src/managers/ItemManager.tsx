import { useMemo, type ReactNode } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { PanelTabContent, PanelTabs } from '@/components/ui/panel-tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlaceholderNameField } from '@/components/prompt/PlaceholderField';
import { WorldInput } from '@/components/editor/WorldField';
import { useItemRuleHost } from '@/components/editor/ImageRuleCog';
import { EntityDescriptionFields, EntityImageWidget } from './EntityFields';
import { ItemEffectsFields, ItemTraitEffectsFields } from './ItemEffectsFields';
import { ItemRequirementsField } from './ItemRequirementsField';
import { ItemScripts } from './ItemScripts';
import { ImageGallery, ImageTags } from './ImageTagsField';
import ScopedPlaceholdersSection from './ScopedPlaceholdersSection';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { useEditorMode } from '@/lib/editorMode';
import { fieldFrame } from '@/lib/historyField';
import { WHEN_EMPTY_LABEL, itemStackable, slotCapacity, whenEmptyOf, wholeCount } from '@/lib/items';
import { labelPlaceholders } from '@/lib/placementLetters';
import { canBePlayer } from '@/lib/owners';
import { itemPanelTabsFor, type ItemPanelTab } from '@/views/itemPanelTabs';
import type { Item, ItemValueUnit, ItemWhenEmpty } from '@/types';

const WHEN_EMPTY_KINDS = ['stays', 'gone', 'becomes', 'changesState'] as const satisfies readonly ItemWhenEmpty['kind'][];

const NO_UNIT = 'none';
const TEXT_UNIT = 'text';

/** One switch with its label and help line. */
const CheckRow = ({ id, field, label, hint, checked, disabled, onChange }: {
  id: string;
  field: string;
  label: string;
  hint: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <div className="space-y-1" {...fieldFrame(field)}>
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(c) => onChange(!!c)} />
      <Label htmlFor={id}>{label}</Label>
    </div>
    <Hint>{hint}</Hint>
  </div>
);

/** The item fields beyond its descriptions: value, stacking, uses, the lock, and equipping. */
const ItemPropertiesFields = ({ item, apply }: { item: Item; apply: (patch: Partial<Item>) => void }) => {
  const { playStats, entities, slots, placeholders, items } = useGameData();
  const label = (name: string) => labelPlaceholders(name, placeholders);
  // The Global Stats, then each persona's own (Q75).
  const statGroups = useMemo(() => [
    { name: 'Global', stats: playStats },
    ...entities.filter(canBePlayer).map((e) => ({ name: e.name, stats: e.stats ?? [] })),
  ].filter((g) => g.stats.length), [playStats, entities]);
  const unit = item.valueUnit;
  const unitValue = !unit ? NO_UNIT : unit.kind === 'text' ? TEXT_UNIT : unit.statId;
  const pickUnit = (value: string) => {
    const next: ItemValueUnit | undefined = value === NO_UNIT ? undefined
      : value === TEXT_UNIT ? { kind: 'text', text: unit?.kind === 'text' ? unit.text : '' }
        : { kind: 'stat', statId: value };
    apply({ valueUnit: next });
  };
  const slot = slots.find((s) => s.id === item.slotId);
  const multiUse = (item.uses ?? 1) > 1;
  const empty = item.uses === undefined ? undefined : whenEmptyOf(item);
  const others = items.filter((i) => i.id !== item.id);
  const pickEmpty = (kind: ItemWhenEmpty['kind']) => apply({
    whenEmpty: kind === 'becomes' ? { kind, itemId: empty?.kind === 'becomes' ? empty.itemId : others[0]?.id ?? '' }
      : kind === 'changesState' ? { kind, state: empty?.kind === 'changesState' ? empty.state : '' }
        : { kind },
  });
  const id = (field: string) => `item-${field}-${item.id}`;

  return (
    <div className="space-y-5">
      <div className="space-y-2" {...fieldFrame('value')}>
        <Label htmlFor={id('value')}>Value</Label>
        <Hint>Tells the AI and the player what it&apos;s worth</Hint>
        <div className="flex flex-wrap items-center gap-2">
          <WorldInput
            id={id('value')}
            type="number"
            className="w-32"
            value={item.value ?? ''}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (e.target.value.trim() === '') apply({ value: undefined });
              else if (Number.isFinite(value)) apply({ value });
            }}
          />
          <Select value={unitValue} onValueChange={pickUnit}>
            <SelectTrigger className="w-48" aria-label="Value Unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_UNIT}>No Unit</SelectItem>
              <SelectItem value={TEXT_UNIT}>Text</SelectItem>
              {statGroups.map((g) => (
                <SelectGroup key={g.name}>
                  <SelectLabel>{label(g.name)}</SelectLabel>
                  {g.stats.map((s) => <SelectItem key={s.id} value={s.id}>{label(s.name)}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          {unit?.kind === 'text' && (
            <WorldInput
              aria-label="Unit Text"
              className="w-40"
              placeholder="gold coins"
              value={unit.text}
              onChange={(e) => apply({ valueUnit: { kind: 'text', text: e.target.value } })}
            />
          )}
        </div>
      </div>

      <CheckRow
        id={id('stackable')}
        field="stackable"
        label="Stackable"
        hint={multiUse ? 'Set Uses to 1 or blank to turn this on' : 'Groups Item Copies into one row with a quantity'}
        checked={itemStackable(item)}
        disabled={multiUse}
        onChange={(stackable) => apply({ stackable })}
      />
      <div className="space-y-2" {...fieldFrame('uses')}>
        <Label htmlFor={id('uses')}>Uses</Label>
        <Hint>Sets how many times each Item Copy can be used. Blank means unlimited.</Hint>
        <WorldInput
          id={id('uses')}
          type="number"
          min={1}
          className="w-32"
          value={item.uses ?? ''}
          onChange={(e) => {
            const typed = wholeCount(e.target.value);
            if (typed === undefined) return apply({ uses: undefined, whenEmpty: undefined });
            const uses = Math.max(1, typed);
            // Uses 2+ turn stacking off; When Empty starts as Gone (Q26).
            apply({ uses, ...(uses > 1 && { stackable: false }), ...(!item.whenEmpty && { whenEmpty: { kind: 'gone' } }) });
          }}
        />
      </div>
      <div className="space-y-2" {...fieldFrame('state')}>
        <Label htmlFor={id('state')}>State</Label>
        <Hint>Sets the word each Item Copy starts with, such as sealed</Hint>
        <WorldInput
          id={id('state')}
          className="w-48"
          value={item.state ?? ''}
          onChange={(e) => apply({ state: e.target.value || undefined })}
        />
      </div>
      {empty && (
        <div className="space-y-2" {...fieldFrame('whenEmpty')}>
          <Label id={id('when-empty-label')}>When Empty</Label>
          <Hint>Picks what happens to an Item Copy after its last use</Hint>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={empty.kind} onValueChange={(kind) => pickEmpty(kind as ItemWhenEmpty['kind'])}>
              <SelectTrigger className="w-48" aria-labelledby={id('when-empty-label')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WHEN_EMPTY_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind} disabled={kind === 'becomes' && !others.length}>{WHEN_EMPTY_LABEL[kind]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {empty.kind === 'becomes' && (
              <Select value={empty.itemId || undefined} onValueChange={(itemId) => apply({ whenEmpty: { kind: 'becomes', itemId } })}>
                <SelectTrigger className="w-48" aria-label="Becomes Item">
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {others.map((i) => <SelectItem key={i.id} value={i.id}>{label(i.name) || 'Unnamed Item'}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {empty.kind === 'changesState' && (
              <WorldInput
                aria-label="New State"
                className="w-40"
                placeholder="opened"
                value={empty.state}
                onChange={(e) => apply({ whenEmpty: { kind: 'changesState', state: e.target.value } })}
              />
            )}
          </div>
        </div>
      )}

      <CheckRow
        id={id('bound')}
        field="bound"
        label="Bound"
        hint="Keeps the player from dropping it or giving it away"
        checked={!!item.bound}
        onChange={(bound) => apply({ bound: bound || undefined })}
      />

      <div className="space-y-2" {...fieldFrame('slotId')}>
        <Label id={id('slot-label')}>Slot</Label>
        <Hint>Picks the slot it equips into. Add slots on the <b>Overview</b> tab.</Hint>
        <Select
          value={slot ? slot.id : NO_UNIT}
          onValueChange={(v) => apply(v === NO_UNIT ? { slotId: undefined, slotSize: undefined } : { slotId: v })}
        >
          <SelectTrigger className="w-48" aria-labelledby={id('slot-label')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_UNIT}>Not Equippable</SelectItem>
            {slots.map((s) => <SelectItem key={s.id} value={s.id}>{label(s.name) || 'Unnamed Slot'}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {slot && (
        <div className="space-y-2" {...fieldFrame('slotSize')}>
          <Label htmlFor={id('slot-size')}>Slot Size</Label>
          <Hint>Sets how much of the slot&apos;s capacity it takes</Hint>
          <WorldInput
            id={id('slot-size')}
            type="number"
            min={1}
            max={slotCapacity(slot)}
            className="w-32"
            value={item.slotSize ?? 1}
            onChange={(e) => {
              const size = wholeCount(e.target.value);
              if (size === undefined) return;
              const clamped = Math.min(Math.max(1, size), slotCapacity(slot));
              apply({ slotSize: clamped === 1 ? undefined : clamped });
            }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Right-panel editor for one item: Profile, Descriptions, Properties, Effects and, in Advanced mode, its own
 * Placeholders. The panel remounts per item, so the tab and the open placeholder arrive as props.
 */
const ItemManager = ({ item, tab, onTabChange, placeholderId, onPlaceholderIdChange, onOpenWorldPlaceholder }: {
  item: Item;
  tab: ItemPanelTab;
  onTabChange: (tab: ItemPanelTab) => void;
  placeholderId: string | null;
  onPlaceholderIdChange: (id: string | null) => void;
  onOpenWorldPlaceholder: (id: string) => void;
}) => {
  const { updateItem, placeholders } = useGameData();
  const { advanced } = useEditorMode();
  const { draft, apply, setField } = useEditingDraft<Item>(item, updateItem);
  const ruleHost = useItemRuleHost(item.id);
  const groupProps = { value: draft, onChange: setField, placeholders, ownerId: item.id };

  return (
    <PanelTabs
      tabs={itemPanelTabsFor(advanced)}
      value={tab}
      onValueChange={onTabChange}
      stripLabel="Item Fields"
      surfaceTabs="worldEditorItem"
    >
      <PanelTabContent value="profile">
        <EntityImageWidget {...groupProps} ruleHost={ruleHost} imageId={`item-image-${item.id}`}>
          <div className="grid gap-4 sm:grid-cols-[18rem_minmax(0,1fr)] md:grid-cols-1 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <ImageGallery />
            <div className="space-y-4">
              <div className="space-y-2" {...fieldFrame('name')}>
                <Label>Name</Label>
                <PlaceholderNameField
                  value={draft.name}
                  onChange={(v) => setField('name', v)}
                  placeholders={placeholders}
                  ownerId={item.id}
                  ariaLabel="Name"
                />
              </div>
              <ImageTags />
            </div>
          </div>
        </EntityImageWidget>
      </PanelTabContent>

      <PanelTabContent value="descriptions">
        <EntityDescriptionFields {...groupProps} />
      </PanelTabContent>

      <PanelTabContent value="properties">
        <ItemPropertiesFields item={draft} apply={apply} />
      </PanelTabContent>

      <PanelTabContent value="effects">
        <div className="space-y-6">
          <ItemEffectsFields item={draft} apply={apply} />
          <ItemTraitEffectsFields item={draft} apply={apply} />
        </div>
      </PanelTabContent>

      <PanelTabContent value="requirements">
        <ItemRequirementsField item={draft} apply={apply} />
      </PanelTabContent>

      {advanced && (
        <PanelTabContent value="scripts">
          <ItemScripts item={draft} ownerName={labelPlaceholders(draft.name, placeholders)} onChange={(scripts) => setField('scripts', scripts)} />
        </PanelTabContent>
      )}

      {advanced && (
        <PanelTabContent value="placeholders" fill>
          <ScopedPlaceholdersSection
            kind="item"
            ownerId={item.id}
            selectedId={placeholderId}
            onSelect={onPlaceholderIdChange}
            onOpenWorldPlaceholder={onOpenWorldPlaceholder}
          />
        </PanelTabContent>
      )}
    </PanelTabs>
  );
};

export default ItemManager;
