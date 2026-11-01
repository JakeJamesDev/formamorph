import { useState, type ReactNode } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Copy, Plus, TriangleAlert, X } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CollapseAllButton } from '@/components/CollapseAllButton';
import { EditorRow, EditorRowList } from '@/components/EditorRow';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { WorldInput } from '@/components/editor/WorldField';
import { useCardCollapse } from '@/lib/cardCollapse';
import { dragStyle, droppedMove } from '@/lib/sortableDrag';
import { fieldFrame } from '@/lib/historyField';
import { bodyLabel, bodyUsedBy, entryCapacity } from '@/lib/bodies';
import { boxAt, boxLabel, MAX_CAPACITY, newBody, newEntry, rowSelection, withCapacity, type BoxRef } from '@/lib/bodyLayout';
import { useBodyLayoutSnap } from '@/lib/bodyLayoutPrefs';
import { copyWithFreshRolls, duplicateAfter } from '@/lib/duplicateAfter';
import { wholeCount } from '@/lib/items';
import { BodyLayoutEditor } from '@/managers/BodyLayoutEditor';
import { randomUUID } from '@/lib/uuid';
import type { Body, BodyEntry, Slot } from '@/types';

const sameName = (a: string, b: string) => a.trim() !== '' && a.trim().toLowerCase() === b.trim().toLowerCase();

// An entry list is its own drag boundary, so an entry never leaves its Body.
const ENTRY_LIST_MODIFIERS = [restrictToVerticalAxis, restrictToParentElement];

/** The world's Bodies in order, as expandable rows: a name, a layout and slot entries with a capacity. The first is the Default. */
const BodiesSection = () => {
  const { bodies, setBodies, removeBody, slots, entities, traits } = useGameData();
  const [pending, setPending] = useState<{ body: Body; text: string } | null>(null);
  const collapse = useCardCollapse(bodies.map((b) => b.id));
  const [snap, setSnap] = useBodyLayoutSnap();

  const write = (next: Body) => setBodies(bodies.map((b) => (b.id === next.id ? next : b)));
  const add = () => setBodies([...bodies, newBody(randomUUID(), 'New Body')]);
  const duplicate = (body: Body) => setBodies(duplicateAfter(bodies, body.id, copyWithFreshRolls).list);
  const askRemove = (body: Body) => {
    const text = bodyUsedBy(entities, traits, body.id);
    if (text) setPending({ body, text });
    else removeBody(body.id);
  };
  const onDragEnd = (event: DragEndEvent) => {
    const move = droppedMove(bodies, event);
    if (move) setBodies(arrayMove(bodies, ...move));
  };

  return (
    <div className="space-y-2" {...fieldFrame('bodies')}>
      <div className="flex items-center justify-between gap-2">
        <Label id="world-bodies-label">Bodies</Label>
        {bodies.length > 1 && <CollapseAllButton anyOpen={collapse.anyOpen} noun="Bodies" onClick={collapse.toggleAll} />}
      </div>
      <Hint>Sets which slots an entity has, and how many of each</Hint>
      {bodies[0] ? (
        <Hint>
          <b>{bodies[0].name || 'The first Body'}</b> is the Default, for entities set to Default and entities the AI adds
        </Hint>
      ) : (
        <Hint>Without a Body, an entity has no slots</Hint>
      )}
      {bodies.length > 0 && (
        <EditorDndContext onDragEnd={onDragEnd}>
          <StableSortableContext items={bodies} strategy={verticalListSortingStrategy}>
            <EditorRowList aria-labelledby="world-bodies-label">
              {bodies.map((body, index) => (
                <SortableBody
                  key={body.id}
                  body={body}
                  isDefault={index === 0}
                  slots={slots}
                  expanded={collapse.isOpen(body.id)}
                  onToggle={() => collapse.toggle(body.id)}
                  onDuplicate={() => duplicate(body)}
                  onRemove={() => askRemove(body)}
                >
                  <BodyFields
                    body={body}
                    duplicate={bodies.some((other) => other.id !== body.id && sameName(other.name, body.name))}
                    slots={slots}
                    onChange={write}
                    snap={snap}
                    onSnap={setSnap}
                  />
                </SortableBody>
              ))}
            </EditorRowList>
          </StableSortableContext>
        </EditorDndContext>
      )}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />Add Body
      </Button>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title={`Delete ${pending?.body.name || 'Body'}?`}
        description={pending?.text ?? ''}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (pending) removeBody(pending.body.id);
          setPending(null);
        }}
      />
    </div>
  );
};

