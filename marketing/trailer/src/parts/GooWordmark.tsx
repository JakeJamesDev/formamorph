import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';
import { INTRO_FONT_BASE64, INTRO_FONT_FAMILY } from '../../../../src/lib/introFont';
import { colors } from '../theme';

/** The intro's cine timeline in ms, shifted so the first blob is born at 0. */
const T = { genesis: 350, popcorn: 2000, magnet: 3000, solid: 6500 };
/** Ms from the first blob until every blob has magnetized into place. */
export const GOO_SETTLE_MS = T.magnet;
const POP_MS = 300;
const SEED = 20261009;

const WORD = 'Formamorph';
/** "Forma" is the first five letters; "morph" takes the gradient. */
const FORMA_LENGTH = 5;
/** The intro's tracking, in em: tight enough for size, open enough that the letters never weld. */
const TRACKING = 0.05;
const FILTER_ID = 'goo-wordmark';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** Springy pop: grows with an overshoot bulge, then a damped wobble that settles to 1. */
const springScale = (age: number, dur: number) => {
  if (age <= 0) return 0;
  const s = age / dur;
  if (s < 1) return easeOut(s) * (1 + Math.sin(s * Math.PI) * 0.5);
  return 1 + Math.exp(-(s - 1) * 3.2) * Math.sin((s - 1) * 13) * 0.17;
};

/** Mulberry32: the same stream on every render, so every frame of every render matches. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Blob = { x: number; y: number; px: number; py: number; r: number; seed: number; jig: number; rank: number; morph: boolean };
type Glyph = { ch: string; x: number };
/** The letters' box, the margin the blobs fly in from, and everything placed in the padded box. */
type GooLayout = { width: number; height: number; pad: number; midY: number; font: string; glyphs: Glyph[]; blobs: Blob[]; step: number; morphFrom: number; morphTo: number };

const fontOf = (size: number) => `700 ${size}px '${INTRO_FONT_FAMILY}', sans-serif`;

/** The intro's own face: Baloo 2 Bold, cut to the wordmark's letters. */
const loadIntroFont = () =>
  new FontFace(INTRO_FONT_FAMILY, `url(data:font/woff2;base64,${INTRO_FONT_BASE64})`, { weight: '700' }).load().then((face) => {
    document.fonts.add(face);
  });

/** The wordmark box's height for a font size: one line at the title card's line height. */
const boxHeight = (fontSize: number) => Math.round(fontSize * 0.9);

/** Places the letters, shrunk to fit `maxWidth`, and samples their mask into blobs, as the intro's `buildTargets` does. */
const buildLayout = (maxSize: number, maxWidth: number): GooLayout => {
  const random = seeded(SEED);
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new Error('No 2D canvas');
  const chars = WORD.split('');
  let fontSize = maxSize;
  let tracking = 0;
  let widths: number[] = [];
  let textWidth = 0;
  for (let fit = 0; fit < 16; fit++) {
    measure.font = fontOf(fontSize);
    tracking = fontSize * TRACKING;
    widths = chars.map((ch) => measure.measureText(ch).width);
    textWidth = widths.reduce((a, w) => a + w, 0) + tracking * (chars.length - 1);
    if (textWidth <= maxWidth || fontSize <= 28) break;
    fontSize *= maxWidth / textWidth;
  }
  const font = fontOf(fontSize);
  // Blobs start up to about one font size from their place, so the drawing reaches that far past the letters.
  const pad = Math.round(fontSize * 1.2);
  const height = boxHeight(maxSize);
  const boxW = Math.round(textWidth) + pad * 2;
  const boxH = height + pad * 2;
  const midY = pad + height / 2;

  const off = document.createElement('canvas');
  off.width = boxW;
  off.height = boxH;
  const o = off.getContext('2d');
  if (!o) throw new Error('No 2D canvas');
  o.textBaseline = 'middle';
  o.textAlign = 'left';
  o.fillStyle = '#fff';
  o.font = font;
  const glyphs: Glyph[] = [];
  let adv = pad;
  let morphFrom = pad;
  chars.forEach((ch, i) => {
    if (i === FORMA_LENGTH) morphFrom = adv;
    o.fillText(ch, adv, midY);
    glyphs.push({ ch, x: adv });
    adv += widths[i] + tracking;
  });
  const morphTo = adv - tracking;

  const img = o.getImageData(0, 0, boxW, boxH).data;
  const step = Math.max(6, Math.round(fontSize * 0.085));
  const cx = boxW / 2;
  const pts: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < boxH; y += step) {
    for (let x = 0; x < boxW; x += step) {
      if (img[(y * boxW + x) * 4 + 3] > 128) {
        const px = x + (random() - 0.5) * step * 0.22;
        const py = y + (random() - 0.5) * step * 0.22;
        pts.push({ x: px, y: py, d: ((px - cx) ** 2 + (py - midY) ** 2) * (0.6 + random() * 0.8) });
      }
    }
  }
  pts.sort((a, b) => a.d - b.d);
  const n = Math.max(1, pts.length);
  const blobs = pts.map((p, i): Blob => {
    const a = random() * Math.PI * 2;
    let dd = fontSize * (0.12 + random() * 0.45);
    if (random() < 0.22) dd *= 1.9;
    let r = step * (0.5 + random() * random() * 0.55);
    if (random() < 0.08) r *= 1.4;
    return {
      x: p.x, y: p.y, px: p.x + Math.cos(a) * dd, py: p.y + Math.sin(a) * dd,
      r, seed: random() * 100, jig: step * (0.14 + random() * 0.18), rank: i / n, morph: p.x >= morphFrom,
    };
  });
  // The first kernel grows from dead center, large enough to survive the threshold alone.
  if (blobs.length) Object.assign(blobs[0], { px: cx, py: midY, r: step * 0.9 });
  return { width: Math.round(textWidth), height, pad, midY, font, glyphs, blobs, step, morphFrom, morphTo };
};

