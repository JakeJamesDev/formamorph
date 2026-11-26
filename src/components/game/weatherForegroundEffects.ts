import type { AllowedWeatherKind } from '@/types';
import { drawGlow, drawSprite, drawWedge, glowSprite, makeSprite, puffSprite, wedgeSprite, type Sprite } from './weatherSprites';
import { drawLeaf, fleckPath, LEAF_COLORS } from './weatherEffects';

type Rand = () => number;

/** One foreground effect: draws the frame `t` seconds after it starts, on a canvas of CSS pixels. */
export interface ForegroundEffect {
  /** Seconds it plays; it draws nothing from then on. */
  duration: number;
  frame(ctx: CanvasRenderingContext2D, t: number): void;
}

/** How long each kind plays, in seconds. */
export const FOREGROUND_DURATION: Record<AllowedWeatherKind, number> = {
  rain: 3.5, snow: 4, storm: 1.6, blizzard: 3.2, hail: 2.8, fog: 2.5, sandstorm: 3.6, ashfall: 4.5, fallingLeaves: 3.5, brightSun: 3,
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (v: number) => v * v * (3 - 2 * v);
/** 0 → 1 over `fadeIn` seconds, holds, then 1 → 0 over the last `fadeOut` seconds of `duration`. */
const envelope = (t: number, duration: number, fadeIn: number, fadeOut: number) =>
  Math.min(clamp01(t / fadeIn), clamp01((duration - t) / fadeOut));

/** One water drop on glass: a soft shadow, a lens that is dark at the top and bright at the bottom, and a glint. */
function drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, stretch = 1.12) {
  const ry = r * stretch;
  ctx.fillStyle = `rgba(0, 0, 0, ${0.16 * a})`;
  ctx.beginPath();
  ctx.ellipse(x + r * 0.12, y + ry * 0.3, r * 1.02, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // A drop works as a lens and flips the scene, so its top shows the dark ground and its bottom the bright sky.
  const body = ctx.createLinearGradient(0, y - ry, 0, y + ry);
  body.addColorStop(0, `rgba(14, 20, 30, ${0.6 * a})`);
  body.addColorStop(0.45, `rgba(120, 135, 155, ${0.18 * a})`);
  body.addColorStop(1, `rgba(240, 246, 255, ${0.7 * a})`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * a})`;
  ctx.beginPath();
  ctx.ellipse(x - r * 0.36, y - ry * 0.42, r * 0.2, ry * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Radius in sprite pixels of the cached drop. */
const DROP_R = 24;
/** The cached drop, painted on first use; null where no offscreen canvas exists. */
let dropSprite: Sprite | null | undefined;

/** Draws a drop from the cached sprite, or paints it directly where there is none. */
function drop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, stretch = 1.12) {
  if (dropSprite === undefined) dropSprite = makeSprite(DROP_R * 2.7, DROP_R * 3.1, (c) => drawDrop(c, DROP_R * 1.3, DROP_R * 1.4, DROP_R, 1));
  if (!dropSprite) {
    drawDrop(ctx, x, y, r, a, stretch);
    return;
  }
  const tall = stretch / 1.12;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(dropSprite, x - r * 1.3, y - r * 1.4 * tall, r * 2.7, r * 3.1 * tall);
  ctx.globalAlpha = 1;
}

interface Speck { x: number; y: number; r: number; born: number }

/** The mist lands in this many waves, each `MIST_WAVE_S` seconds after the last. */
const MIST_WAVES = 3;
const MIST_WAVE_S = 0.55;
const mistWave = (born: number) => Math.min(MIST_WAVES - 1, Math.floor(born / MIST_WAVE_S));

/** Mist specks at strength `a`: a shadow under each speck, then the speck, as two batched paths. */
function paintMist(ctx: CanvasRenderingContext2D, specks: readonly Speck[], a: number) {
  for (const [dx, color] of [[0.6, `rgba(10, 18, 30, ${0.3 * a})`], [0, `rgba(235, 242, 255, ${0.55 * a})`]] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const s of specks) {
      ctx.moveTo(s.x + dx + s.r, s.y + dx);
      ctx.arc(s.x + dx, s.y + dx, s.r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}
interface Drop extends Speck { stretch: number }
interface Runner extends Speck { start: number; speed: number; wobble: number; phase: number; beads: { at: number; r: number }[] }

/** Fine mist and drops land on the glass; heavy drops then run down in a wavering line and leave beads behind. */
function rainOnGlass(w: number, h: number, rand: Rand): ForegroundEffect {
  const duration = FOREGROUND_DURATION.rain;
  const area = w * h;
  const mist: Speck[] = Array.from({ length: Math.round(Math.min(1200, Math.max(300, area / 1200))) }, () => ({
    x: rand() * w, y: rand() * h, r: 0.6 + rand() * 1.4, born: rand() * 1.6,
  }));
  const drops: Drop[] = Array.from({ length: Math.round(Math.min(110, Math.max(25, area / 10000))) }, () => ({
    x: rand() * w, y: rand() * h, r: 1.2 + rand() ** 3 * 5, born: rand() * 1.4, stretch: 1 + rand() * 0.25,
  }));
  const runners: Runner[] = Array.from({ length: Math.round(Math.min(9, Math.max(3, area / 120000))) }, () => {
    const r = 4.5 + rand() * 3.5;
    const beads: Runner['beads'] = [];
    // The beads a runner sheds, by distance down its path; the step has a floor, so the loop always ends.
    for (let at = 20 + rand() * 20; at < h; at += Math.max(12, 14 + rand() * 30)) beads.push({ at, r: r * (0.18 + rand() * 0.22) });
    return {
      x: rand() * w, y: rand() * h * 0.5, r, born: rand() * 0.8, start: 0.9 + rand() * 0.9,
      speed: 140 + rand() * 160, wobble: 3 + rand() * 6, phase: rand() * Math.PI * 2, beads,
    };
  });
  const mistWaves: (Sprite | null | undefined)[] = Array.from({ length: MIST_WAVES }, () => undefined);
  const merged = Array.from({ length: MIST_WAVES }, () => false);
  let settledMist: Sprite | null | undefined;
  return {
    duration,
    frame(ctx, t) {
      const fade = clamp01((duration - t) / 0.9);
      if (fade <= 0) return;
      // Mist and resting drops never move, so each wave of them is painted once and faded in as it lands.
      for (let i = 0; i < MIST_WAVES; i++) {
        const landed = clamp01((t - i * MIST_WAVE_S) / MIST_WAVE_S);
        if (landed <= 0 || merged[i]) continue;
        // Painted on the frame it first shows, so the waves' cost spreads over three frames.
        // The first wave also carries the wet glass: a cool veil that comes in with the first drops.
        const paintWave = (c: CanvasRenderingContext2D, a: number) => {
          if (i === 0) {
            c.fillStyle = `rgba(120, 140, 170, ${0.14 * a})`;
            c.fillRect(0, 0, w, h);
          }
          paintMist(c, mist.filter((s) => mistWave(s.born) === i), a);
          for (const d of drops) if (mistWave(d.born) === i) drawDrop(c, d.x, d.y, d.r, a, d.stretch);
        };
        if (mistWaves[i] === undefined) mistWaves[i] = makeSprite(w, h, (c) => paintWave(c, 1));
        const wave = mistWaves[i];
        if (!wave) {
          paintWave(ctx, landed * fade);
          continue;
        }
        // A wave that has fully landed joins the settled mist, so each frame copies at most two layers.
        settledMist ??= makeSprite(w, h, () => {});
        const into = landed >= 1 ? settledMist?.getContext('2d') : null;
        if (into) {
          into.drawImage(wave, 0, 0);
          merged[i] = true;
          mistWaves[i] = null;
          continue;
        }
        ctx.globalAlpha = landed * fade;
        ctx.drawImage(wave, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      if (settledMist && merged.some(Boolean)) {
        ctx.globalAlpha = fade;
        ctx.drawImage(settledMist, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      for (const run of runners) {
        if (t < run.born) continue;
        const grow = clamp01((t - run.born) / 0.15);
        // Stick-slip: the drop surges and stalls as it gathers water.
        const distAt = (time: number) => {
          const moving = Math.max(0, time - run.born - run.start);
          return run.speed * (moving + 0.12 * Math.sin(moving * 9 + run.phase)) * clamp01(moving * 4);
        };
        const dist = distAt(t);
        // The drop loses water to its track and beads, so it shrinks the farther it runs.
        const sizeAt = (d: number) => run.r * (1 - 0.65 * clamp01(d / (h * 0.6)));
        // It stretches into a teardrop while it surges and rounds out when it stalls.
        const pace = clamp01((dist - distAt(t - 0.05)) / 0.05 / run.speed);
        const xAt = (d: number) => run.x + Math.sin(d / 45 + run.phase) * run.wobble;
        for (const b of run.beads) if (b.at < dist - run.r) drop(ctx, xAt(b.at), run.y + b.at, b.r, fade, 1.05);
        if (dist > 2) {
          // The wet track: a wavering stroke as wide as the drop was there, fading toward the top.
          const steps = Math.min(14, Math.ceil(dist / 6));
          ctx.lineCap = 'round';
          for (let i = 0; i < steps; i++) {
            const d0 = (i / steps) * dist;
            const d1 = ((i + 1) / steps) * dist;
            const k = (i + 1) / steps;
            ctx.strokeStyle = `rgba(215, 228, 245, ${0.18 * k * fade})`;
            ctx.lineWidth = sizeAt(d1) * (0.3 + 0.4 * k);
            ctx.beginPath();
            ctx.moveTo(xAt(d0), run.y + d0);
            ctx.lineTo(xAt(d1), run.y + d1);
            ctx.stroke();
          }
        }
        drop(ctx, xAt(dist), run.y + dist, sizeAt(dist) * (0.5 + 0.5 * grow), fade * grow, 1.05 + 0.6 * pace);
      }
    },
  };
}

interface Flake { x: number; restY: number; r: number; born: number; fall: number; phase: number }

/** Width in CSS pixels of one column of the snow bank. */
const BANK_COL = 4;

/** Flakes drift down and build a rolling drift along the bottom edge, then it melts away. */
function settlingSnow(w: number, h: number, rand: Rand): ForegroundEffect {
  const duration = FOREGROUND_DURATION.snow;
  const count = Math.round(Math.min(320, Math.max(80, (w * h) / 4500)));
  const cols = Math.max(2, Math.ceil(w / BANK_COL) + 1);
  // The drift's shape: a few long, gentle swells, never thinner than a third of its depth.
  const [p1, p2, p3] = [rand(), rand(), rand()].map((v) => v * Math.PI * 2);
  // Snow banks into the bottom corners, as on a window's frame, and thins to a dusting across the middle.
  const profile = Float32Array.from({ length: cols }, (_, c) => {
    const x = (c * BANK_COL) / Math.max(1, w);
    const corner = Math.abs(2 * x - 1) ** 3;
    const u = x * Math.PI * 2;
    const swell = 1 + 0.25 * Math.sin(u * 3.1 + p1) + 0.15 * Math.sin(u * 7 + p2) + 0.08 * Math.sin(u * 13 + p3);
    return (0.06 + corner) * swell;
  });
  const depth = h * 0.07;
  const flakes = Array.from({ length: count }, () => ({
    x: rand() * w, r: 1.5 + rand() * 3, born: rand() * 1.8, fall: 1 + rand() * 0.9, phase: rand() * Math.PI * 2,
  })).sort((a, b) => a.born + a.fall - (b.born + b.fall));
  const colOf = (x: number) => Math.min(cols - 1, Math.max(0, Math.round(x / BANK_COL)));
  // Each flake comes to rest on the drift as deep as it stood when that flake landed.
  const landed: Flake[] = flakes.map((f, i) => ({ ...f, restY: h - depth * (i / count) * profile[colOf(f.x)] - f.r * 0.3 }));
  const lumps = Array.from({ length: Math.ceil(w / 9) + 1 }, (_, i) => ({ x: i * 9 + rand() * 4, r: 4 + rand() * 5, lift: rand() * 3 }));
  return {
    duration,
    frame(ctx, t) {
      const fade = clamp01((duration - t) / 1.2);
      if (fade <= 0) return;
      let settled = 0;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.92 * fade})`;
      ctx.strokeStyle = `rgba(90, 105, 130, ${0.35 * fade})`;
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      for (const f of landed) {
        if (t < f.born) continue;
        const p = clamp01((t - f.born) / f.fall);
        if (p >= 1) { settled += 1; continue; }
        const y = -f.r + (f.restY + f.r) * easeInOut(p);
        const x = f.x + Math.sin((t - f.born) * 2 + f.phase) * 14 * (1 - p);
        ctx.moveTo(x + f.r, y);
        ctx.arc(x, y, f.r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      // The drift deepens with every settled flake and sinks as it melts.
      const fill = depth * (settled / count) * fade;
      if (fill < 0.5) return;
      const top = (x: number) => h - fill * profile[colOf(x)];
      const body = ctx.createLinearGradient(0, h - fill * 1.6, 0, h);
      body.addColorStop(0, `rgba(255, 255, 255, ${0.97 * fade})`);
      body.addColorStop(1, `rgba(208, 222, 242, ${0.97 * fade})`);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let c = 0; c < cols; c++) ctx.lineTo(c * BANK_COL, h - fill * profile[c]);
      ctx.lineTo(w, h);
      ctx.closePath();
      // Soft lumps along the crest, so the edge reads as packed flakes rather than a line.
      for (const l of lumps) {
        // A lump is only as big as the snow under it, so the dusting in the middle stays flat.
        const r = Math.min(l.r, (h - top(l.x)) * 0.6);
        if (r < 0.5) continue;
        ctx.moveTo(l.x + r, top(l.x) + l.lift);
        ctx.arc(l.x, top(l.x) + l.lift, r, 0, Math.PI * 2);
      }
      ctx.fill();
      // A cool shade along the crest's underside.
      const shade = ctx.createLinearGradient(0, h - fill * 1.3, 0, h);
      shade.addColorStop(0, 'rgba(150, 170, 200, 0)');
      shade.addColorStop(1, `rgba(150, 170, 200, ${0.25 * fade})`);
      ctx.fillStyle = shade;
      ctx.fillRect(0, h - fill * 1.6, w, fill * 1.6);
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

/** A sun ray's layers, `[spread, gain]`: a bright core inside a wider, fainter wedge gives it a soft edge. */
const RAY_LAYERS = [[2.2, 0.35], [1, 0.65]] as const;

/** Glow sprites by color and core, painted on first use. */
const glows = new Map<string, Sprite | null>();

/** A soft disc of light, `color` as `r, g, b`, fading to nothing at its edge. */
function glowDisc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number, core = 0) {
  const key = `${color}|${core}`;
  if (!glows.has(key)) glows.set(key, glowSprite(color, core));
  const sprite = glows.get(key);
  if (sprite) {
    drawGlow(ctx, sprite, x, y, r, a);
    return;
  }
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${color}, ${a})`);
  g.addColorStop(Math.max(0.01, core), `rgba(${color}, ${a * 0.8})`);
  g.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** The sun breaks out at the top corner: a bloom, turning rays and lens ghosts that slide as it climbs, then it settles. */
function sunBurst(w: number, h: number, rand: Rand): ForegroundEffect {
  const duration = FOREGROUND_DURATION.brightSun;
  const reach = Math.hypot(w, h) * 1.1;
  const rays = Array.from({ length: 16 }, (_, i) => ({
    angle: (i / 16) * Math.PI * 2 + rand() * 0.2, width: 0.015 + rand() * 0.035, phase: rand() * Math.PI * 2, gain: 0.5 + rand() * 0.5,
  }));
  const ghosts = [
    { at: 0.45, r: 0.05, color: '255, 214, 150', a: 0.16 },
    { at: 0.7, r: 0.025, color: '170, 230, 255', a: 0.14 },
    { at: 0.95, r: 0.09, color: '255, 190, 230', a: 0.08 },
    { at: 1.25, r: 0.04, color: '200, 255, 210', a: 0.12 },
    { at: 1.5, r: 0.13, color: '255, 230, 170', a: 0.06 },
  ];
  const size = Math.min(w, h);
  const raySprite = wedgeSprite('255, 244, 210', RAY_LAYERS, [[0, 1], [1, 0]]);
  return {
    duration,
    frame(ctx, t) {
      // Rises fast, peaks near one second, then settles away.
      const I = envelope(t, duration, 0.55, 1.1) * (0.85 + 0.15 * Math.sin(t * 5));
      if (I <= 0) return;
      const climb = easeInOut(clamp01(t / duration));
      const sx = w * (0.9 - 0.12 * climb);
      const sy = h * (0.02 + 0.08 * climb);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // The whole scene warms and brightens, most near the sun.
      ctx.fillStyle = `rgba(255, 205, 140, ${0.1 * I})`;
      ctx.fillRect(0, 0, w, h);
      glowDisc(ctx, sx, sy, reach, '255, 190, 110', 0.32 * I);
      for (const ray of rays) {
        const ang = ray.angle + t * 0.12;
        const base = 0.3 * I * ray.gain * (0.6 + 0.4 * Math.sin(t * 3 + ray.phase));
        if (raySprite) {
          drawWedge(ctx, raySprite, sx, sy, ang, reach, ray.width, base);
          continue;
        }
        for (const [spread, gain] of RAY_LAYERS) {
          const g = ctx.createLinearGradient(sx, sy, sx + Math.cos(ang) * reach, sy + Math.sin(ang) * reach);
          g.addColorStop(0, `rgba(255, 244, 210, ${base * gain})`);
          g.addColorStop(1, 'rgba(255, 244, 210, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(ang - ray.width * spread) * reach, sy + Math.sin(ang - ray.width * spread) * reach);
          ctx.lineTo(sx + Math.cos(ang + ray.width * spread) * reach, sy + Math.sin(ang + ray.width * spread) * reach);
          ctx.closePath();
          ctx.fill();
        }
      }
      // A wide horizontal streak through the sun, as a camera lens draws it: a soft band under a sharp line.
      for (const [half, a] of [[14, 0.25], [2.5, 0.7]] as const) {
        const streak = ctx.createLinearGradient(sx - w * 0.7, sy, sx + w * 0.7, sy);
        streak.addColorStop(0, 'rgba(255, 236, 200, 0)');
        streak.addColorStop(0.5, `rgba(255, 236, 200, ${a * I})`);
        streak.addColorStop(1, 'rgba(255, 236, 200, 0)');
        ctx.fillStyle = streak;
        ctx.fillRect(sx - w * 0.7, sy - half, w * 1.4, half * 2);
      }
      glowDisc(ctx, sx, sy, size * 0.6, '255, 225, 160', 0.6 * I, 0.1);
      glowDisc(ctx, sx, sy, size * 0.1, '255, 252, 240', I, 0.45);
      // Ghosts sit on the line from the sun through the screen's center, so they slide as the sun climbs.
      const cx = w / 2 - sx;
      const cy = h / 2 - sy;
      for (const gh of ghosts) glowDisc(ctx, sx + cx * gh.at * 2, sy + cy * gh.at * 2, size * gh.r, gh.color, gh.a * 2 * I, 0.7);
      ctx.restore();
    },
  };
}

/** A gust of snow sweeps across the screen: streaking flakes, a white-out that peaks and clears, frost at the corners. */
function whiteout(w: number, h: number, rand: Rand): ForegroundEffect {
  const duration = FOREGROUND_DURATION.blizzard;
  const flakes = Array.from({ length: Math.round(Math.min(420, Math.max(120, (w * h) / 3500))) }, () => ({
    y: rand() * h, r: 1 + rand() * 3, born: rand() * 1.6, speed: (0.9 + rand() * 0.8) * w, lift: (rand() - 0.3) * h * 0.25,
  }));
  const size = Math.max(w, h);
  return {
    duration,
    frame(ctx, t) {
      const I = envelope(t, duration, 0.7, 1.4);
      if (I <= 0) return;
      ctx.fillStyle = `rgba(240, 246, 255, ${0.42 * I})`;
      ctx.fillRect(0, 0, w, h);
      // Frost gathers in each corner as the glass chills.
      for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]] as const) glowDisc(ctx, cx, cy, size * 0.35, '235, 244, 255', 0.55 * I, 0.25);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * I})`;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (const f of flakes) {
        const age = t - f.born;
        if (age < 0) continue;
        const x = -20 + age * f.speed;
        if (x > w + 40) continue;
        const y = f.y + (age * f.lift) / 1.5;
        const tail = 6 + f.r * 5;
        ctx.moveTo(x, y);
        ctx.lineTo(x - tail, y - (tail * f.lift) / f.speed / 1.5);
      }
      ctx.stroke();
    },
  };
}

