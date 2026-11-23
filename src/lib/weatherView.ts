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
  /** Location art shows behind the weather: Location Background on and an image on screen. */
  locationArt: boolean;
  /** The Weather Mask of the shown location image, a Mask entry's data. */
  mask: string | undefined;
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
  /** `kind` is null exactly when `mode` is `none`; `mask` limits where it draws. */
  background: { kind: AllowedWeatherKind | null; mode: WeatherBackgroundMode; mask?: string };
  /** The one-shot effect to play now, or null. */
  foreground: AllowedWeatherKind | null;
}

const NONE: WeatherView['background'] = { kind: null, mode: 'none' };

/** The kind the player sees now: none in a Clear-only world, in unmasked Shelter, on Clear, or for Bright Sun after dark. */
function shownKind({ weatherOn, worldWeather, sheltered, daylight }: WeatherViewInput, masked: boolean): AllowedWeatherKind | null {
  if (!weatherOn || (sheltered && !masked) || !worldWeather || worldWeather === 'clear') return null;
  if (worldWeather === 'brightSun' && !daylight) return null;
  return worldWeather;
}

/** What the weather overlays show for the current state. */
export function weatherView(input: WeatherViewInput): WeatherView {
  const mask = input.locationArt ? input.mask : undefined;
  const kind = shownKind(input, !!mask);
  const background = kind && input.background
    ? { kind, mode: input.reducedMotion ? 'calm' as const : 'full' as const, ...(mask ? { mask } : {}) }
    : NONE;
  const { change } = input;
  // The Weather Foreground ignores masks: Shelter still hides it.
  const fgKind = shownKind(input, false);
  const foreground = fgKind && change?.foreground && change.to === fgKind && input.foreground && !input.reducedMotion ? fgKind : null;
  return { background, foreground };
}
