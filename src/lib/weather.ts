import type { AllowedWeatherKind, GameLocation, Opening, WeatherKind, WorldOverview, WorldWeather } from '@/types';
import { daypartAt, type WorldCalendar } from '@/lib/gameClock';

/** True after `elapsed` story hours in any daypart but night: when Bright Sun can show. */
export const isDaylight = (elapsed: number, calendar?: WorldCalendar): boolean => daypartAt(elapsed, calendar) !== 'night';

/** Every kind a world can allow besides Clear, in the order the editor lists them. */
export const ALLOWED_KINDS = ['rain', 'snow', 'storm', 'brightSun'] as const satisfies readonly AllowedWeatherKind[];

export const WEATHER_LABELS: Record<WeatherKind, string> = {
  clear: 'Clear', rain: 'Rain', snow: 'Snow', storm: 'Storm', brightSun: 'Bright Sun',
};

export const isWeatherKind = (value: unknown): value is WeatherKind =>
  value === 'clear' || (ALLOWED_KINDS as readonly unknown[]).includes(value);

/** The world's Weather block while it is on, else null. */
export const activeWeather = (overview: Pick<WorldOverview, 'weather'> | null | undefined): WorldWeather | null =>
  overview?.weather?.on ? overview.weather : null;

/** The kinds the world allows, Clear first: Clear is always allowed. */
export const allowedWeatherKinds = (weather: WorldWeather | null | undefined): WeatherKind[] =>
  ['clear', ...ALLOWED_KINDS.filter((kind) => weather?.allowed?.includes(kind))];

/** The kinds an Opening's Weather can pick, or undefined while the world's Weather is off (the picker hides). */
export const weatherKindsOf = (overview: Pick<WorldOverview, 'weather'> | null | undefined): WeatherKind[] | undefined => {
  const weather = activeWeather(overview);
  return weather ? allowedWeatherKinds(weather) : undefined;
};

/** What the player feels: the World Weather, or null in a Sheltered location. */
export const experiencedWeather = (
  worldWeather: WeatherKind | undefined,
  location: Pick<GameLocation, 'sheltered'> | null | undefined,
): WeatherKind | null => (location?.sheltered ? null : worldWeather ?? 'clear');

/** What a New Game or a redraw starts with, resolved from the drawn Opening and the world. `weather` is null when
 *  nothing is authored, so the page-one read can decide; it is also null while Weather is off. */
export interface ResolvedStart {
  startHour: number | null;
  weather: WeatherKind | null;
}

/** The save's weather field for a resolved weather: Clear and unset are both stored as absent. */
export const savedWeather = (weather: WeatherKind | null | undefined): AllowedWeatherKind | undefined =>
  weather && weather !== 'clear' ? weather : undefined;

/** The authored start weather: the Opening's, else the world's Default Weather, else null. A kind the world no
 *  longer allows reads as unset at its level (the Test Bench flags it); null while Weather is off. */
export function authoredStartWeather(opening: Opening | null | undefined, overview: WorldOverview | null | undefined): WeatherKind | null {
  const weather = activeWeather(overview);
  if (!weather) return null;
  const allowed = allowedWeatherKinds(weather);
  const fits = (kind: WeatherKind | undefined): kind is WeatherKind => !!kind && allowed.includes(kind);
  if (fits(opening?.weather)) return opening.weather;
  return fits(weather.defaultWeather) ? weather.defaultWeather : null;
}
