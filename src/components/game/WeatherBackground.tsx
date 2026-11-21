import { useEffect, useRef } from 'react';
import type { AllowedWeatherKind } from '@/types';
import { registerDevHook } from '@/lib/devRouter';
import type { WeatherBackgroundMode } from '@/lib/weatherView';
import { createWeatherEffect, type DrawMode, type WeatherColors, type WeatherEffect } from './weatherEffects';

/** Device pixels per CSS pixel, capped: fine streaks gain little past this and cost fill rate on phones. */
const MAX_DPR = 1.5;
/** Longest step one frame advances, so a stalled frame never teleports the particles. */
const MAX_DT = 0.05;

/** Frames drawn and flashes started since load, read by `__fmDev.weatherStats()` in DEV. */
const stats = { frames: 0, flashes: 0 };

/** Light streaks over location art; the theme's text color over the plain background, so both themes show it. */
function readColors(canvas: HTMLCanvasElement, plain: boolean): WeatherColors {
  if (!plain) return { rain: '210, 225, 255', snow: '255, 255, 255' };
  const rgb = getComputedStyle(canvas).color.match(/\d+(\.\d+)?/g)?.slice(0, 3).join(', ') ?? '128, 128, 128';
  return { rain: rgb, snow: rgb };
}

function WeatherCanvas({ kind, mode, plain }: { kind: AllowedWeatherKind; mode: DrawMode; plain: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let colors = readColors(canvas, plain);
    let width = -1;
    let height = -1;
    let effect: WeatherEffect | undefined;
    // Rebuilds the field only when the size changes: the observer's first call repeats the mount's.
    const fit = () => {
      if (canvas.clientWidth === width && canvas.clientHeight === height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      effect = createWeatherEffect(kind, mode, width, height, Math.random, import.meta.env.DEV ? () => { stats.flashes += 1; } : undefined);
    };
    fit();
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      const dt = last ? Math.min(MAX_DT, (now - last) / 1000) : 0;
      last = now;
      ctx.clearRect(0, 0, width, height);
      effect?.frame(ctx, dt, colors);
      if (import.meta.env.DEV) stats.frames += 1;
      raf = requestAnimationFrame(draw);
    };
    const start = () => { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(draw); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    const resize = new ResizeObserver(fit);
    resize.observe(canvas);
    // The theme switches by class and style on the root, which changes the plain-background color.
    const theme = new MutationObserver(() => { colors = readColors(canvas, plain); });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    start();
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      resize.disconnect();
      theme.disconnect();
    };
  }, [kind, mode, plain]);
  return (
    <canvas
      ref={ref}
      data-testid="weather-background"
      data-weather-kind={kind}
      data-weather-mode={mode}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-[9] h-full w-full text-foreground"
      style={{ transform: 'translateZ(0)', willChange: 'transform' }}
    />
  );
}

/**
 * The Weather Background: the current weather drawn over the location art and under the panels.
 * Mounts no canvas, and so draws nothing, while it shows no kind.
 */
export function WeatherBackground({ kind, mode, plain }: {
  kind: AllowedWeatherKind | null;
  mode: WeatherBackgroundMode;
  /** No location art behind it: draw in the theme's text color. */
  plain: boolean;
}) {
  useEffect(() => registerDevHook('weatherStats', () => ({ ...stats })), []);
  if (!kind || mode === 'none') return null;
  return <WeatherCanvas kind={kind} mode={mode} plain={plain} />;
}
