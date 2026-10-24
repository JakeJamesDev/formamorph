import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DAYPARTS, daypartSet, isDaypart } from '@/lib/gameClock';
import type { Daypart, TimeRequirement } from '@/types';

const LABELS: Record<Daypart, string> = {
  night: 'Night', dawn: 'Dawn', morning: 'Morning', midday: 'Midday', afternoon: 'Afternoon', evening: 'Evening',
};

/**
 * The daypart multi-select a time Condition chip carries, in clock order. The last daypart on stays on, so the
 * Condition never empties. `accepts` says whether a replacement would repeat another Condition in the row.
 */
export function TimeConditionControls({ requirement, accepts, onChange }: {
  requirement: TimeRequirement;
  accepts: (next: TimeRequirement) => boolean;
  onChange: (next: TimeRequirement) => void;
}) {
  const on = daypartSet(requirement.dayparts);
  const toggled = (part: Daypart): TimeRequirement =>
    ({ kind: 'time', dayparts: daypartSet(on.includes(part) ? on.filter((d) => d !== part) : [...on, part]) });
  return (
    <ToggleGroup
      type="multiple"
      aria-label="Time of day"
      value={on}
      onValueChange={(v) => {
        const dayparts = daypartSet(v.filter(isDaypart));
        if (dayparts.length) onChange({ kind: 'time', dayparts });
      }}
      className="h-auto min-w-0 flex-wrap gap-y-0.5"
    >
      {DAYPARTS.map((part) => {
        const next = toggled(part);
        return (
          <ToggleGroupItem
            key={part}
            value={part}
            disabled={!next.dayparts.length || !accepts(next)}
            className="h-6 px-2 text-helper"
          >
            {LABELS[part]}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
