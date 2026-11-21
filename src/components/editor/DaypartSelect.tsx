import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DAYPARTS, isDaypart } from '@/lib/gameClock';
import { DAYPART_LABELS } from '@/lib/routineTime';
import type { Daypart } from '@/types';

const UNSET = 'unset';

/** A daypart picker with one extra choice for "none": `unsetLabel` names what an empty value means. */
export function DaypartSelect({ value, onChange, unsetLabel, ariaLabel }: {
  value: Daypart | undefined;
  onChange: (next: Daypart | null) => void;
  unsetLabel: string;
  ariaLabel: string;
}) {
  return (
    <Select value={value ?? UNSET} onValueChange={(v) => onChange(isDaypart(v) ? v : null)}>
      <SelectTrigger className="h-6 w-auto gap-1 px-2 text-helper" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSET}>{unsetLabel}</SelectItem>
        {DAYPARTS.map((part) => <SelectItem key={part} value={part}>{DAYPART_LABELS[part]}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
