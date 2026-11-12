import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { CHIP_BASE } from '@/components/Chip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Hint } from '@/components/ui/typography';
import { useWorldHistoryStep } from '@/contexts/worldRecorder';
import { knownInOf, withKnownIn } from '@/lib/entityPresence';
import { KNOWN_IN_HELP, KNOWN_IN_LABEL, type KnownInChoice } from '@/lib/entityPresenceCopy';
import { fieldFrame } from '@/lib/historyField';
import { cn } from '@/lib/utils';
import { LocationPicker } from '@/managers/routine/RoutineFields';
import { usePlaceBook } from '@/managers/routine/RoutineTab';
import type { Entity } from '@/types';

const KNOWN_IN_CHOICES: KnownInChoice[] = ['nearby', 'nowhere', 'picked'];

const KEEP_ORIGIN = { keepOrigin: true };

/** Picked Locations as chips, with a picker to add one. */
function PickedList({ picks, onChange }: { picks: string[]; onChange: (next: string[]) => void }) {
  const book = usePlaceBook();
  return (
    <div className="flex flex-wrap items-center gap-1">
      {picks.map((id) => (
        <span key={id} className={cn(CHIP_BASE, 'bg-secondary text-secondary-foreground')}>
          {book.nameOf(id)}
          <button type="button" aria-label={`Remove ${book.nameOf(id)}`} onClick={() => onChange(picks.filter((x) => x !== id))}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <LocationPicker
        book={book} places={book.all.filter((id) => !picks.includes(id))} onPick={(id) => onChange([...picks, id])}
        trigger={<Button variant="ghost" size="sm" className="h-7 gap-1 px-1.5"><Plus className="h-4 w-4" aria-hidden />Add Location</Button>}
      />
    </div>
  );
}

/**
 * An entity's Known In. With `pickedPending` controlled, the owner holds Picked Locations chosen before its first
 * pick; without it the field holds that itself. `list` adds the picked chips and their picker.
 */
export function KnownInField({ entity, onChange, list, pickedPending: heldPending, onPickedPendingChange }: {
  entity: Entity;
  onChange: (next: Entity) => void;
  list?: boolean;
  pickedPending?: boolean;
  onPickedPendingChange?: (pending: boolean) => void;
}) {
  const step = useWorldHistoryStep(KEEP_ORIGIN);
  const [ownPending, setOwnPending] = useState(false);
  const pending = heldPending ?? ownPending;
  const setPending = onPickedPendingChange ?? setOwnPending;

  const knownIn = knownInOf(entity);
  const picks = Array.isArray(knownIn) ? knownIn : [];
  const choice: KnownInChoice = Array.isArray(knownIn) || pending ? 'picked' : knownIn;

  const choose = (next: KnownInChoice) => {
    setPending(next === 'picked');
    if (next !== 'picked') step('Change Known In', () => onChange(withKnownIn(entity, next)));
  };
  // Removing the last pick stores Nearby, so the choice stays on Picked until the author changes it.
  const writePicks = (next: string[]) => {
    setPending(next.length === 0);
    step('Change Known In', () => onChange(withKnownIn(entity, next)));
  };

  return (
    <div className={cn('space-y-1.5', list && 'border-t pt-3')} {...fieldFrame('entities', entity.id, 'knownIn')}>
      <Label>Known In</Label>
      <Select value={choice} onValueChange={(v) => choose(v as KnownInChoice)}>
        <SelectTrigger className={list ? 'h-9 w-56' : undefined} aria-label="Known In"><SelectValue /></SelectTrigger>
        <SelectContent>
          {KNOWN_IN_CHOICES.map((c) => <SelectItem key={c} value={c}>{KNOWN_IN_LABEL[c]}</SelectItem>)}
        </SelectContent>
      </Select>
      {list && choice === 'picked' && <PickedList picks={picks} onChange={writePicks} />}
      <Hint>{KNOWN_IN_HELP[choice]}</Hint>
    </div>
  );
}