/** A Body's row: its name, its Default mark and slot summary, and its fields below while expanded. */
function SortableBody({ body, isDefault, slots, expanded, onToggle, onDuplicate, onRemove, children }: {
  body: Body;
  isDefault: boolean;
  slots: readonly Slot[];
  expanded: boolean;
  onToggle: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, ...drag } = useSortable({ id: body.id });
  const label = bodyLabel(body);
  const summary = body.entries.flatMap((e) => {
    const name = slots.find((s) => s.id === e.slotId)?.name;
    if (!name) return [];
    const capacity = entryCapacity(e);
    return [capacity === 1 ? name : `${name} ×${capacity}`];
  }).join(', ');
  return (
    // The node wraps the row and its fields, so an expanded Body moves as one piece.
    <div ref={setNodeRef} style={dragStyle(drag)}>
      <EditorRow
        gripProps={{ ...attributes, ...listeners }}
        selected={false}
        onSelect={onToggle}
        selectionLabel={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
        lead="chevron"
        collapsed={!expanded}
        onToggleCollapse={onToggle}
        attached={expanded}
        label={label}
        // A narrow row keeps its room for the name.
        meta={<span className="block truncate max-sm:max-w-20">{[isDefault ? 'Default' : '', summary || 'No slots'].filter(Boolean).join(' · ')}</span>}
        actions={[
          { icon: <Copy className="h-4 w-4" />, title: `Duplicate ${label}`, onClick: onDuplicate },
          { icon: <X className="h-4 w-4" />, destructive: true, title: `Delete ${label}`, onClick: onRemove },
        ]}
      />
      {expanded && children}
    </div>
  );
}

/** The expanded fields of a Body: its name, its layout and its slot entries in order. Selecting a box selects its row, and the reverse. */
function BodyFields({ body, duplicate, slots, onChange, snap, onSnap }: {
  body: Body;
  duplicate: boolean;
  slots: readonly Slot[];
  onChange: (next: Body) => void;
  snap: boolean;
  onSnap: (on: boolean) => void;
}) {
  const label = bodyLabel(body);
  const nameId = `body-name-${body.id}`;
  const byId = new Map(slots.map((slot) => [slot.id, slot]));
  const [picked, setPicked] = useState<BoxRef | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const selected = picked && boxAt(body.entries, picked) ? picked : null;
  // removeSlot drops a slot's entries with it, so every entry names a live slot.
  const entries = body.entries.map((e) => ({ ...e, id: e.slotId }));
  const open = slots.filter((slot) => !body.entries.some((e) => e.slotId === slot.id));
  const slotName = (slotId: string) => byId.get(slotId)?.name || 'Unnamed Slot';
  const labelOf = ({ slotId, unit }: BoxRef) => {
    const entry = body.entries.find((e) => e.slotId === slotId);
    return boxLabel(slotName(slotId), entry ? entryCapacity(entry) : 1, unit);
  };
  const setEntries = (next: BodyEntry[]) => onChange({ ...body, entries: next });
  const setCapacity = (slotId: string, capacity: number) => setEntries(body.entries.map((e) => (
    e.slotId === slotId ? withCapacity(e, capacity, body.aspect) : e
  )));
  const onDragEnd = (event: DragEndEvent) => {
    const move = droppedMove(entries, event);
    if (move) setEntries(arrayMove(body.entries, ...move));
  };

  return (
    <div className="grid gap-3 rounded-b-md border border-t-0 border-border p-3">
      <div className="grid gap-1">
        <Label htmlFor={nameId}>Name</Label>
        <WorldInput id={nameId} value={body.name} onChange={(e) => onChange({ ...body, name: e.target.value })} />
        {duplicate && (
          <p role="status" className="flex items-start gap-1 text-helper text-warning">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Another Body has this name. Scripts that name it can&apos;t tell the two apart.
          </p>
        )}
      </div>
      <BodyLayoutEditor body={body} onChange={onChange} labelOf={labelOf} selected={selected} onSelect={setPicked} focusRequest={focusRequest} snap={snap} onSnap={onSnap}>
        <span className="text-label">Slots</span>
        {entries.length > 0 && (
          <EditorDndContext modifiers={ENTRY_LIST_MODIFIERS} onDragEnd={onDragEnd}>
            <StableSortableContext items={entries} strategy={verticalListSortingStrategy}>
              <EditorRowList className="min-w-0">
                {entries.map((entry) => (
                  <SortableEntry
                    key={entry.id}
                    entry={entry}
                    name={slotName(entry.slotId)}
                    bodyLabel={label}
                    selected={selected?.slotId === entry.slotId}
                    onSelect={() => {
                      setPicked(rowSelection(selected, entry.slotId, entryCapacity(entry)));
                      setFocusRequest((n) => n + 1);
                    }}
                    onCapacity={(capacity) => setCapacity(entry.slotId, capacity)}
                    onRemove={() => setEntries(body.entries.filter((e) => e.slotId !== entry.slotId))}
                  />
                ))}
              </EditorRowList>
            </StableSortableContext>
          </EditorDndContext>
        )}
        {slots.length === 0 ? (
          <Hint>Add a slot under <b>Slots</b> first</Hint>
        ) : open.length > 0 && (
          <Select value="" onValueChange={(slotId) => setEntries([...body.entries, newEntry(slotId, body.aspect)])}>
            <SelectTrigger className="h-8 w-auto justify-self-start gap-1 text-label" aria-label={`Add a slot to ${label}`}>
              <Plus className="h-4 w-4" aria-hidden />
              <SelectValue placeholder="Add Slot" />
            </SelectTrigger>
            <SelectContent>
              {open.map((slot) => <SelectItem key={slot.id} value={slot.id}>{slot.name || 'Unnamed Slot'}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </BodyLayoutEditor>
    </div>
  );
}

/** One slot entry: the slot, its capacity in this Body, and Remove. */
function SortableEntry({ entry, name, bodyLabel, selected, onSelect, onCapacity, onRemove }: {
  entry: BodyEntry & { id: string };
  name: string;
  bodyLabel: string;
  selected: boolean;
  onSelect: () => void;
  onCapacity: (capacity: number) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, ...drag } = useSortable({ id: entry.id });
  // The typed text applies when the edit ends, so backspacing through a value drops no boxes (Q79).
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const typed = draft === null ? undefined : wholeCount(draft);
    setDraft(null);
    if (typed !== undefined) onCapacity(Math.min(MAX_CAPACITY, Math.max(1, typed)));
  };
  return (
    <EditorRow
      setNodeRef={setNodeRef}
      style={dragStyle(drag)}
      gripProps={{ ...attributes, ...listeners }}
      selected={selected}
      onSelect={onSelect}
      selectionLabel={`Select ${name}`}
      label={name}
      meta={
        // Typing a capacity never counts as a click on the row.
        <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          Capacity
          <WorldInput
            aria-label={`${name} Capacity`}
            type="number"
            min={1}
            max={MAX_CAPACITY}
            className="h-6 w-14 px-1.5 text-helper text-foreground"
            value={draft ?? entryCapacity(entry)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
          />
        </span>
      }
      actions={[{ icon: <X className="h-4 w-4" />, destructive: true, title: `Remove ${name} from ${bodyLabel}`, onClick: onRemove }]}
    />
  );
}

export default BodiesSection;
