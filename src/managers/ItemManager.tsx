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
import { ImageGallery, ImageTags } from './ImageTagsField';
import ScopedPlaceholdersSection from './ScopedPlaceholdersSection';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { useEditorMode } from '@/lib/editorMode';
import { fieldFrame } from '@/lib/historyField';
import { itemStackable, slotCapacity, wholeCount } from '@/lib/items';
import { labelPlaceholders } from '@/lib/placementLetters';
import { canBePlayer } from '@/lib/owners';
import { itemPanelTabsFor, type ItemPanelTab } from '@/views/itemPanelTabs';
import type { Item, ItemValueUnit } from '@/types';

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

/** The item fields beyond its descriptions: value, stacking, use, charges, the lock, and equipping. */
const ItemPropertiesFields = ({ item, apply }: { item: Item; apply: (patch: Partial<Item>) => void }) => {
  const { playStats, entities, slots, placeholders } = useGameData();
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
  const charged = item.charges !== undefined;
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
        hint={charged ? 'Clear Charges to turn this on' : 'Groups Item Copies into one row with a quantity'}
        checked={itemStackable(item)}
        disabled={charged}
        onChange={(stackable) => apply({ stackable })}
      />
      <CheckRow
        id={id('consumable')}
        field="consumable"
        label="Consumable"
        hint="Lets the owner use it up"
        checked={!!item.consumable}
        onChange={(consumable) => apply({ consumable: consumable || undefined })}
      />

      <div className="space-y-2" {...fieldFrame('charges')}>
        <Label htmlFor={id('charges')}>Charges</Label>
        <Hint>Sets the uses each Item Copy starts with. Blank means none.</Hint>
        <WorldInput
          id={id('charges')}
          type="number"
          min={1}
          className="w-32"
          value={item.charges ?? ''}
          onChange={(e) => {
            const charges = wholeCount(e.target.value);
            // Charges turn stacking off (Q47); clearing them leaves it off (Q76).
            apply(charges === undefined ? { charges: undefined } : { charges: Math.max(1, charges), stackable: false });
          }}
        />
      </div>

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
