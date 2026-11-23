import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Hint } from '@/components/ui/typography';
import { WeatherSelect } from '@/components/editor/WeatherSelect';
import { fieldFrame } from '@/lib/historyField';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { ALL_WEATHER_KINDS, allowedWeatherKinds, isWeatherKind, weatherChanges, weatherKindSet, WEATHER_LABELS } from '@/lib/weather';
import type { WorldWeather } from '@/types';

const KIND_OPTIONS = ALL_WEATHER_KINDS.map((kind) => ({ value: kind, label: WEATHER_LABELS[kind] }));
const CLEAR_ONLY: WorldWeather = { allowed: ['clear'] };

/** The world's Weather: the kinds it allows, and the weather a game starts in while it can change. */
export const WorldWeatherFields = () => {
  const { worldOverview, updateWorldOverview } = useGameData();
  const stored = worldOverview.weather ?? CLEAR_ONLY;
  // A hand-edited world can lack the list.
  const picked = useMemo(() => weatherKindSet(stored.allowed ?? []), [stored.allowed]);
  const write = (patch: Partial<WorldWeather>) => updateWorldOverview({ weather: { ...stored, ...patch } });

  return (
    <div className="space-y-3" {...targetAttribute('worldEditor.overview', 'weather')}>
      <div className="space-y-1" {...fieldFrame('worldOverview', 'weatherAllowed')}>
        <Label id="world-weather-allowed-label">Weather</Label>
        <MultiSelect
          aria-labelledby="world-weather-allowed-label"
          options={KIND_OPTIONS}
          defaultValue={picked}
          onValueChange={(kinds) => write({ allowed: weatherKindSet(kinds.filter(isWeatherKind)) })}
          placeholder={WEATHER_LABELS.clear}
          clearLabel="Deselect All"
        />
        <Hint>Pick more than one to let the weather change as the story goes</Hint>
      </div>
      {weatherChanges(stored) && (
        <div className="space-y-1" {...fieldFrame('worldOverview', 'defaultWeather')}>
          <div className="flex items-center gap-2">
            <span className="text-label font-medium">Default Weather</span>
            <WeatherSelect
              value={stored.defaultWeather}
              kinds={allowedWeatherKinds(stored)}
              onChange={(defaultWeather) => write({ defaultWeather: defaultWeather ?? undefined })}
              unsetLabel="Not Set"
              ariaLabel="Default Weather"
            />
          </div>
          <Hint>Openings with no Weather use it. Leave it blank to let the AI pick.</Hint>
        </div>
      )}
    </div>
  );
};
