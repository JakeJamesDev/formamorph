import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TokenAutocomplete } from '@/components/TokenAutocomplete';
import { PinConflictNote } from '@/components/editor/PinConflictNote';
import { placeholderVocabulary } from '@/lib/chipVocabulary';
import { describePlaceholders, lonePlaceholderToken, placeholderValueLine } from '@/lib/placeholders';
import { withPinnedValue, type PinEditorWorld, type PinSourceRef } from '@/lib/placeholderPins';
import { placeholderDisplayName } from '@/lib/placementLetters';
import type { Placeholder, PlaceholderPin } from '@/types';

/**
 * The pin rows every pin source edits with: a placeholder picker, the value field, remove, and the
 * conflict note under each row. The rows are the whole editor; the section heading, its help button and
 * the popover a row sits in belong to the host.
 */
export function PlaceholderPinRows({ pins, onChange, source, world, placeholders, excludeId, onOpenTrait }: {
  pins: PlaceholderPin[];
  onChange: (next: PlaceholderPin[]) => void;
  /** The source these pins live on: what the note leaves out of its rivals. */
  source: PinSourceRef;
  /** The world the note reads rivals from, and the picker reads owner names from. Null where there is no
   *  world behind the editor (a library modal). */
  world: PinEditorWorld | null;
  /** What the picker offers: the world's combined view, or a library item's own list. */
  placeholders: Placeholder[];
  /** Left out of the picker, and refused with a note when a stored pin names it: a value cannot pin the
   *  placeholder it belongs to. */
  excludeId?: string;
  onOpenTrait?: (id: string) => void;
}) {
  // The pin's text goes through the writer that names the value by id when the list carries it, so picking
  // "Red" survives the author re-spelling it and typing a shade nobody rolls stays free text.
  const setPin = (index: number, next: PlaceholderPin) => onChange(pins.map((p, i) => (i === index ? next : p)));
  const pinVocab = useMemo(() => placeholderVocabulary(placeholders), [placeholders]);
  /** A value as the pin picker shows it. A value that is exactly one chip is a part, so it reads as the part
   *  it names — the same reading the Values field gives it, and the one an author picking a variant is
   *  after. A chip inside longer text is prose, so it reads as what it will resolve to. What the pin stores
   *  is the value itself either way. */
  const describeValue = (value: string) => {
    const lone = lonePlaceholderToken(value);
    if (lone) return pinVocab.label(lone);
    return placeholderValueLine(describePlaceholders(value, placeholders)) || value;
  };
  const displayName = (id: string) =>
    placeholderDisplayName(id, placeholders, world?.placementLetters, world?.placeholderOwners);
  const offered = excludeId ? placeholders.filter((p) => p.id !== excludeId) : placeholders;

  return (
    <div className="space-y-2">
      {pins.map((pin, index) => (
        <div key={index} className="space-y-1">
          <div className="flex space-x-2">
            {/* Re-aiming the pin drops the value id with it — the id named a value of the old placeholder. */}
            <Select
              value={pin.placeholderId}
              onValueChange={(v) => setPin(index, withPinnedValue({ ...pin, placeholderId: v }, pin.value, placeholders))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select placeholder" />
              </SelectTrigger>
              <SelectContent>
                {offered.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{displayName(p.id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Free text with the placeholder's authored values suggested — a source may pin a value the
                list doesn't carry (a "Redhead" trait naming a shade nobody else rolls). */}
            {/* w-full to match the SelectTrigger beside it — equal flex bases split the row in half. */}
            <div className="w-full min-w-0">
              <TokenAutocomplete
                single
                openOnFocus
                values={pin.value ? [pin.value] : []}
                onChange={(vals) => setPin(index, withPinnedValue(pin, vals[0] ?? '', placeholders))}
                options={placeholders.find((p) => p.id === pin.placeholderId)?.values.map((v) => v.text) ?? []}
                describe={describeValue}
                ariaLabel="Pinned value"
                placeholder="Pinned value"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove pin"
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
