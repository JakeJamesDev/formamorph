import type { AllowedWeatherKind, WeatherKind } from '@/types';
import type { WeatherChange } from '@/lib/weather';

/** How the background draws: the full effect, the slow reduced-motion one, or nothing. */
export type WeatherBackgroundMode = 'full' | 'calm' | 'none';

export interface WeatherViewInput {
  /** The world's Weather switch; off shows nothing. */
  weatherOn: boolean;
  /** The World Weather; absent reads as Clear. */
  worldWeather: WeatherKind | undefined;
  /** The current location's Sheltered flag. */
  sheltered: boolean;
  daylight: boolean;
  /** The player's Weather Background switch. */
  background: boolean;
  /** The player's Weather Foreground switch. */
  foreground: boolean;
  /** The OS reduced-motion setting. */
  reducedMotion: boolean;
  /** The Weather Change to play, or null on load, New Game, a redraw and paging. */
  change: Pick<WeatherChange, 'to' | 'foreground'> | null;
}

export interface WeatherView {
  /** `kind` is null exactly when `mode` is `none`. */
  background: { kind: AllowedWeatherKind | null; mode: WeatherBackgroundMode };
  /** The one-shot effect to play now, or null. */
  foreground: AllowedWeatherKind | null;
}

const NONE: WeatherView['background'] = { kind: null, mode: 'none' };

/** The kind the player sees now: none while Weather is off, in Shelter, on Clear, or for Bright Sun after dark. */
function shownKind({ weatherOn, worldWeather, sheltered, daylight }: WeatherViewInput): AllowedWeatherKind | null {
  if (!weatherOn || sheltered || !worldWeather || worldWeather === 'clear') return null;
  if (worldWeather === 'brightSun' && !daylight) return null;
  return worldWeather;
}

/** What the weather overlays show for the current state. */
export function weatherView(input: WeatherViewInput): WeatherView {
  const kind = shownKind(input);
  const background = kind && input.background ? { kind, mode: input.reducedMotion ? 'calm' as const : 'full' as const } : NONE;
  const { change } = input;
  const foreground = kind && change?.foreground && change.to === kind && input.foreground && !input.reducedMotion ? kind : null;
  return { background, foreground };
}
