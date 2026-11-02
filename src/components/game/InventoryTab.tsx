import { forwardRef, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Gift, Lock, Shirt, Sparkles, Undo2 } from 'lucide-react';
import { ItemIconArt } from '@/components/ItemIconArt';
import { useIsCut } from '@/components/TruncatedText';
import { Button } from '@/components/ui/button';
import { CompactSelectionRow } from '@/components/ui/compact-selection-row';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import { useDevRoute } from '@/lib/devRouter';
import { formatTimeLeft } from '@/lib/gameClock';
import type { BodySlot } from '@/lib/bodies';
import { dollColumnWidth, fillBoxes } from '@/lib/bodyLayout';
import { itemSlotNames, resolveItemIcon } from '@/lib/itemIcons';
import { byEquipOrder, copyFace, copyFacts, copyState, isUnidentified, itemUsable, occupiedSlots, ruleGaps, usesLeft, usesLine, wholeCount } from '@/lib/items';
import { THUMB_FRAME, THUMB_INTRINSIC, thumbFit } from '@/lib/thumbAspect';
import { cn } from '@/lib/utils';
import type { InventoryOp, TimedEffectView } from '@/lib/inventory';
import type { Body, Item, ItemCopy, ItemCopyWhere, RuntimeItem, Slot } from '@/types';
import { ItemModal } from '../modals/ItemModal';
import { BodyDoll } from './BodyDoll';
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
  /** The played Persona's Body in force. Absent = no Body. */
  body?: Body;
  /** The played Persona's Body slots, in entry order. Empty = no Body. */
  slots: readonly BodySlot[];
  /** Every slot of the world, so an item's icon never changes with the Body. */
  worldSlots: readonly Slot[];
  /** The In Scene entities Give can pick, each under its label (Q59). */
  present: readonly { id: string; name: string }[];
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
  /** The selected entity's card, between the player's and the location's. */
  entityCard?: ReactNode;
}

const YOU: ItemCopyWhere = { kind: 'you' };
const BOUND_TIP = "Bound: you can't drop or give it";

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

/** A row name's button. It covers the row, so the picture and the meta text press it too. */
const ROW_NAME = 'rounded-sm text-left after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring';

/** An Equipped row's name: one line, with the full text in a tooltip while it is cut (Q5). */
const EquippedRowName = forwardRef<HTMLButtonElement, ComponentProps<'button'> & { name: string }>(({ name, ...rest }, ref) => {
  const text = useRef<HTMLSpanElement>(null);
  const cut = useIsCut(text, name);
  return (
    <Tip tip={name} labelsChild={false} disabled={!cut}>
      <button ref={ref} type="button" className={cn(ROW_NAME, 'min-w-0')} {...rest}>
        <span ref={text} className="block truncate">{name}</span>
      </button>
    </Tip>
  );
});
EquippedRowName.displayName = 'EquippedRowName';

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
      <Meta>of {max}</Meta>
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

/** Give: pick an In Scene entity by its label, and a count for a stack. */
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
          <Meta as="p" role="status">No entities are in the scene.</Meta>
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

