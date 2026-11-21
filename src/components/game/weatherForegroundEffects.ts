import type { AllowedWeatherKind } from '@/types';

type Rand = () => number;

/** One foreground effect: draws the frame `t` seconds after it starts, on a canvas of CSS pixels. */
export interface ForegroundEffect {
  /** Seconds it plays; it draws nothing from then on. */
  duration: number;
  frame(ctx: CanvasRenderingContext2D, t: number): void;
}

/** How long each kind plays, in seconds. */
export const FOREGROUND_DURATION: Record<AllowedWeatherKind, number> = { rain: 3.5, snow: 4, storm: 1.6, brightSun: 3 };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (v: number) => v * v * (3 - 2 * v);
/** 0 → 1 over `fadeIn` seconds, holds, then 1 → 0 over the last `fadeOut` seconds of `duration`. */
const envelope = (t: number, duration: number, fadeIn: number, fadeOut: number) =>
  Math.min(clamp01(t / fadeIn), clamp01((duration - t) / fadeOut));

interface Drop { x: number; y: number; r: number; born: number; slide: number; speed: number }

/** Droplets land on the glass over the first second; the heavier ones run down before the glass clears. */
function rainOnGlass(w: number, h: number, rand: Rand): ForegroundEffect {
  const duration = FOREGROUND_DURATION.rain;
  const count = Math.round(Math.min(90, Math.max(30, (w * h) / 14000)));
  const drops: Drop[] = Array.from({ length: count }, () => {
    const r = 3 + rand() ** 2 * 11;
    return { x: rand() * w, y: rand() * h * 0.95, r, born: rand() * 1.2, slide: 0.6 + rand() * 1.2, speed: r > 9 ? 40 + rand() * 90 : 0 };
  });
  return {
    duration,
    frame(ctx, t) {
      const fade = clamp01((duration - t) / 0.9);
      for (const d of drops) {
        if (t < d.born) continue;
        const age = t - d.born;
        const grow = clamp01(age / 0.12);
        const run = Math.max(0, age - d.slide);
        const y = d.y + d.speed * run * run;
        const r = d.r * (0.6 + 0.4 * grow);
        const a = fade * grow;
        if (a <= 0) continue;
        if (run > 0) {
          // The trail a running drop leaves behind it.
          ctx.strokeStyle = `rgba(210, 225, 245, ${0.22 * a})`;
          ctx.lineWidth = r * 0.5;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x, y);
          ctx.stroke();
        }
        const body = ctx.createRadialGradient(d.x - r * 0.3, y - r * 0.35, r * 0.1, d.x, y, r);
        body.addColorStop(0, `rgba(255, 255, 255, ${0.5 * a})`);
        body.addColorStop(0.5, `rgba(205, 220, 240, ${0.18 * a})`);
        body.addColorStop(1, `rgba(70, 90, 120, ${0.38 * a})`);
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(d.x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}

interface Flake { x: number; restY: number; r: number; born: number; fall: number; phase: number }

/** Flakes drift down and settle along the bottom edge, then melt away. */
function settlingSnow(w: number, h: number, rand: Rand): ForegroundEffect {
  const duration = FOREGROUND_DURATION.snow;
  const count = Math.round(Math.min(160, Math.max(50, (w * h) / 9000)));
  const flakes: Flake[] = Array.from({ length: count }, () => ({
    x: rand() * w, restY: h - rand() ** 2 * h * 0.08, r: 1.5 + rand() * 3, born: rand() * 1.4, fall: 1.2 + rand() * 1, phase: rand() * Math.PI * 2,
  }));
  return {
    duration,
    frame(ctx, t) {
      const fade = clamp01((duration - t) / 1.2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * fade})`;
      ctx.strokeStyle = `rgba(90, 105, 130, ${0.35 * fade})`;
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      for (const f of flakes) {
        if (t < f.born) continue;
        const p = clamp01((t - f.born) / f.fall);
        const y = -f.r + (f.restY + f.r) * easeInOut(p);
        const x = f.x + Math.sin((t - f.born) * 2 + f.phase) * 14 * (1 - p);
        ctx.moveTo(x + f.r, y);
        ctx.arc(x, y, f.r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
    },
  };
}

/** When the one Storm flash starts and how long it fades: a single flash, far under three per second. */
export const STORM_FLASH = { at: 0.15, fade: 0.45 } as const;

/** The Storm flash strength at `t`, 0 to 1: one spike that fades out. */
export function stormFlash(t: number): number {
  const since = t - STORM_FLASH.at;
  if (since < 0 || since >= STORM_FLASH.fade) return 0;
  return (1 - since / STORM_FLASH.fade) ** 2;
}

/** One lightning flash: the screen lights up with a bolt, then the light fades. */
function lightningFlash(w: number, h: number, rand: Rand): ForegroundEffect {
  const bolt: [number, number][] = [];
  let x = w * (0.2 + rand() * 0.6);
  // The step has a floor, so a zero-height canvas still ends the loop.
  for (let y = 0; y <= h * 0.65; y += Math.max(8, h * (0.05 + rand() * 0.05))) {
    bolt.push([x, y]);
    x += (rand() - 0.5) * w * 0.08;
  }
  return {
    duration: FOREGROUND_DURATION.storm,
    frame(ctx, t) {
      const flash = stormFlash(t);
      if (flash <= 0) return;
      ctx.fillStyle = `rgba(235, 240, 255, ${0.55 * flash})`;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = `rgba(255, 255, 255, ${flash})`;
      ctx.shadowColor = 'rgba(180, 200, 255, 0.9)';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      bolt.forEach(([bx, by], i) => (i ? ctx.lineTo(bx, by) : ctx.moveTo(bx, by)));
      ctx.stroke();
      ctx.shadowBlur = 0;
    },
  };
}

/** A warm beam of light sweeps across the screen from left to right. */
function sunbeamSweep(w: number, h: number): ForegroundEffect {
  const duration = FOREGROUND_DURATION.brightSun;
  // The beam leans 20° from vertical and travels along its normal, measured from the top-left corner.
  const nx = Math.cos(0.35);
  const ny = Math.sin(0.35);
  const span = w * nx + h * ny;
  const band = Math.max(160, w * 0.22);
  return {
    duration,
    frame(ctx, t) {
      const a = envelope(t, duration, 0.4, 0.6);
      if (a <= 0) return;
      ctx.fillStyle = `rgba(255, 214, 140, ${0.1 * a})`;
      ctx.fillRect(0, 0, w, h);
      // The band's center runs from before the left edge to past the right edge.
      const center = -band + (span + band * 2) * easeInOut(clamp01(t / duration));
      const glow = ctx.createLinearGradient(nx * (center - band), ny * (center - band), nx * (center + band), ny * (center + band));
      glow.addColorStop(0, 'rgba(255, 225, 150, 0)');
      glow.addColorStop(0.5, `rgba(255, 235, 175, ${0.42 * a})`);
      glow.addColorStop(1, 'rgba(255, 225, 150, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    },
  };
}

/** The foreground effect for one kind on a `w` × `h` CSS-pixel canvas. */
export function createForegroundEffect(kind: AllowedWeatherKind, w: number, h: number, rand: Rand = Math.random): ForegroundEffect {
  if (kind === 'rain') return rainOnGlass(w, h, rand);
  if (kind === 'snow') return settlingSnow(w, h, rand);
  if (kind === 'storm') return lightningFlash(w, h, rand);
  return sunbeamSweep(w, h);
}
