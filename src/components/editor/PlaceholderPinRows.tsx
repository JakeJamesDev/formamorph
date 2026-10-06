import { memo, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PinConflictNote } from '@/components/editor/PinConflictNote';
import { PinValueField } from '@/components/editor/PinValueField';
import { PlaceholderSectionList } from '@/components/editor/PlaceholderSectionList';
import { placeholderVocabulary, type ChipRow, type ChipVocabulary } from '@/lib/chipVocabulary';
import { decodePlaceholderToken } from '@/lib/placeholders';
import { pinTargetFilter, withPinnedValue, type PinEditorWorld, type PinSourceRef } from '@/lib/placeholderPins';
import { useStableCallback } from '@/lib/useStableCallback';
import type { Placeholder, PlaceholderPin } from '@/types';

/** One pin's picker, value box and remove button. Memoized, so an edit draws only the row it changed. */
const PinRow = memo(function PinRow({ pin, index, rows, placeholders, vocabulary, onSet, onRemove }: {
  pin: PlaceholderPin;
  index: number;
  rows: readonly ChipRow[];
  placeholders: readonly Placeholder[];
  vocabulary: ChipVocabulary;
  onSet: (index: number, next: PlaceholderPin) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex space-x-2">
      {/* Re-aiming the pin drops the value id with it — the id named a value of the old placeholder. */}
      <PlaceholderSectionList
        rows={rows}
        selectedId={pin.placeholderId}
        onSelect={(id) => onSet(index, withPinnedValue({ placeholderId: id, value: pin.value }, pin.value, placeholders))}
        placeholders={placeholders}
        className="min-w-0 px-3"
      />
      <PinValueField pin={pin} placeholders={placeholders} vocabulary={vocabulary} onChange={(next) => onSet(index, next)} />
      <Button variant="ghost" size="icon" aria-label="Remove Pin" onClick={() => onRemove(index)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
});

/**
 * The pin rows every pin source edits with: a placeholder picker, the value field, remove, and the
 * conflict note under each row. The rows are the whole editor; the section heading, its help button and
 * the popover a row sits in belong to the host.
 */
export function PlaceholderPinRows({ pins, onChange, source, world, placeholders, excludeId, onOpenTrait }: {
  pins: readonly PlaceholderPin[];
  onChange: (next: PlaceholderPin[]) => void;
  /** The source these pins live on: what the note leaves out of its rivals. */
  source: PinSourceRef;
  /** The world the note reads rivals from, and the picker reads owner names from. Null where there is no
   *  world behind the editor (a library modal). */
  world: PinEditorWorld | null;
  /** What the picker offers: the world's combined view, or a library item's own list. */
  placeholders: readonly Placeholder[];
  /** Left out of the picker, and refused with a note when a stored pin names it: a value cannot pin the
   *  placeholder it belongs to. */
  excludeId?: string;
  onOpenTrait?: (id: string) => void;
}) {
  // Stable for the memoized rows: an edit then draws the row it changed, not all of them.
  const setPin = useStableCallback((index: number, next: PlaceholderPin) => onChange(pins.map((p, i) => (i === index ? next : p))));
  const removePin = useStableCallback((index: number) => onChange(pins.filter((_, i) => i !== index)));
  // The same sectioned rows every other placeholder picker draws. `allRows`, not `palette`: a pin may name a
  // placeholder another one owns, and each of those keeps the holder chain that tells it from a root of the
  // same name. Every row reads its whole path, whichever surface the rows are drawn on.
  const owners = world?.placeholderOwners;
  const groups = world?.placeholderGroups;
  const letters = world?.placementLetters;
  const rows = useMemo(() => {
    const vocab = placeholderVocabulary(placeholders, { owners, groups, letters });
    const all = vocab.allRows?.() ?? vocab.palette();
    return excludeId ? all.filter((row) => decodePlaceholderToken(row.token)?.id !== excludeId) : all;
  }, [placeholders, excludeId, owners, groups, letters]);
  // One vocabulary for every value box; each box would otherwise build its own over the whole list.
  const pinVocab = useMemo(() => placeholderVocabulary(placeholders), [placeholders]);
  const rowIds = useMemo(() => rows.map((row) => decodePlaceholderToken(row.token)?.id ?? ''), [rows]);
  const byId = useMemo(() => new Map(placeholders.map((p) => [p.id, p])), [placeholders]);
  // One flag per row: may this source pick it. Every pin edit moves `world`, but rarely this key, so the
  // lists below keep their identity and the memoized rows see the same `rows`.
  const mayTarget = pinTargetFilter(world, source);
  const offeredKey = rows.map((_, i) => {
    const target = byId.get(rowIds[i]);
    return !target || mayTarget(target) ? '1' : '0';
  }).join('');
  // A stored pin keeps its own row, so a target the source may no longer pick still reads as picked. Pins
  // that need no extra row share one list, so each picker finds its pick in the same rows.
  const rowsFor = useMemo(() => {
    const isOffered = (i: number) => offeredKey[i] === '1';
    const baseRows = rows.filter((_, i) => isOffered(i));
    const baseIds = new Set(rowIds.filter((_, i) => isOffered(i)));
    // Lists for pins whose target is no longer offered, kept until `rows` or the offering changes.
    const kept = new Map<string, ChipRow[]>();
    return (id: string): readonly ChipRow[] => {
      if (baseIds.has(id)) return baseRows;
      let list = kept.get(id);
      if (!list) kept.set(id, (list = rows.filter((_, i) => isOffered(i) || rowIds[i] === id)));
      return list;
    };
  }, [rows, rowIds, offeredKey]);

  return (
    <div className="space-y-2">
      {pins.map((pin, index) => (
        <div key={index} className="space-y-1">
          <PinRow
            pin={pin}
            index={index}
            rows={rowsFor(pin.placeholderId)}
            placeholders={placeholders}
            vocabulary={pinVocab}
            onSet={setPin}
            onRemove={removePin}
          />
          {excludeId && pin.placeholderId === excludeId ? (
            <p className="text-meta text-destructive pl-1">A value can&apos;t pin its own placeholder</p>
          ) : (
            <PinConflictNote world={world} placeholderId={pin.placeholderId} source={source} onOpenTrait={onOpenTrait} />
          )}
        </div>
      ))}
      <Button size="sm" onClick={() => onChange([...pins, { placeholderId: '', value: '' }])}>Add Placeholder Pin</Button>
    </div>
  );
}

export default PlaceholderPinRows;
