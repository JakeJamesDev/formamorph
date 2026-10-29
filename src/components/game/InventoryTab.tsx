import { forwardRef, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { ArrowDownToLine, Gift, Lock, Shirt, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CompactSelectionRow } from '@/components/ui/compact-selection-row';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import { byEquipOrder, slotCapacity, slotSizeOf, wholeCount } from '@/lib/items';
import { THUMB_FRAME, THUMB_INTRINSIC, thumbFit } from '@/lib/thumbAspect';
import { cn } from '@/lib/utils';
import type { InventoryOp } from '@/lib/inventory';
import type { Item, ItemCopy, ItemCopyWhere, Slot } from '@/types';
import { PanelOwnerCard, PanelSubheader } from './PanelOwnerCard';

export interface InventoryTabProps {
  /** The played Persona's name for the card header. Null under None, where the header reads You. */
  ownerName: string | null;
  /** The played Persona's Item Copies. */
  copies: readonly ItemCopy[];
  /** The Item Copies lying at the player's location. Hidden ones are filtered out here. */
  lying: readonly ItemCopy[];
  items: readonly Item[];
  slots: readonly Slot[];
  /** The entities Give can pick (Q20). */
  present: readonly { id: string; name: string }[];
  locationId: string | null | undefined;
  /** Off while a turn runs (Q61) and on a past page. */
  disabled: boolean;
  resolveText: (text: string) => string;
  /** The image an Item Copy shows now, through its item's rules (Q113). Absent = no thumbnails. */
  imageOf?: (copy: ItemCopy) => string | undefined;
  onOps: (ops: InventoryOp[]) => void;
}

/** One small labeled icon button on an item row. */
const ItemRowButton = forwardRef<HTMLButtonElement, ComponentProps<typeof Button> & { label: string; icon: typeof Shirt }>(
  ({ label, icon: Icon, ...rest }, ref) => (
    <Tip tip={label}>
      <Button ref={ref} variant="ghost" size="xs" className="h-7 w-7 shrink-0 p-0" aria-label={label} {...rest}>
        <Icon className="h-4 w-4" aria-hidden />
      </Button>
    </Tip>
  ),
);
ItemRowButton.displayName = 'ItemRowButton';

/** The count a typed quantity means: a whole number from 1 to `max`, 1 for a blank field. */
const countOf = (text: string, max: number) => Math.min(max, Math.max(1, wholeCount(text) ?? 1));

/** A count field with an All choice, for Drop and Give on a stack (Q92). */
function CountField({ max, text, onChange }: { max: number; text: string; onChange: (text: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={1}
        max={max}
        value={text}
        aria-label="Quantity"
        className="h-8 w-20"
        onChange={(e) => onChange(e.target.value)}
      />
      <Button variant="outline" size="xs" onClick={() => onChange(String(max))} aria-pressed={countOf(text, max) === max}>All</Button>
      <span className="text-meta text-muted-foreground">of {max}</span>
    </div>
  );
}

/** A count popover's state. It opens on a count of 1 and closes once its button turns off (Q61). */
function useCountPopover(disabled: boolean) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('1');
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setText('1');
  };
  return { open, onOpenChange, close: () => setOpen(false), text, setText };
}