/** Seconds a hailstone takes to fly in to the glass before it strikes. */
const HAIL_APPROACH = 0.12;

/** A barrage of hail hits the glass: stones fly in, strike with a flash and a spray of ice, and leave stars of cracks. */
function hailOnGlass(w: number, h: number, rand: Rand): ForegroundEffect {
  const duration = FOREGROUND_DURATION.hail;
  const hits = Array.from({ length: Math.round(Math.min(40, Math.max(12, (w * h) / 30000))) }, () => ({
    x: rand() * w, y: rand() * h, r: 5 + rand() * 6,
    // The square root bunches strikes late, so the barrage builds.
    at: HAIL_APPROACH + Math.sqrt(rand()) * 1.7,
    cracks: Array.from({ length: 4 + Math.floor(rand() * 4) }, () => {
      const angle = rand() * Math.PI * 2;
      const len = 14 + rand() * 30;
      return { angle, len, fork: rand() * 0.6 + 0.3, forkAngle: angle + (rand() < 0.5 ? -1 : 1) * (0.4 + rand() * 0.5), forkLen: len * (0.3 + rand() * 0.3) };
    }),
    chips: Array.from({ length: 5 + Math.floor(rand() * 4) }, () => ({ angle: rand() * Math.PI * 2, speed: 120 + rand() * 220, r: 1 + rand() * 1.8 })),
  }));
  return {
    duration,
    frame(ctx, t) {
      const fade = clamp01((duration - t) / 0.8);
      if (fade <= 0) return;
      ctx.lineCap = 'round';
      for (const hit of hits) {
        const age = t - hit.at;
        if (age < -HAIL_APPROACH) continue;
        if (age < 0) {
          // The stone flies in toward the glass: it grows and sharpens.
          const k = 1 + age / HAIL_APPROACH;
          stone(ctx, hit.x, hit.y, hit.r * (0.3 + 0.7 * k), fade * k);
          continue;
        }
        const grow = clamp01(age / 0.06);
        for (const [color, width] of [['20, 28, 40', 2.4], ['240, 247, 255', 1]] as const) {
          ctx.strokeStyle = `rgba(${color}, ${(color === '20, 28, 40' ? 0.3 : 0.85) * fade})`;
          ctx.lineWidth = width;
          ctx.beginPath();
          for (const c of hit.cracks) {
            const ex = hit.x + Math.cos(c.angle) * c.len * grow;
            const ey = hit.y + Math.sin(c.angle) * c.len * grow;
            ctx.moveTo(hit.x, hit.y);
            ctx.lineTo(ex, ey);
            const fx = hit.x + Math.cos(c.angle) * c.len * c.fork * grow;
            const fy = hit.y + Math.sin(c.angle) * c.len * c.fork * grow;
            ctx.moveTo(fx, fy);
            ctx.lineTo(fx + Math.cos(c.forkAngle) * c.forkLen * grow, fy + Math.sin(c.forkAngle) * c.forkLen * grow);
          }
          ctx.stroke();
        }
        // The strike: a white flash and a ring that spreads and fades.
        const flash = 1 - clamp01(age / 0.2);
        if (flash > 0) {
          glowDisc(ctx, hit.x, hit.y, hit.r * 5, '235, 244, 255', 0.8 * flash * fade, 0.1);
          ctx.strokeStyle = `rgba(240, 248, 255, ${0.7 * flash * fade})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(hit.x, hit.y, hit.r * (1 + age * 18), 0, Math.PI * 2);
          ctx.stroke();
        }
        // Ice chips spray out and fall away.
        const chipLife = 1 - clamp01(age / 0.45);
        if (chipLife > 0) {
          ctx.fillStyle = `rgba(235, 244, 255, ${0.9 * chipLife * fade})`;
          ctx.beginPath();
          for (const c of hit.chips) {
            const cx = hit.x + Math.cos(c.angle) * c.speed * age;
            const cy = hit.y + Math.sin(c.angle) * c.speed * age + 600 * age * age;
            ctx.moveTo(cx + c.r, cy);
            ctx.arc(cx, cy, c.r, 0, Math.PI * 2);
          }
          ctx.fill();
        }
        // The stone bounces off and drops away, leaving a frosted pip.
        const bounce = clamp01(age / 0.2);
        if (bounce < 1) stone(ctx, hit.x, hit.y + 260 * age * age, hit.r * (1 - 0.5 * bounce), fade * (1 - bounce));
        drop(ctx, hit.x, hit.y, hit.r * 0.45, 0.7 * fade, 1);
      }
    },
  };
}

/** One hailstone: an icy white ball, lit from the top left. */
function stone(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  if (a <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, `rgba(255, 255, 255, ${a})`);
  g.addColorStop(0.7, `rgba(214, 228, 242, ${0.95 * a})`);
  g.addColorStop(1, `rgba(150, 172, 196, ${0.85 * a})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Fog rolls in from both sides and mists the glass, holds a moment, then thins away. */
function fogRollIn(w: number, h: number, rand: Rand): ForegroundEffect {
  const duration = FOREGROUND_DURATION.fog;
  const banks = Array.from({ length: 8 }, (_, i) => ({
    from: i % 2 ? 1 : -1, y: h * (0.15 + rand() * 0.9), rx: w * (0.4 + rand() * 0.3), ry: h * (0.15 + rand() * 0.15), reach: 0.3 + rand() * 0.5,
  }));
  return {
    duration,
    frame(ctx, t) {
      const I = envelope(t, duration, 0.7, 0.9);
      if (I <= 0) return;
      ctx.fillStyle = `rgba(225, 230, 238, ${0.3 * I})`;
      ctx.fillRect(0, 0, w, h);
      const roll = easeInOut(clamp01(t / 1.1));
      for (const b of banks) {
        // Each bank starts past its edge and rolls in toward the middle.
        const edge = b.from < 0 ? -b.rx * 0.6 : w + b.rx * 0.6;
        const x = edge - b.from * roll * w * b.reach;
        ctx.save();
        ctx.translate(x, b.y);
        ctx.scale(1, b.ry / b.rx);
        glowDisc(ctx, 0, 0, b.rx, '235, 238, 244', 0.55 * I);
        ctx.restore();
      }
    },
  };
}

/** Grit layers, far to near, as `[share of grains, width, alpha, speed in screen widths per second, length]`. */
const GRIT_LAYERS = [[0.6, 0.8, 0.45, 1.3, 10], [0.3, 1.5, 0.6, 2, 22], [0.1, 3, 0.4, 3.2, 60]] as const;

/** A wall of dust rolls across the screen: a churning front, the light turning brown behind it, grit racing through, then it thins. */
function dustFront(w: number, h: number, rand: Rand): ForegroundEffect {
  const duration = FOREGROUND_DURATION.sandstorm;
  const sweep = 1.6;
  const puffs = [0, 1, 2].map(() => puffSprite(SAND_FG, rand));
  // Billows bulge out of the leading edge; more sit behind it to give the wall body.
  const billows = Array.from({ length: 36 }, (_, i) => ({
    lead: i < 16, y: ((i % 16) + rand()) / 16 * h * 1.1 - h * 0.05, back: i < 16 ? rand() * w * 0.04 : w * 0.1 + rand() * w * 1.4,
    size: h * (i < 16 ? 0.16 + rand() * 0.14 : 0.3 + rand() * 0.3), phase: rand() * Math.PI * 2, sprite: Math.floor(rand() * 3),
  }));
  // The leading edge churns: three waves at different scales and speeds.
  const edge = (y: number, t: number) => w * (0.045 * Math.sin((y / h) * 6 + t * 2) + 0.025 * Math.sin((y / h) * 15 - t * 3.1) + 0.012 * Math.sin((y / h) * 33 + t * 5));
  const total = Math.round(Math.min(420, Math.max(140, (w * h) / 3500)));
  const grains = GRIT_LAYERS.flatMap(([share, width, alpha, speed, len]) =>
    Array.from({ length: Math.round(total * share) }, () => ({ y: rand() * h, start: rand() * w * 2, width, alpha, speed: speed * w * (0.8 + rand() * 0.4), len: len * (0.6 + rand() * 0.8) })));
  return {
    duration,
    frame(ctx, t) {
      const I = envelope(t, duration, 0.3, 1.2);
      if (I <= 0) return;
      const front = -w * 0.3 + w * 1.8 * easeInOut(clamp01(t / sweep));
      // The dust body: thick behind the front, thinner at its wavy edge. The gradient holds its first stop, so one fill covers it.
      const body = ctx.createLinearGradient(front - w * 0.5, 0, front, 0);
      body.addColorStop(0, `rgba(150, 104, 56, ${0.62 * I})`);
      body.addColorStop(1, `rgba(${SAND_FG}, ${0.3 * I})`);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-1, -1);
      for (let y = 0; y <= h + 12; y += 12) ctx.lineTo(Math.max(-1, front + edge(y, t)), y);
      ctx.lineTo(-1, h + 12);
      ctx.closePath();
      ctx.fill();
      for (const b of billows) {
        // Each billow churns: it swells, rolls up and down and pulses.
        const y = b.y + Math.sin(t * 1.4 + b.phase * 1.3) * h * 0.03;
        const x = front + edge(y, t) - b.back + Math.sin(t * 2.2 + b.phase) * w * 0.015;
        if (x < -b.size * 1.5 || x - b.size > w + b.size) continue;
        const s = b.size * (1 + 0.12 * Math.sin(t * 1.8 + b.phase));
        const a = I * (b.lead ? 0.85 : 0.55);
        const sprite = puffs[b.sprite];
        if (sprite) drawSprite(ctx, sprite, x, y, s * 2, s * 1.4, a);
        else glowDisc(ctx, x, y, s, SAND_FG, a * 0.5);
      }
      ctx.lineCap = 'round';
      for (const [, width, alpha] of GRIT_LAYERS) {
        ctx.strokeStyle = `rgba(236, 200, 148, ${alpha * I})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (const g of grains) {
          if (g.width !== width) continue;
          // Grit only shows inside the dust, behind the front.
          const x = ((g.start + t * g.speed) % (w * 2)) - g.len;
          if (x > front || x > w + g.len) continue;
          ctx.moveTo(x, g.y);
          ctx.lineTo(x - g.len, g.y - g.len * 0.08);
        }
        ctx.stroke();
      }
    },
  };
}

const SAND_FG = '196, 152, 96';

/** Ash layers, far to near, as `[share of flecks, color, alpha, size, fall speed]`. */
const ASH_LAYERS = [[0.6, '176, 170, 164', 0.8, 3.5, 55], [0.35, '70, 64, 60', 0.9, 11, 130]] as const;

/** The sky darkens and glows red from below, ash thickens past the glass, and embers keep rising through it. */
function ashCloud(w: number, h: number, rand: Rand): ForegroundEffect {
  const duration = FOREGROUND_DURATION.ashfall;
  const total = Math.round(Math.min(450, Math.max(120, (w * h) / 2300)));
  // Flecks start spread over the screen and above it, so ash is in view from the first frame.
  const flecks = ASH_LAYERS.flatMap(([share, color, alpha, size, fall]) => Array.from({ length: Math.round(total * share) }, () => ({
    color, alpha, x: rand() * w * 1.2 - w * 0.2, y: rand() * h * 1.4 - h * 0.5, r: size * (0.6 + rand() * 0.8), fall: fall * (0.7 + rand() * 0.6),
    drift: 15 + rand() * 30, spin: (rand() - 0.5) * 3, phase: rand() * Math.PI * 2,
  })));
  const embers = Array.from({ length: 16 }, () => ({
    x: rand() * w, r: 4 + rand() * 7, rise: 90 + rand() * 120, born: rand() * (duration - 1.4), phase: rand() * Math.PI * 2,
  }));
  return {
    duration,
    frame(ctx, t) {
      const I = envelope(t, duration, 0.6, 1.2);
      if (I <= 0) return;
      // The sky keeps darkening as the cloud settles in.
      ctx.fillStyle = `rgba(40, 34, 32, ${(0.3 + 0.25 * clamp01(t / 3)) * I})`;
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createLinearGradient(0, h, 0, h * 0.45);
      glow.addColorStop(0, `rgba(210, 74, 26, ${(0.38 + 0.06 * Math.sin(t * 2.5)) * clamp01(t / 1.5) * I})`);
      glow.addColorStop(1, 'rgba(200, 72, 28, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, h * 0.45, w, h * 0.55);
      for (const [, color, alpha] of ASH_LAYERS) {
        ctx.fillStyle = `rgba(${color}, ${alpha * I})`;
        ctx.beginPath();
        for (const f of flecks) {
          if (f.color !== color) continue;
          fleckPath(ctx, f.x + t * f.drift + Math.sin(t * 1.5 + f.phase) * 12, f.y + t * f.fall, f.r, f.phase + t * f.spin);
        }
        ctx.fill();
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const e of embers) {
        const age = t - e.born;
        if (age < 0) continue;
        const y = h + 20 - age * e.rise;
        if (y < -20) continue;
        const flicker = (0.6 + 0.4 * Math.sin(age * 11 + e.phase)) * clamp01(age / 0.3);
        const x = e.x + Math.sin(age * 2 + e.phase) * 30;
        glowDisc(ctx, x, y, e.r * 1.4, '255, 140, 60', 0.7 * I * flicker, 0.12);
        glowDisc(ctx, x, y, e.r * 0.35, '255, 220, 150', I * flicker, 0.4);
      }
      ctx.restore();
    },
  };
}

/** A gust carries a flurry of large leaves across the screen, tumbling as they go. */
function leafGust(w: number, h: number, rand: Rand): ForegroundEffect {
  const duration = FOREGROUND_DURATION.fallingLeaves;
  const leaves = Array.from({ length: Math.round(Math.min(40, Math.max(14, (w * h) / 40000))) }, () => ({
    y: rand() * h * 0.9, size: 10 + rand() * 14, born: rand() * 1.4, speed: (0.45 + rand() * 0.45) * w, dip: (rand() - 0.2) * h * 0.3,
    spin: (rand() - 0.5) * 8, flip: 2 + rand() * 4, phase: rand() * Math.PI * 2, color: LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)],
  }));
  return {
    duration,
    frame(ctx, t) {
      const fade = clamp01((duration - t) / 0.8);
      if (fade <= 0) return;
      for (const l of leaves) {
        const age = t - l.born;
        if (age < 0) continue;
        const x = -l.size * 2 + age * l.speed;
        if (x > w + l.size * 2) continue;
        ctx.save();
        ctx.translate(x, l.y + Math.sin(age * 2.2 + l.phase) * 30 + age * l.dip * 0.5);
        ctx.rotate(l.phase + age * l.spin);
        ctx.scale(1, 0.2 + 0.8 * Math.abs(Math.cos(age * l.flip + l.phase)));
        drawLeaf(ctx, l.size, l.color, fade);
        ctx.restore();
      }
    },
  };
}

/** The foreground effect for one kind on a `w` × `h` CSS-pixel canvas. */
export function createForegroundEffect(kind: AllowedWeatherKind, w: number, h: number, rand: Rand = Math.random): ForegroundEffect {
  switch (kind) {
    case 'rain': return rainOnGlass(w, h, rand);
    case 'snow': return settlingSnow(w, h, rand);
    case 'storm': return lightningFlash(w, h, rand);
    case 'blizzard': return whiteout(w, h, rand);
    case 'hail': return hailOnGlass(w, h, rand);
    case 'fog': return fogRollIn(w, h, rand);
    case 'sandstorm': return dustFront(w, h, rand);
    case 'ashfall': return ashCloud(w, h, rand);
    case 'fallingLeaves': return leafGust(w, h, rand);
    case 'brightSun': return sunBurst(w, h, rand);
  }
}
