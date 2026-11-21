import { CloudLightning, CloudOff, CloudRain, Snowflake, Sun, type LucideIcon } from 'lucide-react';
import type { WeatherKind } from '@/types';

/** One icon per weather kind, for the Openings Weather marker. */
export const WEATHER_ICON: Record<WeatherKind, LucideIcon> = {
  clear: CloudOff, rain: CloudRain, snow: Snowflake, storm: CloudLightning, brightSun: Sun,
};
