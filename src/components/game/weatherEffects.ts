import type { AllowedWeatherKind } from '@/types';
import type { WeatherBackgroundMode } from '@/lib/weatherView';
import { drawGlow, drawWedge, glowSprite, wedgeSprite } from './weatherSprites';

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
/** The strength a shaft sprite is painted at; each frame scales it by the shaft's light. */
const SHAFT_STRENGTH = 0.2;
interface Mote { x: number; y: number; r: number; vx: number; vy: number; phase: number }

/** Warm light shafts from above the top-left corner that sway and breathe, with dust glinting where a shaft lights it. */
function sunEffect(calm: boolean, w: number, h: number, rand: Rand): WeatherEffect {
  const pace = calm ? 0.35 : 1;
  const shafts: Shaft[] = Array.from({ length: 6 }, (_, i) => ({
    angle: 0.3 + i * 0.15 + rand() * 0.06, width: 0.04 + rand() * 0.07, phase: rand() * Math.PI * 2, period: 5 + rand() * 4,
  }));
  const motes: Mote[] = Array.from({ length: Math.round(Math.min(160, Math.max(40, (w * h) / 8000)) * (calm ? 0.4 : 1)) }, () => ({
    x: rand() * w, y: rand() * h, r: 0.7 + rand() * 1.6, vx: 4 + rand() * 10, vy: -4 + rand() * 10, phase: rand() * Math.PI * 2,
  }));
  let time = 0;
  const reach = Math.hypot(w, h) * 1.2;
  const ox = -w * 0.08;
  const oy = -h * 0.12;
  const live = shafts.map(() => ({ angle: 0, half: 0, light: 0 }));
  const sunSprite = glowSprite('255, 215, 140');
  // Three nested wedges, widest faintest, so a shaft has a soft edge instead of a hard stripe.
  const shaftSprite = wedgeSprite('255, 220, 140', [[2.6, 0.3 * SHAFT_STRENGTH], [1.6, 0.45 * SHAFT_STRENGTH], [0.8, 0.6 * SHAFT_STRENGTH]], [[0, 1], [0.6, 0.4], [1, 0]]);
  return {
    frame(ctx, dt) {
      time += dt * pace;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = 0.22 + 0.06 * Math.sin(time * 0.9);
      if (sunSprite) drawGlow(ctx, sunSprite, ox, oy, Math.min(w, h) * 0.9, glow);
      shafts.forEach((s, i) => {
        const light = 0.5 + 0.5 * Math.sin((time / s.period) * Math.PI * 2 + s.phase);
        const angle = s.angle + Math.sin(time / (s.period * 1.3) + s.phase) * 0.05;
        const half = (s.width / 2) * (0.8 + 0.4 * light);
        live[i] = { angle, half, light };
        const strength = (0.04 + 0.16 * light) / SHAFT_STRENGTH;
        if (shaftSprite) drawWedge(ctx, shaftSprite, ox, oy, angle, reach, half, strength);
        else {
          ctx.fillStyle = `rgba(255, 220, 140, ${0.1 * strength})`;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + Math.cos(angle - half) * reach, oy + Math.sin(angle - half) * reach);
          ctx.lineTo(ox + Math.cos(angle + half) * reach, oy + Math.sin(angle + half) * reach);
          ctx.closePath();
          ctx.fill();
        }
      });
      for (const m of motes) {
        m.x += m.vx * dt * pace;
        m.y += (m.vy + Math.sin(time * 1.5 + m.phase) * 6) * dt * pace;
        if (m.x > w + 4) m.x = -4;
        if (m.y > h + 4) m.y = -4;
        if (m.y < -4) m.y = h + 4;
        // A mote shows only inside a shaft, brightest at its middle, and twinkles as it turns.
        const at = Math.atan2(m.y - oy, m.x - ox);
        let lit = 0;
        for (const s of live) lit = Math.max(lit, (1 - Math.abs(at - s.angle) / Math.max(s.half * 1.6, 1e-3)) * (0.4 + 0.6 * s.light));
        if (lit <= 0) continue;
        const a = lit * (0.5 + 0.5 * Math.sin(time * 4 + m.phase * 3));
        ctx.fillStyle = `rgba(255, 245, 215, ${0.85 * a})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
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
