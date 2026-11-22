import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
import type { WeatherKind } from '@/types';
import { WEATHER_LABELS } from '@/lib/weather';

/** Every kind, Clear first: the bar cycles through all of them whatever the world allows. */
const KINDS: readonly WeatherKind[] = ['clear', 'rain', 'snow', 'storm', 'brightSun'];

/** DEV: a floating bar that steps the World Weather through every kind and flips day and night. */
export function DevWeatherBar({ kind, onKind, day, onToggleDay }: {
  kind: WeatherKind;
  onKind: (kind: WeatherKind) => void;
  day: boolean;
  onToggleDay: () => void;
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

  return (
    <div
      data-testid="dev-weather-bar"
      className="pointer-events-auto fixed bottom-32 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full border bg-foreground px-2 py-1 text-background shadow-lg"
    >
      <button type="button" aria-label="Previous weather" className="rounded-full p-1 hover:bg-background/20" onClick={() => step(-1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <span className="min-w-24 text-center text-helper font-medium">{WEATHER_LABELS[kind]}</span>
      <button type="button" aria-label="Next weather" className="rounded-full p-1 hover:bg-background/20" onClick={() => step(1)}>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={day ? 'Skip to night' : 'Skip to day'}
        className="ml-1 rounded-full p-1 hover:bg-background/20"
        onClick={onToggleDay}
      >
        {day ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
