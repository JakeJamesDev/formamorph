import {
  CloudFog, CloudHail, CloudLightning, CloudOff, CloudRain, CloudSnow, Flame, Leaf, Moon, Snowflake, Sun, SunMedium, Tornado,
  type LucideIcon,
} from 'lucide-react';
import type { WeatherKind } from '@/types';

/** One icon per weather kind, for the Openings Weather marker. */
export const WEATHER_ICON: Record<WeatherKind, LucideIcon> = {
  clear: CloudOff, rain: CloudRain, snow: Snowflake, storm: CloudLightning, blizzard: CloudSnow, hail: CloudHail, fog: CloudFog,
  sandstorm: Tornado, ashfall: Flame, fallingLeaves: Leaf, brightSun: Sun,
};

/** The sky's icon at a time of day: Clear shows the sun by day and the moon by night. */
export const skyWeatherIcon = (weather: WeatherKind, daylight: boolean): LucideIcon =>
  (weather === 'clear' ? (daylight ? SunMedium : Moon) : WEATHER_ICON[weather]);