/** Drop: at once for one Item Copy, through a count for a stack. */
function DropButton({ copy, name, disabled, onDrop }: {
  copy: ItemCopy; name: string; disabled: boolean; onDrop: (quantity: number) => void;
}) {
  const { open, onOpenChange, close, text, setText } = useCountPopover(disabled);
  if (copy.quantity === 1) return <ItemRowButton label={`Drop ${name}`} icon={ArrowDownToLine} disabled={disabled} onClick={() => onDrop(1)} />;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <ItemRowButton label={`Drop ${name}`} icon={ArrowDownToLine} disabled={disabled} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3 p-3">
        <p className="text-label font-medium">Drop {name}</p>
        <CountField max={copy.quantity} text={text} onChange={setText} />
        <div className="flex justify-end">
          <Button size="xs" onClick={() => { onDrop(countOf(text, copy.quantity)); close(); }}>Drop</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Give: pick a present entity, and a count for a stack. */
function GiveButton({ copy, name, present, disabled, onGive }: {
  copy: ItemCopy; name: string; present: InventoryTabProps['present']; disabled: boolean;
  onGive: (entityId: string, quantity: number) => void;
}) {
  const { open, onOpenChange, close, text, setText } = useCountPopover(disabled);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <ItemRowButton label={`Give ${name}`} icon={Gift} disabled={disabled} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-2 p-3">
        <p className="text-label font-medium">Give {name}</p>
        {copy.quantity > 1 && <CountField max={copy.quantity} text={text} onChange={setText} />}
        {present.length === 0 ? (
          <p role="status" className="text-meta text-muted-foreground">Nobody is here.</p>
        ) : (
          <div role="list" aria-label="Give to">
            {present.map((entity) => (
              <CompactSelectionRow key={entity.id} onClick={() => { onGive(entity.id, countOf(text, copy.quantity)); close(); }}>
                {entity.name}
              </CompactSelectionRow>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const lineFor = (copy: ItemCopy, item: Item | undefined): string | null => {
  const charges = copy.state?.charges;
  return charges !== undefined && item?.charges !== undefined ? `${charges} of ${item.charges} charges` : null;
};

/** The game panel's Inventory tab: the played Persona's slots with their equipped items, then carried items. */
export function InventoryTab({
  ownerName, copies, lying, items, slots, present, locationId, disabled, resolveText, imageOf, onOps,
}: InventoryTabProps) {
  const byId = new Map(items.map((item) => [item.id, item]));
  // Hidden Item Copies never show in the panel (story 79).
  const shown = copies.filter((c) => c.visibility === 'visible');
  const itemOf = (copy: ItemCopy) => (copy.item.kind === 'item' ? byId.get(copy.item.itemId) : undefined);
  const nameOf = (copy: ItemCopy) => resolveText(itemOf(copy)?.name ?? '') || 'Unknown Item';
  const equipped = shown.filter((c) => c.equipped).sort(byEquipOrder);
  const carried = shown.filter((c) => !c.equipped);
  const lyingHere = lying.filter((c) => c.visibility === 'visible');
  const here: ItemCopyWhere | null = locationId ? { kind: 'location', id: locationId } : null;

  const row = (copy: ItemCopy, actions: ReactNode) => {
    const item = itemOf(copy);
    const name = nameOf(copy);
    const line = lineFor(copy, item);
    const image = imageOf?.(copy);
    return (
      <li key={copy.id} className="flex min-h-9 items-center gap-2 rounded-md px-2 py-1 hover:bg-secondary/60">
        {image && (
          <img
            src={image} alt="" {...THUMB_INTRINSIC.portrait}
            className={cn('w-6 shrink-0 rounded', THUMB_FRAME.portrait, thumbFit('portrait'))}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-label">
            <span className="truncate">{name}</span>
            {copy.quantity > 1 && <span className="shrink-0 text-meta text-muted-foreground">×{copy.quantity}</span>}
            {item?.bound && (
              <Tip tip="Bound: you can't drop or give it">
                <span role="img" aria-label="Bound" className="shrink-0">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                </span>
              </Tip>
            )}
          </p>
          {line && <p className="text-meta text-muted-foreground">{line}</p>}
        </div>
        {actions}
      </li>
    );
  };

  return (
    <ScrollArea className="h-[calc(100%-1rem)]">
      <PanelOwnerCard
        role="region" aria-label={`${ownerName ?? 'Your'} inventory`} name={ownerName ?? 'You'} entity you={ownerName !== null}
      >
        {slots.length > 0 && (
          <>
            <PanelSubheader>Equipped</PanelSubheader>
            <ul className="space-y-0.5">
              {slots.map((slot) => {
                const inSlot = equipped.filter((c) => c.equipped?.slotId === slot.id);
                // The count shows visible items only: a hidden equipped one takes capacity unseen (Q112).
                const used = equipped.filter((c) => c.equipped?.slotId === slot.id)
                  .reduce((sum, c) => sum + slotSizeOf(itemOf(c)), 0);
                const capacity = slotCapacity(slot);
                return (
                  <li key={slot.id} className="flex gap-2 rounded-md bg-background/40 px-1 py-0.5" aria-label={slot.name}>
                    <div className="w-16 shrink-0 py-1.5 pl-1">
                      <p className="truncate text-meta font-medium text-muted-foreground">{resolveText(slot.name)}</p>
                      {capacity > 1 && <p className="text-meta text-muted-foreground">{used} of {capacity}</p>}
                    </div>
                    {inSlot.length === 0 ? (
                      <p className="flex-1 py-1.5 text-label text-muted-foreground">Empty</p>
                    ) : (
                      <ul className="min-w-0 flex-1">
                        {inSlot.map((copy) => row(copy, (
                          <ItemRowButton
                            label={`Unequip ${nameOf(copy)}`} icon={Undo2} disabled={disabled}
                            onClick={() => onOps([{ kind: 'unequip', copyId: copy.id }])}
                          />
                        )))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <PanelSubheader>Carried</PanelSubheader>
        {carried.length === 0 ? (
          <p role="status" className="px-2 py-2 text-label text-muted-foreground">You carry nothing.</p>
        ) : (
          <ul>
            {carried.map((copy) => {
              const item = itemOf(copy);
              const name = nameOf(copy);
              const bound = !!item?.bound;
              const equippable = !!item?.slotId && slots.some((s) => s.id === item.slotId);
              return row(copy, (
                <div className="flex shrink-0 items-center">
                  {equippable && (
                    <ItemRowButton
                      label={`Equip ${name}`} icon={Shirt} disabled={disabled}
                      onClick={() => onOps([{ kind: 'equip', copyId: copy.id }])}
                    />
                  )}
                  {bound ? (
                    <>
                      <ItemRowButton label={`Drop ${name}: Bound`} icon={ArrowDownToLine} disabled />
                      <ItemRowButton label={`Give ${name}: Bound`} icon={Gift} disabled />
                    </>
                  ) : (
                    <>
                      <DropButton
                        copy={copy} name={name} disabled={disabled || !here}
                        onDrop={(quantity) => here && onOps([{ kind: 'transfer', copyId: copy.id, to: here, quantity }])}
                      />
                      <GiveButton
                        copy={copy} name={name} present={present} disabled={disabled}
                        onGive={(id, quantity) => onOps([{ kind: 'transfer', copyId: copy.id, to: { kind: 'entity', id }, quantity }])}
                      />
                    </>
                  )}
                </div>
              ));
            })}
          </ul>
        )}
        <PanelSubheader>Here</PanelSubheader>
        {lyingHere.length === 0 ? (
          <p role="status" className="px-2 py-2 text-label text-muted-foreground">Nothing lies here.</p>
        ) : (
          <ul aria-label="Here">{lyingHere.map((copy) => row(copy, null))}</ul>
        )}
      </PanelOwnerCard>
    </ScrollArea>
  );
}
