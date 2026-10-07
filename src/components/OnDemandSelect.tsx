import { useState, type ReactNode } from 'react';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SelectOptions, type SelectOption } from '@/components/SelectOptions';

/**
 * A Select over a long list that mounts its items only while the list is open or the trigger has focus.
 * Radix mounts every item of a closed Select, so a page of closed pickers pays for every list. Closed and
 * unfocused, it mounts only what the trigger shows: the picked item, or nothing when `display` stands in for
 * it. Focus mounts the rest before typeahead needs them.
 */
export function OnDemandSelect({ value, onValueChange, options, display, placeholder, disabled, 'aria-label': ariaLabel }: {
  value: string;
  onValueChange: (value: string) => void;
  /** Read while the list is live, and for the picked item's text when there is no `display`. */
  options: () => readonly SelectOption[];
  /** Shown in the trigger in place of the picked item's text. */
  display?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  'aria-label': string;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const live = open || focused;
  const items = live ? options() : display === undefined ? options().filter((o) => o.value === value) : [];
  return (
    <Select value={value} onValueChange={onValueChange} onOpenChange={setOpen} disabled={disabled}>
      <SelectTrigger aria-label={ariaLabel} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
        <SelectValue placeholder={placeholder}>{display}</SelectValue>
      </SelectTrigger>
      {(live || items.length > 0) && (
        <SelectContent>
          <SelectOptions options={items} />
        </SelectContent>
      )}
    </Select>
  );
}
