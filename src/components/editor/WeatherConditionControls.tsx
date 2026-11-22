import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { WEATHER_LABELS, isWeatherKind, weatherKindSet } from '@/lib/weather';
import { notFlag } from '@/lib/requirementRows';
import type { WeatherKind, WeatherRequirement } from '@/types';

/**
 * The kind multi-select a weather Condition chip carries, over the kinds the world allows. Every kind can be off;
 * an empty Condition reads as unresolved. `accepts` says whether a replacement would repeat another Condition in the row.
 */
export function WeatherConditionControls({ requirement, kinds, accepts, onChange }: {
  requirement: WeatherRequirement;
  kinds: readonly WeatherKind[];
  accepts: (next: WeatherRequirement) => boolean;
  onChange: (next: WeatherRequirement) => void;
}) {
  const on = weatherKindSet(requirement.kinds);
  const toggled = (kind: WeatherKind): WeatherRequirement =>
    ({ kind: 'weather', kinds: weatherKindSet(on.includes(kind) ? on.filter((k) => k !== kind) : [...on, kind]), ...notFlag(requirement.not) });
  return (
    <ToggleGroup
      type="multiple"
      aria-label="Weather"
      value={on}
      onValueChange={(v) => {
        onChange({ kind: 'weather', kinds: weatherKindSet(v.filter(isWeatherKind)), ...notFlag(requirement.not) });
      }}
      className="h-auto min-w-0 flex-wrap gap-y-0.5"
    >
      {kinds.map((kind) => {
        const next = toggled(kind);
        return (
          <ToggleGroupItem key={kind} value={kind} disabled={!accepts(next)} className="h-6 px-2 text-helper">
            {WEATHER_LABELS[kind]}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
