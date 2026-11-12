import { useId, type ReactElement, type ReactNode } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical, Plus, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BreadcrumbPicker, type BreadcrumbPickerRow } from '@/components/ui/breadcrumb-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import { WorldInput } from '@/components/editor/WorldField';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { fieldFrame } from '@/lib/historyField';
import { idleMinutes, idleParts, type IdleUnit } from '@/lib/routineTime';
import { dragStyle, droppedMove } from '@/lib/sortableDrag';
import { cn } from '@/lib/utils';
import { PLAYER_START, PLAYER_START_LABEL } from '@/types';

/** What the Routine tab's pickers know of the world's locations. */
export interface PlaceBook {
  nameOf: (id: string) => string;
  /** Picker rows for these location ids, in the order given. */
  rowsOf: (ids: readonly string[]) => BreadcrumbPickerRow<string>[];
  /** Every location id, in tree order. */
  all: readonly string[];
}

export const TOKEN_CLASS =
  'rounded px-0.5 font-medium underline decoration-dotted underline-offset-4 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** One part of a routine sentence: underlined text that opens its own editor. */
export function Token({ children, editor, label, wide }: { children: ReactNode; editor: ReactNode; label: string; wide?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={TOKEN_CLASS}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn('space-y-2', wide ? 'w-[min(24rem,calc(100vw-2rem))]' : 'w-72')} align="start" collisionPadding={16}>
        {editor}
      </PopoverContent>
    </Popover>
  );
}

export const UNCONNECTED_TIP = 'Not connected to the start location, so the game skips it';

/** The mark on a listed location that the start location no longer connects to. */
export const UnconnectedFlag = () => (
  <Tip tip={UNCONNECTED_TIP}>
    <span role="img" aria-label={UNCONNECTED_TIP} className="inline-flex shrink-0">
      <TriangleAlert className="h-4 w-4 text-warning" aria-hidden />
    </span>
  </Tip>
);

/** How a Start at `PLAYER_START` reads inside a routine sentence. */
export const PLAYER_START_NAME = "the player's starting location";

const PLAYER_START_ROW = { key: PLAYER_START, value: PLAYER_START, name: PLAYER_START_LABEL };

/** A searchable location list behind `trigger`. `playerStart` offers the player's starting location first. */
export function LocationPicker({ book, places, value, onPick, trigger, ariaLabel, playerStart }: {
  book: PlaceBook; places: readonly string[]; value?: string; onPick: (id: string) => void;
  trigger?: ReactElement; ariaLabel?: string; playerStart?: boolean;
}) {
  return (
    <BreadcrumbPicker
      sections={[...(playerStart ? [{ rows: [PLAYER_START_ROW] }] : []), { rows: book.rowsOf(places) }]}
      value={value}
      onPick={onPick}
      searchPlaceholder="Search locations"
      placeholder="Pick a location"
      ariaLabel={ariaLabel}
      trigger={trigger}
    />
  );
}

const UNIT_LABELS: Record<IdleUnit, string> = { minutes: 'Minutes', hours: 'Hours', dayparts: 'Parts of the Day' };

/** How long the entity waits: a number and its unit, stored in minutes. */
export function IdleField({ minutes, onChange, label, field }: {
  minutes: number; label?: string; field: string;
  /** `typed` is true for a keystroke in the number box, false for a unit pick. */
  onChange: (minutes: number, typed: boolean) => void;
}) {
  const { amount, unit } = idleParts(minutes);
  return (
    <div className="flex items-center gap-1.5" {...fieldFrame(field)}>
      {label && <span className="shrink-0 text-meta text-muted-foreground">{label}</span>}
      <WorldInput
        type="number" min={1} step={1} inputMode="numeric" className="h-8 w-16 px-2" aria-label={`${label ?? 'Wait'} Amount`}
        value={amount}
        onChange={(e) => onChange(idleMinutes(Number(e.target.value) || 1, unit), true)}
      />
      <Select value={unit} onValueChange={(next) => onChange(idleMinutes(amount, next as IdleUnit), false)}>
        <SelectTrigger className="h-8 w-auto gap-1 px-2" aria-label={`${label ?? 'Wait'} Unit`}><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(UNIT_LABELS) as IdleUnit[]).map((u) => <SelectItem key={u} value={u}>{UNIT_LABELS[u]}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

const LIST_MODIFIERS = [restrictToVerticalAxis, restrictToParentElement];

/** The Wander and Patrol location list: a grip to reorder, the location, the action's own field, then Remove. */
export function RoutinePlaceList<T extends { place: string }>({ items, book, connected, onChange, make, right, numbered, unique, after, listLabel }: {
  items: readonly T[];
  book: PlaceBook;
  /** Locations the start location connects to: the picker offers only these. */
  connected: readonly string[];
  /** `typed` is true for a keystroke in a row's own field. */
  onChange: (next: T[], typed: boolean) => void;
  make: (place: string) => T;
  right: (item: T, set: (next: T, typed: boolean) => void, index: number) => ReactNode;
  numbered?: boolean;
  /** A location may appear once. */
  unique?: boolean;
  after?: ReactNode;
  listLabel: string;
}) {
  const labelId = useId();
  const rows = items.map((_, i) => ({ id: `place-${i}` }));
  const onDragEnd = (event: DragEndEvent) => {
    const move = droppedMove(rows, event);
    if (move) onChange(arrayMove([...items], ...move), false);
  };
  const open = connected.filter((p) => !unique || !items.some((it) => it.place === p));
  return (
    <div className="space-y-1">
      <span id={labelId} className="sr-only">{listLabel}</span>
      {items.length > 0 && (
        <EditorDndContext modifiers={LIST_MODIFIERS} onDragEnd={onDragEnd}>
          <StableSortableContext items={rows} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-1" aria-labelledby={labelId}>
              {items.map((item, i) => (
                <PlaceListRow
                  key={rows[i].id}
                  id={rows[i].id}
                  index={i}
                  numbered={numbered}
                  name={book.nameOf(item.place)}
                  unconnected={!connected.includes(item.place)}
                  right={right(item, (next, typed) => onChange(items.map((x, j) => (j === i ? next : x)), typed), i)}
                  onRemove={() => onChange(items.filter((_, j) => j !== i), false)}
                />
              ))}
            </ol>
          </StableSortableContext>
        </EditorDndContext>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <LocationPicker
          book={book}
          places={open}
          onPick={(place) => onChange([...items, make(place)], false)}
          trigger={(
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-1.5" disabled={open.length === 0}>
              <Plus className="h-4 w-4" aria-hidden />Add Location
            </Button>
          )}
        />
        {after}
      </div>
    </div>
  );
}

function PlaceListRow({ id, index, numbered, name, unconnected, right, onRemove }: {
  id: string; index: number; numbered?: boolean; name: string; unconnected: boolean; right: ReactNode; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, ...drag } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={dragStyle(drag)} data-routine-place="" className="flex min-w-0 items-center gap-1 rounded-md bg-background">
      <Tip tip="Drag to reorder">
        <span
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab touch-none rounded-sm px-0.5 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </span>
      </Tip>
      {numbered && <Meta className="w-4 shrink-0 tabular-nums">{index + 1}</Meta>}
      <span className={cn('min-w-0 flex-1 truncate text-label', unconnected && 'text-warning')}>{name}</span>
      {unconnected && <UnconnectedFlag />}
      {right}
      <Tip tip={`Remove ${name}`}>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`Remove ${name}`} onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </Tip>
    </li>
  );
}
