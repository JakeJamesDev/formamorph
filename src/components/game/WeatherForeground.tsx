import { useEffect, useRef, useState } from 'react';
import type { AllowedWeatherKind } from '@/types';
import { registerDevHook } from '@/lib/devRouter';
import { createForegroundEffect } from './weatherForegroundEffects';

const MAX_DPR = 1.5;

/** Plays and frames drawn since load, read by `__fmDev.weatherForegroundStats()` in DEV. */
const stats = { plays: 0, frames: 0, ended: 0 };

function ForegroundCanvas({ kind, onDone }: { kind: AllowedWeatherKind; onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const effect = createForegroundEffect(kind, width, height);
    if (import.meta.env.DEV) stats.plays += 1;
    let start = -1;
    let raf = 0;
    const draw = (now: number) => {
      if (start < 0) start = now;
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, width, height);
      if (t >= effect.duration) {
        raf = 0;
        if (import.meta.env.DEV) stats.ended += 1;
        done.current();
        return;
      }
      effect.frame(ctx, t);
      if (import.meta.env.DEV) stats.frames += 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [kind]);
  return (
    <canvas
      ref={ref}
      data-testid="weather-foreground"
      data-weather-kind={kind}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-40 h-full w-full"
    />
  );
}

/**
 * The Weather Foreground: a short full-screen effect over the game view, under any open dialog.
 * Each new `play` number starts `kind` afresh, replacing one still playing; a null kind stops it. A `play`
 * whose kind was null when it arrived never plays later.
 */
export function WeatherForeground({ kind, play }: { kind: AllowedWeatherKind | null; play: number }) {
  const [seen, setSeen] = useState(0);
  const [playing, setPlaying] = useState<{ play: number; kind: AllowedWeatherKind } | null>(null);
  if (play !== seen) {
    setSeen(play);
    setPlaying(kind && play ? { play, kind } : null);
  } else if (!kind && playing) {
    setPlaying(null);
  }
  useEffect(() => registerDevHook('weatherForegroundStats', () => ({ ...stats })), []);
  if (!playing) return null;
  return <ForegroundCanvas key={playing.play} kind={playing.kind} onDone={() => setPlaying(null)} />;
}
