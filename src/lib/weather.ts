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

/** Every kind, Clear first. */
export const ALL_WEATHER_KINDS: readonly WeatherKind[] = ['clear', ...ALLOWED_KINDS];

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

const WEATHER_SENTENCES: Record<WeatherKind, string> = {
  clear: 'The sky is clear.',
  rain: 'It is raining.',
  snow: 'It is snowing.',
  storm: 'A storm is raging.',
  brightSun: 'The sun is bright overhead.',
};

/** The narrator's weather line: the World Weather, and a Sheltered note while there is weather to shelter from. */
export const weatherLine = (weather: WeatherKind, sheltered: boolean): string =>
  (sheltered && weather !== 'clear' ? `${WEATHER_SENTENCES[weather]} You are under shelter from it.` : WEATHER_SENTENCES[weather]);

/** The kinds the Weather Pass may answer with: the allowed kinds, without Bright Sun outside daylight. */
export const offeredWeatherKinds = (weather: WorldWeather | null | undefined, daylight: boolean): WeatherKind[] =>
  allowedWeatherKinds(weather).filter((kind) => daylight || kind !== 'brightSun');

/** The nightfall rule: Bright Sun turns into Clear when the turn ends outside daylight. */
export const afterNightfall = (weather: WeatherKind, endsInDaylight: boolean): WeatherKind =>
  (weather === 'brightSun' && !endsInDaylight ? 'clear' : weather);

/** A change in what the player experiences. `foreground` says whether it may play the full-screen effect. */
export interface WeatherChange {
  from: WeatherKind | null;
  to: WeatherKind | null;
  foreground: boolean;
}

/** The Weather Change between two experienced weathers, or null when nothing changed. A change into Clear or
 *  Shelter, on the opening turn, or by the nightfall rule never fires foreground. */
export function weatherChangeOf({ before, after, isOpeningTurn, nightfall = false }: {
  before: WeatherKind | null;
  after: WeatherKind | null;
  isOpeningTurn: boolean;
  nightfall?: boolean;
}): WeatherChange | null {
  if (before === after) return null;
  return { from: before, to: after, foreground: after !== null && after !== 'clear' && !isOpeningTurn && !nightfall };
}

/** The Weather Change a landed turn reports: from what the player felt where the turn's last reported move left
 *  them, to the turn's World Weather where it ends. */
export function landedWeatherChange({ before, after, from, to, isOpeningTurn, nightfall }: {
  before: WeatherKind;
  after: WeatherKind;
  from: Pick<GameLocation, 'sheltered'> | null | undefined;
  to: Pick<GameLocation, 'sheltered'> | null | undefined;
  isOpeningTurn: boolean;
  nightfall: boolean;
}): WeatherChange | null {
  return weatherChangeOf({ before: experiencedWeather(before, from), after: experiencedWeather(after, to), isOpeningTurn, nightfall });
}

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
