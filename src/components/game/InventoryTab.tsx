import { forwardRef, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Gift, Lock, Shirt, Sparkles, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CompactSelectionRow } from '@/components/ui/compact-selection-row';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tip } from '@/components/ui/tooltip';
import { formatTimeLeft } from '@/lib/gameClock';
import { byEquipOrder, copyFace, copyState, itemUsable, slotCapacity, slotSizeOf, usesLeft, wholeCount } from '@/lib/items';
import { THUMB_FRAME, THUMB_INTRINSIC, thumbFit } from '@/lib/thumbAspect';
import { cn } from '@/lib/utils';
import type { InventoryOp, TimedEffectView } from '@/lib/inventory';
import type { Item, ItemCopy, ItemCopyWhere, RuntimeItem, Slot } from '@/types';
import { PanelOwnerCard, PanelSubheader } from './PanelOwnerCard';

export interface InventoryTabProps {
  /** The played Persona's name for the card header. Null under None, where the header reads You. */
  ownerName: string | null;
  /** The played Persona's Item Copies. */
  copies: readonly ItemCopy[];
  /** The Item Copies lying at the player's location. Hidden ones are filtered out here. */
  lying: readonly ItemCopy[];
  items: readonly Item[];
  /** The runtime items the Inventory pass made. Absent ⇒ none. */
  runtimeItems?: readonly RuntimeItem[];
  slots: readonly Slot[];
  /** The entities Give can pick (Q20). Give lists the In Scene ones first. */
  present: readonly { id: string; name: string; inScene?: boolean }[];
  locationId: string | null | undefined;
  /** The current location's name for the Here card's header. Null or absent reads Here. */
  locationName?: string | null;
  /** Off while a turn runs (Q61) and on a past page. */
  disabled: boolean;
  resolveText: (text: string) => string;
  /** The image an Item Copy shows now, through its item's rules (Q113). Absent = no thumbnails. */
  imageOf?: (copy: ItemCopy) => string | undefined;
  /** The After Use effects running on the played Persona (Q40). */
  timed?: readonly TimedEffectView[];
  onOps: (ops: InventoryOp[]) => void;
}

const YOU: ItemCopyWhere = { kind: 'you' };

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