/** Equip: at once with no choice of slot, through a list of the slots when Either of leaves two or more (Q37). */
function EquipButton({ copy, item, name, slots, disabled, resolveText, onOps }: {
  copy: ItemCopy; item: Item | undefined; name: string; slots: readonly BodySlot[]; disabled: boolean;
  resolveText: (text: string) => string; onOps: InventoryTabProps['onOps'];
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const rule = item?.slotRule;
  if (copy.equipped || !rule || ruleGaps(rule, (slotId) => slots.some((s) => s.slot.id === slotId)).length) return null;
  const choices = rule.mode === 'either' ? rule.slotIds.flatMap((slotId) => slots.filter((s) => s.slot.id === slotId)) : [];
  const label = `Equip ${name}`;
  if (choices.length < 2) {
    return <ItemRowButton label={label} icon={Shirt} disabled={disabled} onClick={() => onOps([{ kind: 'equip', copyId: copy.id }])} />;
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ItemRowButton label={label} icon={Shirt} disabled={disabled} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-2 p-3">
        <p className="text-label font-medium">{label}</p>
        <div role="list" aria-label="Equip in">
          {choices.map(({ slot }) => (
            <CompactSelectionRow key={slot.id} onClick={() => { onOps([{ kind: 'equip', copyId: copy.id, slotId: slot.id }]); setOpen(false); }}>
              {resolveText(slot.name)}
            </CompactSelectionRow>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The game panel's Inventory tab: the played Persona's figure with their equipped items, then carried items,
 *  then a card for what lies at the location. */
export function InventoryTab({
  ownerName, copies, lying, items, runtimeItems = [], body, slots, worldSlots, present, locationId, locationName, disabled, resolveText, imageOf, timed = [], onOps, entityCard,
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
  const iconOf = (copy: ItemCopy) => {
    const item = itemOf(copy);
    return resolveItemIcon({
      icon: item?.icon,
      name: nameOf(copy),
      slotNames: itemSlotNames(item, worldSlots, resolveText),
      unidentified: isUnidentified(copy),
      image: imageOf?.(copy),
    });
  };
  const occupies = (c: ItemCopy, slotId: string) => occupiedSlots(c, itemOf(c)).includes(slotId);
  const equipped = shown.filter((c) => slots.some((s) => occupies(c, s.slot.id))).sort(byEquipOrder);
  // An entry whose slot is gone draws nothing.
  const entries = body?.entries.filter((e) => e.boxes.length > 0 && slots.some((s) => s.slot.id === e.slotId)) ?? [];
  const inBoxes = fillBoxes(entries, (slotId) => equipped.filter((c) => occupies(c, slotId)));
  const boxed = new Set([...inBoxes.values()].map((c) => c.id));
  // A copy with no box to draw in shows as carried, so it never hides (Q35).
  const carried = shown.filter((c) => !boxed.has(c.id));
  const lyingHere = lying.filter((c) => c.visibility === 'visible');
  const here: ItemCopyWhere | null = locationId ? { kind: 'location', id: locationId } : null;
  const [viewingId, setViewingId] = useState<string | null>(null);
  const devRoute = useDevRoute();
  const firstShown = shown[0]?.id;
  useEffect(() => {
    if (import.meta.env.DEV && devRoute?.modal === 'item' && firstShown) setViewingId(firstShown);
  }, [devRoute?.modal, firstShown]);
  // A copy that left the panel closes its popup.
  const viewing = [...shown, ...lyingHere].find((c) => c.id === viewingId);
  const descriptionOf = (copy: ItemCopy) => {
    const item = itemOf(copy);
    return (copy.item.kind === 'runtime'
      ? runtimeById.get(copy.item.runtimeItemId)?.description : resolveText(item ? copyFace(item, copy).description ?? '' : '')) ?? '';
  };
  const factsOf = (copy: ItemCopy) => {
    const item = itemOf(copy);
    return [...copyFacts(copy, item), ...(item?.bound ? [BOUND_TIP] : [])];
  };

  /** `nameControl` replaces the name's popup button, `slotLine` the row's second line. `fullName` wraps the name instead of cutting it. */
  const row = (copy: ItemCopy, actions: ReactNode, { nameControl, slotLine, fullName }: { nameControl?: ReactNode; slotLine?: string; fullName?: boolean } = {}) => {
    const item = itemOf(copy);
    const name = nameOf(copy);
    const state = copyState(copy);
    const line = slotLine ?? (copy.item.kind === 'runtime' ? runtimeById.get(copy.item.runtimeItemId)?.description : usesLine(copy, item));
    const icon = iconOf(copy);
    return (
      <li key={copy.id} className="relative flex min-h-9 items-center gap-2 rounded-md px-2 py-1 hover:bg-secondary/60">
        {icon.kind === 'image' && (
          <img
            src={icon.src} alt="" {...THUMB_INTRINSIC.portrait}
            className={cn('w-6 shrink-0 rounded', THUMB_FRAME.portrait, thumbFit('portrait'))}
          />
        )}
        {icon.kind === 'icon' && <ItemIconArt id={icon.id} className="h-6 w-6 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-label">
            {nameControl ?? (
              <button
                type="button"
                onClick={() => setViewingId(copy.id)}
                className={cn(ROW_NAME, fullName ? 'min-w-0 [overflow-wrap:anywhere]' : 'truncate')}
              >
                {name}
              </button>
            )}
            {state && <Meta className="shrink-0">{state}</Meta>}
            {copy.quantity > 1 && <Meta className="shrink-0">×{copy.quantity}</Meta>}
            {item?.bound && (
              <Tip tip={BOUND_TIP}>
                <span role="img" aria-label="Bound" className="relative shrink-0">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                </span>
              </Tip>
            )}
          </p>
          {line && <Meta as="p">{line}</Meta>}
        </div>
        <div className="relative shrink-0">{actions}</div>
      </li>
    );
  };

  const slotNameOf = (slotId: string) => resolveText(slots.find((s) => s.slot.id === slotId)?.slot.name ?? '');
  const equippedActions = (copy: ItemCopy) => (
    <div className="flex shrink-0 items-center">
      <UseButton copy={copy} item={itemOf(copy)} name={nameOf(copy)} disabled={disabled} onOps={onOps} />
      <ItemRowButton
        label={`Unequip ${nameOf(copy)}`} icon={Undo2} disabled={disabled}
        onClick={() => onOps([{ kind: 'unequip', copyId: copy.id }])}
      />
    </div>
  );
  const equippedList = (className?: string) => {
    // An All of item fills two boxes and shows one row (story 5).
    const listed = equipped.filter((c) => boxed.has(c.id));
    if (listed.length === 0) return <p role="status" className={cn('px-2 py-2 text-label text-muted-foreground', className)}>Nothing is equipped.</p>;
    return (
      <ul aria-label="Equipped Items" className={className}>
        {listed.map((copy) => row(copy, equippedActions(copy), {
          slotLine: occupiedSlots(copy, itemOf(copy)).map(slotNameOf).filter(Boolean).join(', '),
          nameControl: <EquippedRowName name={nameOf(copy)} onClick={() => setViewingId(copy.id)} />,
        }))}
      </ul>
    );
  };

  const equippedSection = (worn: Body) => {
    const doll = (
      <BodyDoll
        body={{ ...worn, entries }}
        slotName={slotNameOf}
        fills={new Map([...inBoxes].map(([key, copy]) => [key, {
          id: copy.id,
          name: nameOf(copy),
          icon: iconOf(copy),
          detail: row(copy, equippedActions(copy), { fullName: true }),
        }]))}
      />
    );
    return (
      <>
        <PanelSubheader>Equipped</PanelSubheader>
        {worn.aspect > 1 ? (
          <div data-doll-layout="stacked" className="flex flex-col gap-3">
            {doll}
            {equippedList()}
          </div>
        ) : (
          <div data-doll-layout="columns" className="flex items-start gap-3">
            <div className="shrink-0" style={{ width: dollColumnWidth(worn.aspect) }}>{doll}</div>
            {equippedList('min-w-0 flex-1')}
          </div>
        )}
      </>
    );
  };

  return (
    <ScrollArea className="h-[calc(100%-1rem)]">
      <PanelOwnerCard
        role="region" aria-label={`${ownerName ?? 'Your'} inventory`} name={ownerName ?? 'You'} entity you={ownerName !== null}
      >
        {body && entries.length > 0 && equippedSection(body)}
        <PanelSubheader>Carried</PanelSubheader>
        {carried.length === 0 ? (
          <p role="status" className="px-2 py-2 text-label text-muted-foreground">You carry nothing.</p>
        ) : (
          <ul>
            {carried.map((copy) => {
              const item = itemOf(copy);
              const name = nameOf(copy);
              const bound = !!item?.bound;
              return row(copy, (
                <div className="flex shrink-0 items-center">
                  <UseButton copy={copy} item={item} name={name} disabled={disabled} onOps={onOps} />
                  {copy.equipped && (
                    <ItemRowButton
                      label={`Unequip ${name}`} icon={Undo2} disabled={disabled}
                      onClick={() => onOps([{ kind: 'unequip', copyId: copy.id }])}
                    />
                  )}
                  <EquipButton copy={copy} item={item} name={name} slots={slots} disabled={disabled} resolveText={resolveText} onOps={onOps} />
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
                    <Meta as="p">{resolveText(view.effect)}</Meta>
                  </div>
                  <Meta className="shrink-0">{formatTimeLeft(view.hoursLeft)} left</Meta>
                </li>
              ))}
            </ul>
          </>
        )}
      </PanelOwnerCard>
      {entityCard}
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
      {viewing && (
        <ItemModal
          id={viewing.id}
          name={nameOf(viewing)}
          image={imageOf?.(viewing)}
          description={descriptionOf(viewing)}
          facts={factsOf(viewing)}
          isOpen
          onOpenChange={(open) => { if (!open) setViewingId(null); }}
        />
      )}
    </ScrollArea>
  );
}
