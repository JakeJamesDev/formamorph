import { useGameData } from '@/contexts/GameDataContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { WeatherSelect } from '@/components/editor/WeatherSelect';
import { fieldFrame } from '@/lib/historyField';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { activeWeather, allowedWeatherKinds, ALLOWED_KINDS, WEATHER_LABELS } from '@/lib/weather';
import type { WorldWeather } from '@/types';

const OFF: WorldWeather = { on: false, allowed: [] };

/** The world's Weather: the on switch, the kinds it allows, and the weather a game starts in. */
export const WorldWeatherFields = () => {
  const { worldOverview, updateWorldOverview } = useGameData();
  const stored = worldOverview.weather ?? OFF;
  const weather = activeWeather(worldOverview);
  // A hand-edited world can lack the list.
  const picked = weather?.allowed ?? [];
  const write = (patch: Partial<WorldWeather>) => updateWorldOverview({ weather: { ...stored, ...patch } });

  return (
    <div className="space-y-3" {...targetAttribute('worldEditor.overview', 'weather')}>
      <div className="space-y-1" {...fieldFrame('worldOverview', 'weather')}>
        <div className="flex items-center gap-2">
          <Checkbox
            id="world-weather-on"
            checked={stored.on}
            onCheckedChange={(checked) => write({ on: checked === true })}
          />
          <Label htmlFor="world-weather-on">Weather</Label>
        </div>
        <Hint>Lets the weather change as the story goes</Hint>
      </div>
      {weather && (
        <>
          <div className="space-y-2" {...fieldFrame('worldOverview', 'weatherAllowed')}>
            <Label id="world-weather-allowed-label">Allowed Weather</Label>
            <div className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-labelledby="world-weather-allowed-label">
              {ALLOWED_KINDS.map((kind) => (
                <div key={kind} className="flex items-center gap-2">
                  <Checkbox
                    id={`world-weather-${kind}`}
                    checked={picked.includes(kind)}
                    onCheckedChange={(checked) => write({
                      allowed: ALLOWED_KINDS.filter((k) => (k === kind ? checked === true : picked.includes(k))),
                    })}
                  />
                  <Label htmlFor={`world-weather-${kind}`}>{WEATHER_LABELS[kind]}</Label>
                </div>
              ))}
            </div>
            <Hint>Clear is always allowed</Hint>
          </div>
          <div className="space-y-1" {...fieldFrame('worldOverview', 'defaultWeather')}>
            <div className="flex items-center gap-2">
              <span className="text-label font-medium">Default Weather</span>
              <WeatherSelect
                value={weather.defaultWeather}
                kinds={allowedWeatherKinds(weather)}
                onChange={(defaultWeather) => write({ defaultWeather: defaultWeather ?? undefined })}
                unsetLabel="Not Set"
                ariaLabel="Default Weather"
              />
            </div>
            <Hint>Sets the start weather for openings with no Weather</Hint>
          </div>
        </>
      )}
    </div>
  );
};
