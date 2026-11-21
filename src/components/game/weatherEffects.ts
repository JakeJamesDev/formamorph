import type { AllowedWeatherKind } from '@/types';
import type { WeatherBackgroundMode } from '@/lib/weatherView';

/** The background modes that draw. */
export type DrawMode = Exclude<WeatherBackgroundMode, 'none'>;

export interface WeatherColors {
  /** Rain streaks, as `r, g, b`. */
  rain: string;
  snow: string;
}

type Rand = () => number;

/** Particles for a canvas of `width` × `height` CSS pixels: scales with area, so a small screen draws fewer. */
export function particleCount(kind: AllowedWeatherKind, mode: DrawMode, width: number, height: number): number {
  const area = Math.max(0, width) * Math.max(0, height);
  const [perPx, min, max] = kind === 'snow' ? [6000, 30, 220] : kind === 'storm' ? [2500, 60, 420] : kind === 'rain' ? [3500, 40, 320] : [0, 0, 0];
  if (!perPx) return 0;
  const full = Math.round(Math.min(max, Math.max(min, area / perPx)));
  return mode === 'calm' ? Math.round(full * 0.4) : full;
}

/** Storm flash starts never come closer than this, so any one second holds at most two: under the three-per-second limit. */
const FLASH_MIN_GAP_S = 0.55;
/** How long one flash takes to fade. */
const FLASH_FADE_S = 0.3;

/** Seconds from one flash start to the next: mostly a quiet spell of 3–9 s, now and then a quick follow-up. */
export function nextFlashDelay(rand: Rand): number {
  return rand() < 0.3 ? FLASH_MIN_GAP_S + rand() * 0.3 : 3 + rand() * 6;
}

/** One running effect: advances by `dt` seconds and draws one frame on `ctx`, in CSS pixels. */
export interface WeatherEffect {
  frame(ctx: CanvasRenderingContext2D, dt: number, colors: WeatherColors): void;
}

interface Drop { x: number; y: number; len: number; speed: number }
interface Flake { x: number; y: number; r: number; speed: number; phase: number }

const SLANT = 0.18;

function rainEffect(count: number, calm: boolean, w: number, h: number, rand: Rand, heavy: boolean): WeatherEffect {
  const speedScale = calm ? 0.3 : heavy ? 1.25 : 1;
  const lenScale = calm ? 0.6 : 1;
  const spawn = (y: number): Drop => ({
    x: rand() * (w + h * SLANT) - h * SLANT, y,
    len: (14 + rand() * 12) * lenScale, speed: (900 + rand() * 400) * speedScale,
  });
  const drops = Array.from({ length: count }, () => spawn(rand() * h));
  return {
    frame(ctx, dt, colors) {
      ctx.strokeStyle = `rgba(${colors.rain}, ${calm ? 0.35 : 0.45})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of drops) {
        d.y += d.speed * dt;
        d.x += d.speed * SLANT * dt;
        if (d.y - d.len > h) Object.assign(d, spawn(-d.len));
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * SLANT, d.y - d.len);
      }
      ctx.stroke();
    },
  };
}

function snowEffect(count: number, calm: boolean, w: number, h: number, rand: Rand): WeatherEffect {
  const speedScale = calm ? 0.4 : 1;
  const spawn = (y: number): Flake => ({ x: rand() * w, y, r: 1 + rand() * 2.2, speed: (40 + rand() * 50) * speedScale, phase: rand() * Math.PI * 2 });
  const flakes = Array.from({ length: count }, () => spawn(rand() * h));
  let time = 0;
  return {
    frame(ctx, dt, colors) {
      time += dt;
      ctx.fillStyle = `rgba(${colors.snow}, 0.8)`;
      ctx.beginPath();
      for (const f of flakes) {
        f.y += f.speed * dt;
        if (f.y - f.r > h) Object.assign(f, spawn(-f.r));
        const x = f.x + Math.sin(time * speedScale * 0.8 + f.phase) * 18;
        ctx.moveTo(x + f.r, f.y);
        ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
      }
      ctx.fill();
    },
  };
}

/** Distant lightning: a soft glow from the top edge, fading after each start. */
function flashEffect(w: number, h: number, rand: Rand, onFlash?: () => void): WeatherEffect {
  let untilNext = 1.5 + rand() * 3;
  let sinceFlash = Infinity;
  let strength = 1;
  return {
    frame(ctx, dt) {
      untilNext -= dt;
      sinceFlash += dt;
      if (untilNext <= 0) {
        sinceFlash = 0;
        strength = 0.6 + rand() * 0.4;
        onFlash?.();
        untilNext = nextFlashDelay(rand);
      }
      if (sinceFlash >= FLASH_FADE_S) return;
      const alpha = strength * 0.32 * (1 - sinceFlash / FLASH_FADE_S);
      const glow = ctx.createLinearGradient(0, 0, 0, h);
      glow.addColorStop(0, `rgba(235, 240, 255, ${alpha})`);
      glow.addColorStop(1, 'rgba(235, 240, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    },
  };
}

interface Shaft { angle: number; width: number; phase: number; period: number }

/** Warm light shafts from above the top-left corner, each slowly brightening and fading. */
function sunEffect(calm: boolean, w: number, h: number, rand: Rand): WeatherEffect {
  const shafts: Shaft[] = Array.from({ length: 5 }, (_, i) => ({
    angle: 0.35 + i * 0.16 + rand() * 0.06, width: 0.05 + rand() * 0.05, phase: rand() * Math.PI * 2, period: (9 + rand() * 6) * (calm ? 3 : 1),
  }));
  let time = 0;
  const reach = Math.hypot(w, h) * 1.2;
  const ox = -w * 0.08;
  const oy = -h * 0.12;
  return {
    frame(ctx, dt) {
      time += dt;
      for (const s of shafts) {
        const pulse = 0.5 + 0.5 * Math.sin((time / s.period) * Math.PI * 2 + s.phase);
        const sway = Math.sin(time / (s.period * 1.7) + s.phase) * 0.015;
        const a0 = s.angle + sway - s.width / 2;
        const a1 = s.angle + sway + s.width / 2;
        const glow = ctx.createLinearGradient(ox, oy, ox + Math.cos(s.angle) * reach, oy + Math.sin(s.angle) * reach);
        glow.addColorStop(0, `rgba(255, 214, 120, ${0.08 + 0.14 * pulse})`);
        glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(a0) * reach, oy + Math.sin(a0) * reach);
        ctx.lineTo(ox + Math.cos(a1) * reach, oy + Math.sin(a1) * reach);
        ctx.closePath();
        ctx.fill();
      }
    },
  };
}

/** The effect for one kind on a `w` × `h` CSS-pixel canvas. Calm Storm is calm rain with no flashes. */
export function createWeatherEffect(
  kind: AllowedWeatherKind, mode: DrawMode, w: number, h: number, rand: Rand = Math.random, onFlash?: () => void,
): WeatherEffect {
  const calm = mode === 'calm';
  const count = particleCount(kind, mode, w, h);
  if (kind === 'snow') return snowEffect(count, calm, w, h, rand);
  if (kind === 'brightSun') return sunEffect(calm, w, h, rand);
  const rain = rainEffect(count, calm, w, h, rand, kind === 'storm');
  if (kind === 'rain' || calm) return rain;
  const flash = flashEffect(w, h, rand, onFlash);
  return { frame(ctx, dt, colors) { rain.frame(ctx, dt, colors); flash.frame(ctx, dt, colors); } };
}