/** Drop or Pick Up: at once for one Item Copy, through a count for a stack. */
function MoveButton({ verb, icon, copy, name, disabled, onMove }: {
  verb: 'Drop' | 'Pick Up'; icon: typeof Shirt; copy: ItemCopy; name: string; disabled: boolean; onMove: (quantity: number) => void;
}) {
  const { open, onOpenChange, close, text, setText } = useCountPopover(disabled);
  const label = `${verb} ${name}`;
  if (copy.quantity === 1) return <ItemRowButton label={label} icon={icon} disabled={disabled} onClick={() => onMove(1)} />;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <ItemRowButton label={label} icon={icon} disabled={disabled} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3 p-3">
        <p className="text-label font-medium">{label}</p>
        <CountField max={copy.quantity} text={text} onChange={setText} />
        <div className="flex justify-end">
          <Button size="xs" onClick={() => { onMove(countOf(text, copy.quantity)); close(); }}>{verb}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Give: pick a present entity, and a count for a stack. A divider sets the In Scene entities above the rest. */
function GiveButton({ copy, name, present, disabled, onGive }: {
  copy: ItemCopy; name: string; present: InventoryTabProps['present']; disabled: boolean;
  onGive: (entityId: string, quantity: number) => void;
}) {
  const { open, onOpenChange, close, text, setText } = useCountPopover(disabled);
  const inScene = present.filter((entity) => entity.inScene);
  const rest = present.filter((entity) => !entity.inScene);
  const rows = (entities: InventoryTabProps['present']) => entities.map((entity) => (
    <CompactSelectionRow key={entity.id} onClick={() => { onGive(entity.id, countOf(text, copy.quantity)); close(); }}>
      {entity.name}
    </CompactSelectionRow>
  ));
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
            {rows(inScene)}
            {inScene.length > 0 && rest.length > 0 && <Separator className="my-1" />}
            {rows(rest)}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Uses left: "N of M uses" for Uses 2+; a Uses 1 copy shows a line only once spent (Q30). */
const lineFor = (copy: ItemCopy, item: Item | undefined): string | null => {
  const left = usesLeft(copy, item);
  if (left === undefined || item?.uses === undefined) return null;
  if (item.uses > 1) return `${left} of ${item.uses} uses`;
  return left === 0 ? 'No uses left' : null;
};

/** Use, for an item with Uses, After Use effects or a When Used script, or a runtime item (Q20, Q56). Off at
 *  zero uses. */
function UseButton({ copy, item, name, disabled, onOps }: {
  copy: ItemCopy; item: Item | undefined; name: string; disabled: boolean; onOps: InventoryTabProps['onOps'];
}) {
  if (copy.item.kind === 'item' && (!item || !itemUsable(item))) return null;
  const spent = usesLeft(copy, item) === 0;
  return (
    <ItemRowButton
      label={spent ? `Use ${name}: no uses left` : `Use ${name}`} icon={Sparkles} disabled={disabled || spent}
      onClick={() => onOps([{ kind: 'use', copyId: copy.id }])}
    />
  );
}

/** The game panel's Inventory tab: the played Persona's slots with their equipped items, then carried items,
 *  then a card for what lies at the location. */
export function InventoryTab({
  ownerName, copies, lying, items, runtimeItems = [], slots, present, locationId, locationName, disabled, resolveText, imageOf, timed = [], onOps,
}: InventoryTabProps) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const runtimeById = new Map(runtimeItems.map((item) => [item.id, item]));
  // Hidden Item Copies never show in the panel (story 79).
  const shown = copies.filter((c) => c.visibility === 'visible');
  const itemOf = (copy: ItemCopy) => (copy.item.kind === 'item' ? byId.get(copy.item.itemId) : undefined);
  // An unidentified copy goes by its unidentified face (Q17).
  const nameOf = (copy: ItemCopy) => {
    const item = itemOf(copy);
    return (copy.item.kind === 'runtime'
      ? runtimeById.get(copy.item.runtimeItemId)?.name : resolveText(item ? copyFace(item, copy).name : '')) || 'Unknown Item';
  };
  const equipped = shown.filter((c) => c.equipped).sort(byEquipOrder);
  const carried = shown.filter((c) => !c.equipped);
  const lyingHere = lying.filter((c) => c.visibility === 'visible');
  const here: ItemCopyWhere | null = locationId ? { kind: 'location', id: locationId } : null;

  const row = (copy: ItemCopy, actions: ReactNode) => {
    const item = itemOf(copy);
    const name = nameOf(copy);
    const state = copyState(copy);
    const line = copy.item.kind === 'runtime' ? runtimeById.get(copy.item.runtimeItemId)?.description : lineFor(copy, item);
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
            {state && <span className="shrink-0 text-meta text-muted-foreground">{state}</span>}
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
                          <div className="flex shrink-0 items-center">
                            <UseButton copy={copy} item={itemOf(copy)} name={nameOf(copy)} disabled={disabled} onOps={onOps} />
                            <ItemRowButton
                              label={`Unequip ${nameOf(copy)}`} icon={Undo2} disabled={disabled}
                              onClick={() => onOps([{ kind: 'unequip', copyId: copy.id }])}
                            />
                          </div>
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
                  <UseButton copy={copy} item={item} name={name} disabled={disabled} onOps={onOps} />
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
                      <MoveButton
                        verb="Drop" icon={ArrowDownToLine} copy={copy} name={name} disabled={disabled || !here}
                        onMove={(quantity) => here && onOps([{ kind: 'transfer', copyId: copy.id, to: here, quantity }])}
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
        {timed.length > 0 && (
          <>
            <PanelSubheader>Effects</PanelSubheader>
            <ul aria-label="Effects">
              {timed.map((view) => (
                <li key={view.key} className="flex min-h-9 items-center gap-2 rounded-md px-2 py-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-label">{view.itemName === null ? 'An item' : resolveText(view.itemName)}</p>
                    <p className="text-meta text-muted-foreground">{resolveText(view.effect)}</p>
                  </div>
                  <span className="shrink-0 text-meta text-muted-foreground">{formatTimeLeft(view.hoursLeft)} left</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </PanelOwnerCard>
      {/* A location is not an owner (Q69), so what lies here gets its own card. */}
      <PanelOwnerCard role="region" aria-label="Here" name={locationName || 'Here'} className="mt-2">
        {lyingHere.length === 0 ? (
          <p role="status" className="px-2 py-2 text-label text-muted-foreground">Nothing lies here.</p>
        ) : (
          <ul aria-label="Lying here">
            {lyingHere.map((copy) => row(copy, (
              <MoveButton
                verb="Pick Up" icon={ArrowUpFromLine} copy={copy} name={nameOf(copy)} disabled={disabled}
                onMove={(quantity) => onOps([{ kind: 'transfer', copyId: copy.id, to: YOU, quantity }])}
              />
            )))}
          </ul>
        )}
      </PanelOwnerCard>
    </ScrollArea>
  );
}
