import type { AllowedWeatherKind } from '@/types';
import type { WeatherBackgroundMode } from '@/lib/weatherView';
import { drawGlow, drawWedge, glowSprite, wedgeSprite, type Sprite } from './weatherSprites';

/** The background modes that draw. */
export type DrawMode = Exclude<WeatherBackgroundMode, 'none'>;

export interface WeatherColors {
  /** Rain streaks, as `r, g, b`. */
  rain: string;
  snow: string;
}

type Rand = () => number;

/** Particles per kind, as `[CSS pixels per particle, min, max]`; kinds without a particle field draw their own. */
const DENSITY: Partial<Record<AllowedWeatherKind, readonly [number, number, number]>> = {
  rain: [3500, 40, 320], snow: [6000, 30, 220], storm: [2500, 60, 420], blizzard: [2200, 80, 600], hail: [5000, 30, 260],
  sandstorm: [2000, 80, 700], ashfall: [7000, 25, 180], fallingLeaves: [30000, 10, 60],
};

/** Particles for a canvas of `width` × `height` CSS pixels: scales with area, so a small screen draws fewer. */
export function particleCount(kind: AllowedWeatherKind, mode: DrawMode, width: number, height: number): number {
  const area = Math.max(0, width) * Math.max(0, height);
  const density = DENSITY[kind];
  if (!density) return 0;
  const [perPx, min, max] = density;
  const full = Math.round(Math.min(max, Math.max(min, area / perPx)));
  return mode === 'calm' ? Math.round(full * 0.4) : full;
}

/** A gusting wind at `time` seconds, about 1 on average: two slow swells, never below 0.45. */
export function gust(time: number, phase = 0): number {
  return 1 + 0.35 * Math.sin(time * 0.7 + phase) + 0.2 * Math.sin(time * 1.9 + phase * 2.3);
}

/** `v` wrapped into `[-pad, size + pad)`. */
const wrap = (v: number, size: number, pad: number) => {
  const span = size + pad * 2;
  return ((((v + pad) % span) + span) % span) - pad;
};

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

/** Rain's lean, as sideways pixels per pixel of fall. */
const SLANT = 0.18;
/** Storm rain leans harder, and its wind gusts it by up to this much more. */
const STORM_SLANT = 0.34;
const STORM_GUST = 0.14;

