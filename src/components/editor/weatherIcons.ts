import {
  CloudFog, CloudHail, CloudLightning, CloudOff, CloudRain, CloudSnow, Flame, Leaf, Snowflake, Sun, Tornado, type LucideIcon,
} from 'lucide-react';
import type { WeatherKind } from '@/types';

/** One icon per weather kind, for the Openings Weather marker. */
export const WEATHER_ICON: Record<WeatherKind, LucideIcon> = {
  clear: CloudOff, rain: CloudRain, snow: Snowflake, storm: CloudLightning, blizzard: CloudSnow, hail: CloudHail, fog: CloudFog,
  sandstorm: Tornado, ashfall: Flame, fallingLeaves: Leaf, brightSun: Sun,
};