/** Draws one frame of the intro at `t` ms after the first blob, as the intro's frame loop draws its goo layer. */
const draw = (ctx: CanvasRenderingContext2D, layout: GooLayout, t: number) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const gradient = ctx.createLinearGradient(layout.morphFrom, 0, layout.morphTo, 0);
  gradient.addColorStop(0, colors.dots.purple);
  gradient.addColorStop(0.55, colors.dots.pink);
  gradient.addColorStop(1, colors.dots.rose);
  const fill = (morph: boolean) => (morph ? gradient : colors.foreground);

  const restWin = T.popcorn - T.genesis;
  const magRaw = clamp01((t - T.popcorn) / (T.magnet - T.popcorn));
  layout.blobs.forEach((b, i) => {
    const age = t - (i === 0 ? 0 : T.genesis + restWin * (0.03 + 0.9 * b.rank));
    if (age <= 0) return;
    const m = easeInOut(clamp01((magRaw - b.rank * 0.35) / 0.65));
    const jig = b.jig * (1 - 0.82 * m);
    const r = b.r * springScale(age, i === 0 ? POP_MS * 1.6 : POP_MS) * (1 - 0.18 * m);
    if (r < 0.5) return;
    ctx.fillStyle = fill(b.morph);
    ctx.beginPath();
    ctx.arc(b.px + (b.x - b.px) * m + Math.sin(t / 280 + b.seed) * jig, b.py + (b.y - b.py) * m + Math.cos(t / 320 + b.seed * 1.3) * jig, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // The real letters swell in through the threshold across the magnetize and hold.
  const solid = easeInOut(clamp01((t - T.popcorn) / (T.solid - T.popcorn)));
  if (solid <= 0) return;
  ctx.save();
  ctx.globalAlpha = solid;
  ctx.font = layout.font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const wx = Math.sin(t / 430) * 1.2;
  const wy = Math.cos(t / 310) * 1.4;
  layout.glyphs.forEach((g, i) => {
    ctx.fillStyle = fill(i >= FORMA_LENGTH);
    ctx.fillText(g.ch, g.x + wx + Math.sin(t / 350 + i) * 0.8, layout.midY + wy + Math.cos(t / 280 + i * 1.7));
  });
  ctx.restore();
};

/**
 * "Formamorph" coalescing from goo, as the app's first-run intro (`src/components/IntroSequence.tsx`, cine pace, no
 * kicker) does, driven by the frame (ruling Q49). Blobs pop in, magnetize into place and merge into the letters
 * through a metaball filter. The letters keep the intro's face and spacing in the trailer wordmark's colors, and each
 * blob takes its letter's color (ruling Q53).
 *
 * The first blob is born at scene frame `from`, at `fontSize` or smaller to fit `maxWidth`. It takes a fixed box in
 * the layout; the blobs fly in from past its edges.
 */
export const GooWordmark = ({ fontSize, maxWidth, from }: { fontSize: number; maxWidth: number; from: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState<GooLayout | null>(null);
  const [handle] = useState(() => delayRender('Goo wordmark layout'));

  useEffect(() => {
    let live = true;
    loadIntroFont().then(
      () => {
        if (live) setLayout(buildLayout(fontSize, maxWidth));
      },
      (error: unknown) => cancelRender(error),
    );
    return () => {
      live = false;
    };
  }, [fontSize, maxWidth]);

  useLayoutEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!layout || !ctx) return;
    draw(ctx, layout, ((frame - from) / fps) * 1000);
    continueRender(handle);
  }, [frame, from, fps, layout, handle]);

  // The box has its final size before the layout is measured: copy that moves after the first paint can be
  // captured from its old raster.
  const box = { position: 'relative', width: maxWidth, height: boxHeight(fontSize) } as const;
  return (
    <div style={box}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id={FILTER_ID}>
            <feGaussianBlur in="SourceGraphic" stdDeviation={layout ? layout.step * 0.3 : 0} result="b" />
            <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11" />
          </filter>
        </defs>
      </svg>
      {layout && (
        <canvas
          ref={canvas}
          width={layout.width + layout.pad * 2}
          height={layout.height + layout.pad * 2}
          style={{ position: 'absolute', left: (maxWidth - layout.width) / 2 - layout.pad, top: -layout.pad, filter: `url(#${FILTER_ID})` }}
        />
      )}
    </div>
  );
};