function rainEffect(count: number, calm: boolean, w: number, h: number, rand: Rand, heavy: boolean): WeatherEffect {
  const speedScale = calm ? 0.3 : heavy ? 1.25 : 1;
  const lenScale = calm ? 0.6 : 1;
  const maxSlant = heavy ? STORM_SLANT + STORM_GUST * 0.55 : SLANT;
  const spawn = (y: number): Drop => ({
    x: rand() * (w + h * maxSlant) - h * maxSlant, y,
    len: (14 + rand() * 12) * lenScale, speed: (900 + rand() * 400) * speedScale,
  });
  const drops = Array.from({ length: count }, () => spawn(rand() * h));
  let time = 0;
  return {
    frame(ctx, dt, colors) {
      time += dt * (calm ? 0.4 : 1);
      // Storm rain rides a gusting wind; plain rain falls at one steady lean.
      const slant = heavy ? STORM_SLANT + STORM_GUST * (gust(time) - 1) : SLANT;
      ctx.strokeStyle = `rgba(${colors.rain}, ${calm ? 0.35 : 0.45})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of drops) {
        d.y += d.speed * dt;
        d.x += d.speed * slant * dt;
        if (d.y - d.len > h) Object.assign(d, spawn(-d.len));
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * slant, d.y - d.len);
      }
      ctx.stroke();
    },
  };
}

/** A falling six-armed snow crystal: `branch` places its side branches along each arm, `twig` sets their length. */
interface Crystal extends Flake { spin: number; angle: number; branch: number; twig: number }

/** Adds one crystal's arms and side branches to the current path. */
function crystalPath(ctx: CanvasRenderingContext2D, x: number, y: number, c: Crystal) {
  for (let arm = 0; arm < 6; arm++) {
    const a = c.angle + (arm * Math.PI) / 3;
    const ax = Math.cos(a);
    const ay = Math.sin(a);
    ctx.moveTo(x, y);
    ctx.lineTo(x + ax * c.r, y + ay * c.r);
    for (const [at, len] of [[c.branch, c.twig], [c.branch + 0.28, c.twig * 0.6]] as const) {
      const bx = x + ax * c.r * at;
      const by = y + ay * c.r * at;
      for (const side of [-1, 1]) {
        const b = a + side * 0.9;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(b) * c.r * len, by + Math.sin(b) * c.r * len);
      }
    }
  }
}

function snowEffect(count: number, calm: boolean, w: number, h: number, rand: Rand): WeatherEffect {
  const speedScale = calm ? 0.4 : 1;
  const spawn = (y: number): Flake => ({ x: rand() * w, y, r: 1 + rand() * 2.2, speed: (40 + rand() * 50) * speedScale, phase: rand() * Math.PI * 2 });
  const flakes = Array.from({ length: count }, () => spawn(rand() * h));
  // Now and then a larger crystal drifts down among the flakes, slower and turning.
  const spawnCrystal = (y: number): Crystal => ({
    x: rand() * w, y, r: 4.5 + rand() * 3, speed: (25 + rand() * 20) * speedScale, phase: rand() * Math.PI * 2,
    spin: (rand() - 0.5) * 0.8, angle: rand() * Math.PI, branch: 0.4 + rand() * 0.15, twig: 0.25 + rand() * 0.15,
  });
  const crystals = Array.from({ length: Math.max(2, Math.round(count * 0.03)) }, () => spawnCrystal(rand() * h));
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
      ctx.strokeStyle = `rgba(${colors.snow}, 0.9)`;
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const c of crystals) {
        c.y += c.speed * dt;
        c.angle += c.spin * dt * speedScale;
        if (c.y - c.r > h) Object.assign(c, spawnCrystal(-c.r));
        crystalPath(ctx, c.x + Math.sin(time * speedScale * 0.6 + c.phase) * 22, c.y, c);
      }
      ctx.stroke();
    },
  };
}

interface Gale { x: number; y: number; r: number; fall: number; drive: number }

/** Snow on a hard, gusting wind: fast flakes streak sideways through a white veil that thickens with each gust. */
function blizzardEffect(count: number, calm: boolean, w: number, h: number, rand: Rand): WeatherEffect {
  const pace = calm ? 0.35 : 1;
  const flakes: Gale[] = Array.from({ length: count }, () => ({
    x: rand() * w, y: rand() * h, r: 0.8 + rand() * 2, fall: 150 + rand() * 160, drive: 0.7 + rand() * 0.6,
  }));
  const wind = 420;
  let time = 0;
  return {
    frame(ctx, dt, colors) {
      time += dt * pace;
      const g = gust(time);
      ctx.fillStyle = `rgba(${colors.snow}, ${(calm ? 0.04 : 0.07) * g})`;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = `rgba(${colors.snow}, 0.8)`;
      ctx.lineCap = 'round';
      // Fine flakes, then coarse ones, so each pass strokes at one width.
      for (const coarse of [false, true]) {
        ctx.lineWidth = coarse ? 2.6 : 1.4;
        ctx.beginPath();
        for (const f of flakes) {
          if ((f.r > 1.8) !== coarse) continue;
          const vx = wind * g * f.drive * pace;
          const vy = f.fall * pace;
          f.x = wrap(f.x + vx * dt, w, 12);
          f.y = wrap(f.y + vy * dt, h, 12);
          // Each flake streaks back along its path, so speed reads as motion blur.
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(f.x - vx * 0.025, f.y - vy * 0.025);
        }
        ctx.stroke();
      }
    },
  };
}

interface Pellet { x: number; y: number; vx: number; vy: number; floor: number; bounced: boolean }

/** Hard white pellets that fall almost straight and bounce once where they land near the bottom. */
function hailEffect(count: number, calm: boolean, w: number, h: number, rand: Rand): WeatherEffect {
  const pace = calm ? 0.3 : 1;
  const spawn = (y: number): Pellet => ({
    x: rand() * w, y, vx: 40 + rand() * 30, vy: 1000 + rand() * 450, floor: h * (0.82 + rand() * 0.18), bounced: false,
  });
  const pellets = Array.from({ length: count }, () => spawn(rand() * h * 0.8));
  return {
    frame(ctx, dt, colors) {
      const step = dt * pace;
      ctx.strokeStyle = `rgba(${colors.snow}, 0.85)`;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (const p of pellets) {
        if (p.bounced) p.vy += 2600 * step;
        p.x += p.vx * step;
        p.y += p.vy * step;
        if (!p.bounced && p.y >= p.floor) {
          p.bounced = true;
          p.y = p.floor;
          p.vy = -(160 + rand() * 140);
          p.vx = (rand() - 0.5) * 160;
        } else if (p.bounced && p.vy > 0 && p.y >= p.floor) Object.assign(p, spawn(-10 - rand() * 40));
        // A falling pellet streaks; a bouncing one shows as a dot.
        const tail = p.bounced ? 0.6 : Math.min(12, p.vy * 0.008);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.008, p.y - tail);
      }
      ctx.stroke();
    },
  };
}

interface Bank { x: number; y: number; rx: number; ry: number; speed: number; alpha: number; phase: number }

/** Wide soft banks of fog that drift slowly across the scene and breathe, densest near the ground. */
function fogEffect(calm: boolean, w: number, h: number, rand: Rand): WeatherEffect {
  const pace = calm ? 0.35 : 1;
  const banks: Bank[] = Array.from({ length: 9 }, (_, i) => ({
    x: rand() * w, y: h * (0.25 + (i / 9) * 0.8 + rand() * 0.1), rx: w * (0.35 + rand() * 0.35), ry: h * (0.08 + rand() * 0.1),
    speed: (rand() < 0.5 ? -1 : 1) * (6 + rand() * 14), alpha: 0.14 + rand() * 0.12, phase: rand() * Math.PI * 2,
  }));
  let sprite: Sprite | null = null;
  let spriteColor = '';
  let time = 0;
  return {
    frame(ctx, dt, colors) {
      time += dt * pace;
      // The plain background draws in the theme's color, so the sprite follows a theme switch.
      if (spriteColor !== colors.snow) { sprite = glowSprite(colors.snow); spriteColor = colors.snow; }
      const ground = ctx.createLinearGradient(0, h * 0.35, 0, h);
      ground.addColorStop(0, `rgba(${colors.snow}, 0)`);
      ground.addColorStop(1, `rgba(${colors.snow}, 0.22)`);
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, w, h);
      for (const b of banks) {
        b.x = wrap(b.x + b.speed * dt * pace, w, b.rx);
        const a = b.alpha * (0.75 + 0.25 * Math.sin(time * 0.3 + b.phase));
        if (sprite) {
          ctx.globalAlpha = a;
          ctx.drawImage(sprite, b.x - b.rx, b.y - b.ry, b.rx * 2, b.ry * 2);
          ctx.globalAlpha = 1;
          continue;
        }
        ctx.fillStyle = `rgba(${colors.snow}, ${a * 0.5})`;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.rx, b.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}

const SAND = '214, 176, 118';

interface Grain { x: number; y: number; len: number; drive: number; phase: number }
interface Cloud { x: number; y: number; r: number; drive: number; alpha: number }

/** A sandstorm: a tan veil that thickens with each gust, rolling clouds of dust and fine grains racing sideways. */
function sandstormEffect(count: number, calm: boolean, w: number, h: number, rand: Rand): WeatherEffect {
  const pace = calm ? 0.3 : 1;
  const grains: Grain[] = Array.from({ length: count }, () => ({
    x: rand() * w, y: rand() * h, len: 4 + rand() * 12, drive: 0.6 + rand() * 0.8, phase: rand() * Math.PI * 2,
  }));
  const clouds: Cloud[] = Array.from({ length: 7 }, () => ({
    x: rand() * w, y: h * (0.2 + rand() * 0.9), r: Math.max(w, h) * (0.2 + rand() * 0.2), drive: 0.25 + rand() * 0.25, alpha: 0.12 + rand() * 0.1,
  }));
  const sprite = glowSprite(SAND);
  const wind = 520;
  let time = 0;
  return {
    frame(ctx, dt) {
      time += dt * pace;
      const g = gust(time, 1.3);
      ctx.fillStyle = `rgba(${SAND}, ${(calm ? 0.12 : 0.16) + 0.08 * (g - 1)})`;
      ctx.fillRect(0, 0, w, h);
      for (const c of clouds) {
        c.x = wrap(c.x + wind * g * c.drive * dt * pace, w, c.r);
        if (sprite) drawGlow(ctx, sprite, c.x, c.y, c.r, c.alpha * g);
        else {
          ctx.fillStyle = `rgba(${SAND}, ${c.alpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.strokeStyle = `rgba(${SAND}, 0.6)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const s of grains) {
        const vx = wind * g * s.drive * 1.6 * pace;
        s.x = wrap(s.x + vx * dt, w, s.len);
        s.y = wrap(s.y + Math.sin(time * 3 + s.phase) * 30 * dt * pace, h, 4);
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.len * g, s.y - s.len * 0.06);
      }
      ctx.stroke();
    },
  };
}

const ASH = '168, 162, 156';
const EMBER = '255, 140, 60';

interface Ash { x: number; y: number; r: number; fall: number; spin: number; angle: number; phase: number }
interface Ember { x: number; y: number; r: number; rise: number; phase: number }

/** Adds one ragged ash fleck to the current path: four corners, thin one way, so it reads as a flake turning. */
export function fleckPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  ctx.moveTo(x + c * r, y + s * r);
  ctx.lineTo(x - s * r * 0.45, y + c * r * 0.45);
  ctx.lineTo(x - c * r * 0.8, y - s * r * 0.8);
  ctx.lineTo(x + s * r * 0.35, y - c * r * 0.35);
  ctx.closePath();
}

/** Gray ash tumbling slowly down, with a few embers drifting up and flickering through it. */
function ashfallEffect(count: number, calm: boolean, w: number, h: number, rand: Rand): WeatherEffect {
  const pace = calm ? 0.35 : 1;
  const flakes: Ash[] = Array.from({ length: count }, () => ({
    x: rand() * w, y: rand() * h, r: 1 + rand() * 2.4, fall: 18 + rand() * 30, spin: (rand() - 0.5) * 3, angle: rand() * Math.PI, phase: rand() * Math.PI * 2,
  }));
  const embers: Ember[] = Array.from({ length: Math.max(3, Math.round(count * 0.06)) }, () => ({
    x: rand() * w, y: rand() * h, r: 1 + rand() * 1.5, rise: 12 + rand() * 25, phase: rand() * Math.PI * 2,
  }));
  const glow = glowSprite(EMBER, 0.15);
  let time = 0;
  return {
    frame(ctx, dt) {
      time += dt * pace;
      ctx.fillStyle = `rgba(${ASH}, 0.75)`;
      ctx.beginPath();
      for (const f of flakes) {
        f.y = wrap(f.y + f.fall * dt * pace, h, 6);
        f.angle += f.spin * dt * pace;
        fleckPath(ctx, f.x + Math.sin(time * 0.6 + f.phase) * 20, f.y, f.r, f.angle);
      }
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const e of embers) {
        e.y = wrap(e.y - e.rise * dt * pace, h, 10);
        const x = e.x + Math.sin(time * 0.9 + e.phase) * 26;
        const flicker = 0.55 + 0.45 * Math.sin(time * 7 + e.phase * 5) * Math.sin(time * 2.3 + e.phase);
        if (glow) drawGlow(ctx, glow, x, e.y, e.r * 5, 0.5 * flicker);
        ctx.fillStyle = `rgba(255, 200, 120, ${0.9 * flicker})`;
        ctx.beginPath();
        ctx.arc(x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  };
}

/** Autumn leaf colors as `r, g, b`. */
export const LEAF_COLORS = ['196, 92, 38', '222, 148, 40', '168, 58, 32', '190, 160, 60', '140, 104, 52'] as const;

/** Draws one leaf at the origin of the current transform, pointing along x: a pointed oval with a darker midrib. */
export function drawLeaf(ctx: CanvasRenderingContext2D, size: number, color: string, a: number) {
  ctx.beginPath();
  ctx.moveTo(-size, 0);
  ctx.quadraticCurveTo(0, -size * 0.6, size, 0);
  ctx.quadraticCurveTo(0, size * 0.6, -size, 0);
  ctx.closePath();
  ctx.fillStyle = `rgba(${color}, ${0.9 * a})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(70, 40, 20, ${0.45 * a})`;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-size * 0.9, 0);
  ctx.lineTo(size * 0.9, 0);
  ctx.stroke();
}

interface Leaf { x: number; y: number; size: number; fall: number; sway: number; freq: number; spin: number; angle: number; phase: number; color: string }

/** Leaves tumbling down on a light breeze: each sways, turns and flips as it falls. */
function leavesEffect(count: number, calm: boolean, w: number, h: number, rand: Rand): WeatherEffect {
  const pace = calm ? 0.35 : 1;
  const spawn = (y: number): Leaf => ({
    x: rand() * w, y, size: 4 + rand() * 5, fall: 35 + rand() * 35, sway: 25 + rand() * 40, freq: 0.6 + rand() * 0.8,
    spin: (rand() - 0.5) * 2.5, angle: rand() * Math.PI * 2, phase: rand() * Math.PI * 2, color: LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)],
  });
  const leaves = Array.from({ length: count }, () => spawn(rand() * h));
  let time = 0;
  return {
    frame(ctx, dt) {
      time += dt * pace;
      const breeze = 25 * gust(time * 0.6, 0.4);
      for (const l of leaves) {
        l.y += l.fall * dt * pace;
        l.x = wrap(l.x + breeze * dt * pace, w, 20);
        l.angle += l.spin * dt * pace;
        if (l.y - l.size > h) Object.assign(l, spawn(-l.size * 2));
        ctx.save();
        ctx.translate(l.x + Math.sin(time * l.freq + l.phase) * l.sway, l.y);
        ctx.rotate(l.angle);
        // The flip squeezes the leaf across its width as it turns over.
        ctx.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(time * l.freq * 1.7 + l.phase)));
        drawLeaf(ctx, l.size, l.color, 1);
        ctx.restore();
      }
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
  switch (kind) {
    case 'snow': return snowEffect(count, calm, w, h, rand);
    case 'blizzard': return blizzardEffect(count, calm, w, h, rand);
    case 'hail': return hailEffect(count, calm, w, h, rand);
    case 'fog': return fogEffect(calm, w, h, rand);
    case 'sandstorm': return sandstormEffect(count, calm, w, h, rand);
    case 'ashfall': return ashfallEffect(count, calm, w, h, rand);
    case 'fallingLeaves': return leavesEffect(count, calm, w, h, rand);
    case 'brightSun': return sunEffect(calm, w, h, rand);
    case 'rain':
    case 'storm': {
      const rain = rainEffect(count, calm, w, h, rand, kind === 'storm');
      if (kind === 'rain' || calm) return rain;
      const flash = flashEffect(w, h, rand, onFlash);
      return { frame(ctx, dt, colors) { rain.frame(ctx, dt, colors); flash.frame(ctx, dt, colors); } };
    }
  }
}
