import type { AllowedWeatherKind } from '@/types';
import { drawGlow, drawWedge, glowSprite, makeSprite, wedgeSprite, type Sprite } from './weatherSprites';

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

/** The foreground effect for one kind on a `w` × `h` CSS-pixel canvas. */
export function createForegroundEffect(kind: AllowedWeatherKind, w: number, h: number, rand: Rand = Math.random): ForegroundEffect {
  if (kind === 'rain') return rainOnGlass(w, h, rand);
  if (kind === 'snow') return settlingSnow(w, h, rand);
  if (kind === 'storm') return lightningFlash(w, h, rand);
  return sunBurst(w, h, rand);
}
