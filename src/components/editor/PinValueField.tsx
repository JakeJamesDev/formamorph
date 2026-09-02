import { useMemo } from 'react';
import { TokenAutocomplete } from '@/components/TokenAutocomplete';
import { placeholderVocabulary } from '@/lib/chipVocabulary';
import { describePlaceholders, lonePlaceholderToken, placeholderValueLine } from '@/lib/placeholders';
import { withPinnedValue } from '@/lib/placeholderPins';
import type { Placeholder, PlaceholderPin } from '@/types';

/**
 * The value box every pin row edits with: free text with the pinned placeholder's authored values
 * suggested, since a source may pin a value the list doesn't carry (a "Redhead" trait naming a shade nobody
 * else rolls). The text goes through the writer that names the value by id when the list carries it, so
 * picking "Red" survives the author re-spelling it and a shade typed off the list stays free text.
 */
export function PinValueField({ pin, placeholders, onChange }: {
  pin: PlaceholderPin;
  /** Where the pinned placeholder and its values are read from: the world's combined view, or a library
   *  item's own list. */
  placeholders: readonly Placeholder[];
  onChange: (next: PlaceholderPin) => void;
}) {
  const pinVocab = useMemo(() => placeholderVocabulary([...placeholders]), [placeholders]);
  /** A value as the box shows it. A value that is exactly one chip is a part, so it reads as the part it
   *  names — the same reading the Values field gives it, and the one an author picking a variant is after.
   *  A chip inside longer text is prose, so it reads as what it will resolve to. What the pin stores is the
   *  value itself either way. */
  const describeValue = (value: string) => {
    const lone = lonePlaceholderToken(value);
    if (lone) return pinVocab.label(lone);
    return placeholderValueLine(describePlaceholders(value, [...placeholders])) || value;
  };
  return (
    // w-full to match the SelectTrigger beside it — equal flex bases split the row in half.
    <div className="w-full min-w-0">
      <TokenAutocomplete
        single
        openOnFocus
        values={pin.value ? [pin.value] : []}
        onChange={(vals) => onChange(withPinnedValue(pin, vals[0] ?? '', placeholders))}
        options={placeholders.find((p) => p.id === pin.placeholderId)?.values.map((v) => v.text) ?? []}
        describe={describeValue}
        ariaLabel="Pinned Value"
        placeholder="Pinned value"
      />
    </div>
  );
}

export default PinValueField;
