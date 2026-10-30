import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ItemRequirement } from '@/types';

const ANY = 'any';

const IDENTITIES: readonly { value: string; label: string }[] = [
  { value: ANY, label: 'Any' },
  { value: 'identified', label: 'Identified' },
  { value: 'unidentified', label: 'Unidentified' },
];

/** `requirement` with its State word set; a blank word clears the check. */
const withState = (requirement: ItemRequirement, text: string): ItemRequirement => {
  const { state: _state, ...rest } = requirement;
  const state = text.trim();
  return state ? { ...rest, state } : rest;
};

/** `requirement` with its identity set; `any` clears the check. */
const withIdentity = (requirement: ItemRequirement, value: string): ItemRequirement => {
  const { identity: _identity, ...rest } = requirement;
  return value === 'identified' || value === 'unidentified' ? { ...rest, identity: value } : rest;
};

/**
 * The controls an item Condition chip carries: the State word a copy must have and whether the copy must be
 * identified. `accepts` says whether a replacement would repeat another Condition in the row; such an
 * identity is disabled and such a word stays a draft until a blur puts the Condition's own word back.
 */
export function ItemConditionControls({ requirement, accepts, onChange }: {
  requirement: ItemRequirement;
  accepts: (next: ItemRequirement) => boolean;
  onChange: (next: ItemRequirement) => void;
}) {
  const [draft, setDraft] = useState(requirement.state ?? '');
  // A change from outside, such as an undo, replaces the draft.
  useEffect(() => setDraft((prev) => (prev.trim() === (requirement.state ?? '') ? prev : requirement.state ?? '')), [requirement.state]);
  return (
    <>
      <Input
        size="sm"
        aria-label="State"
        placeholder="Any State"
        className="h-6 w-24 shrink-0 px-2"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const next = withState(requirement, e.target.value);
          if (accepts(next)) onChange(next);
        }}
        onBlur={() => setDraft(requirement.state ?? '')}
      />
      <Select value={requirement.identity ?? ANY} onValueChange={(v) => onChange(withIdentity(requirement, v))}>
        <SelectTrigger size="sm" aria-label="Identity" className="h-6 w-auto shrink-0 gap-1 px-2 text-helper">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-0">
          {IDENTITIES.map((o) => (
            <SelectItem
              key={o.value}
              value={o.value}
              disabled={o.value !== (requirement.identity ?? ANY) && !accepts(withIdentity(requirement, o.value))}
              className="pl-7 pr-3 text-helper"
            >
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
