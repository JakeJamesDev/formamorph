import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Image, ImageOff, Moon, Sun } from 'lucide-react';
import type { WeatherKind } from '@/types';
import { ALL_WEATHER_KINDS, WEATHER_LABELS } from '@/lib/weather';

/** Every kind, Clear first: the bar cycles through all of them whatever the world allows. */
const KINDS = ALL_WEATHER_KINDS;

/** Outdoor location art from the bundled worlds, dark to bright, as `[world, location]`. */
const BACKDROP_SOURCES = [['veilwood', 'The Veilwood'], ['emberwatch', 'Ashford Square'], ['sugarscape', 'Strawberrycream Shores']] as const;

export interface DevBackdrop { name: string; data: string }

interface ArtWorld { locations?: { name: string; images?: { data?: string }[] }[] }

// Behind DEV so a production build emits no whole-world chunks (images inlined, past Pages' 25 MiB file cap).
const WORLDS: Record<string, () => Promise<{ default: unknown }>> = import.meta.env.DEV ? {
  veilwood: () => import('@/defaultworlds/veilwood.json'),
  emberwatch: () => import('@/defaultworlds/emberwatch.json'),
  sugarscape: () => import('@/defaultworlds/sugarscape.json'),
} : {};

/** DEV: the backdrop art the bar cycles through, loaded on first use. */
export async function loadDevBackdrops(): Promise<DevBackdrop[]> {
  if (!import.meta.env.DEV) return [];
  const found = await Promise.all(BACKDROP_SOURCES.map(async ([world, name]): Promise<DevBackdrop | null> => {
    const art = (await WORLDS[world]()).default as ArtWorld;
    const data = art.locations?.find((l) => l.name === name)?.images?.[0]?.data;
    return data ? { name, data } : null;
  }));
  return found.filter((b): b is DevBackdrop => !!b);
}

/** DEV: a floating bar that steps the World Weather through every kind, flips day and night, and swaps in backdrop art. */
export function DevWeatherBar({ kind, onKind, day, onToggleDay, backdrop, onNextBackdrop }: {
  kind: WeatherKind;
  onKind: (kind: WeatherKind) => void;
  day: boolean;
  onToggleDay: () => void;
  /** The shown backdrop art's name, or null for the location's own. */
  backdrop: string | null;
  onNextBackdrop: () => void;
}) {
  const at = Math.max(0, KINDS.indexOf(kind));
  const step = (by: number) => onKind(KINDS[(at + by + KINDS.length) % KINDS.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const button = 'rounded-full p-1 hover:bg-background/20';
  return (
    <div
      data-testid="dev-weather-bar"
      className="pointer-events-auto fixed bottom-32 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full border bg-foreground px-2 py-1 text-background shadow-lg"
    >
      <button type="button" aria-label="Previous weather" className={button} onClick={() => step(-1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <span className="min-w-24 text-center text-helper font-medium">{WEATHER_LABELS[kind]}</span>
      <button type="button" aria-label="Next weather" className={button} onClick={() => step(1)}>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" aria-label={day ? 'Skip to night' : 'Skip to day'} className={`ml-1 ${button}`} onClick={onToggleDay}>
        {day ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
      </button>
      <button
        type="button"
        aria-label={backdrop ? `Backdrop, ${backdrop}` : 'Backdrop, location art'}
        className={button}
        onClick={onNextBackdrop}
      >
        {backdrop ? <Image className="h-4 w-4" aria-hidden /> : <ImageOff className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
