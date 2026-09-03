import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PinConflictNote } from '@/components/editor/PinConflictNote';
import { PinValueField } from '@/components/editor/PinValueField';
import { PlaceholderSectionList } from '@/components/editor/PlaceholderSectionList';
import { placeholderVocabulary } from '@/lib/chipVocabulary';
import { decodePlaceholderToken } from '@/lib/placeholders';
import { withPinnedValue, type PinEditorWorld, type PinSourceRef } from '@/lib/placeholderPins';
import type { Placeholder, PlaceholderPin } from '@/types';

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
  const setPin = (index: number, next: PlaceholderPin) => onChange(pins.map((p, i) => (i === index ? next : p)));
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

  return (
    <div className="space-y-2">
      {pins.map((pin, index) => (
        <div key={index} className="space-y-1">
          <div className="flex space-x-2">
            {/* Re-aiming the pin drops the value id with it — the id named a value of the old placeholder. */}
            <PlaceholderSectionList
              rows={rows}
              selectedId={pin.placeholderId}
              onSelect={(id) => setPin(index, withPinnedValue({ ...pin, placeholderId: id }, pin.value, placeholders))}
              placeholders={placeholders}
              className="min-w-0 px-3"
            />
            <PinValueField pin={pin} placeholders={placeholders} onChange={(next) => setPin(index, next)} />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove Pin"
              onClick={() => onChange(pins.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {excludeId && pin.placeholderId === excludeId ? (
            <p className="text-meta text-destructive pl-1">A value cannot pin its own placeholder.</p>
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
