import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isWeatherKind, WEATHER_LABELS } from '@/lib/weather';
import type { WeatherKind } from '@/types';

const UNSET = 'unset';

/** A weather picker over `kinds` with one extra choice for "none": `unsetLabel` names what an empty value means. */
export function WeatherSelect({ value, kinds, onChange, unsetLabel, ariaLabel }: {
  value: WeatherKind | undefined;
  kinds: readonly WeatherKind[];
  onChange: (next: WeatherKind | null) => void;
  unsetLabel: string;
  ariaLabel: string;
}) {
  return (
    <Select value={value ?? UNSET} onValueChange={(v) => onChange(isWeatherKind(v) ? v : null)}>
      <SelectTrigger className="h-6 w-auto gap-1 px-2 text-helper" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSET}>{unsetLabel}</SelectItem>
        {kinds.map((kind) => <SelectItem key={kind} value={kind}>{WEATHER_LABELS[kind]}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
