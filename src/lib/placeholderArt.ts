import type { Placeholder } from '@/types';
import { describePlaceholders } from './placeholders';

// Morph art for an entity with no image. Pure: it returns shapes and colors, and a renderer draws them.

/** The art's own coordinate space, the SVG `viewBox`. */
export const MORPH_FRAME = { width: 200, height: 300 } as const;

/** Where clusters may sit: inside the frame edge and clear of the name scrim at the top. */
export const MORPH_CLUSTER_AREA = { left: 8, right: 192, top: 96, bottom: 292 } as const;

/** Where and how the letter is drawn, shared by the renderer and the letter mask. */
export const MORPH_LETTER = {
  x: 100,
  y: 236,
  pivotX: 100,
  pivotY: 195,
  fontSize: 118,
  fontWeight: 800,
  strokeWidth: 2,
} as const;

/** The goo filter: a blur, then an alpha threshold of `alpha × scale + offset`. */
export const MORPH_GOO = { blur: 4, alphaScale: 22, alphaOffset: -9 } as const;

/** Eight fixed hues around the wheel: teal, sky, blue, violet, pink, coral, amber, green. */
export const MORPH_HUES = [172, 198, 222, 262, 322, 8, 38, 138] as const;

/** The letter's pixels, drawn at its tilt in the {@link MORPH_FRAME} space. Off-frame reads are empty. */
export interface LetterMask {
  width: number;
  height: number;
  ink(x: number, y: number): boolean;
}

export interface MorphPalette {
  /** The diagonal background gradient, top-left to bottom-right. */
  background: [string, string];
  /** Each shape's gradient runs from `body` to `edge`. */
  body: string;
  edge: string;
}

/** A gradient's axis in frame units. */
export interface MorphGradient {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MorphCircle {
  x: number;
  y: number;
  r: number;
}

/** One irregular body: a closed outline around a center, bounded by a circle of radius `extent`. */
export interface MorphLump {
  x: number;
  y: number;
  extent: number;
  points: Array<[number, number]>;
}

export type MorphClusterKind = 'puddle' | 'pinch-off';

export interface MorphCluster {
  kind: MorphClusterKind;
  lumps: MorphLump[];
  gradient: MorphGradient;
}

export interface MorphArt {
  hue: number;
  palette: Record<'dark' | 'light', MorphPalette>;
  letter: {
    char: string;
    /** Degrees about the letter's pivot; negative tilts left. */
    tilt: number;
    drops: MorphCircle[];
    gradient: MorphGradient;
  };
  clusters: MorphCluster[];
}

export interface MorphArtInput {
  /** The listing id when there is one, else the local entity id. Decides the hue only. */
  idSeed: string;
  /** The entity name. Decides the tilt, drops and clusters. */
  nameSeed: string;
  /** From {@link morphLetter}. */
  letter: string;
  /** Draws the letter at the tilt the generator picks. */
  readMask: (letter: string, tilt: number) => LetterMask;
}

/**
 * The letter Morph art shows: the first letter or number of the name after its chips resolve, uppercased,
 * else `?`.
 */
export function morphLetter(name: string, placeholders: readonly Placeholder[] = []): string {
  const found = describePlaceholders(name, placeholders).match(/[\p{L}\p{N}]/u);
  // Some letters uppercase to two (ß → SS); the art has room for one.
  return found ? Array.from(found[0].toUpperCase())[0] : '?';
}

/** FNV-1a. */
function hash(text: string): number {
  let h = 2166136261;
  for (const c of text) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Murmur3's 32-bit finisher. FNV's low bits depend only on each character's low bits; this spreads every bit. */
function mix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Mulberry32 over a finished seed. */
function random(raw: number): () => number {
  let seed = mix(raw);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The hue for an id seed. It needs no letter mask, so a renderer can paint the background before the font loads. */
export function morphHue(idSeed: string): number {
  return MORPH_HUES[mix(hash(idSeed) ^ 0x9e3779b9) % MORPH_HUES.length];
}

export function morphPalette(hue: number, dark: boolean): MorphPalette {
  const hue2 = (hue + 22) % 360;
  const l = (darkL: number, lightL: number) => (dark ? darkL : lightL);
  return {
    background: [`hsl(${hue} 32% ${l(19, 90)}%)`, `hsl(${hue2} 26% ${l(10, 81)}%)`],
    body: `hsl(${hue} 50% ${l(58, 60)}%)`,
    edge: `hsl(${hue2} 48% ${l(50, 54)}%)`,
  };
}

/** A gradient across a box, turned to `angle` radians. */
function gradientAcross(x0: number, y0: number, x1: number, y1: number, angle: number): MorphGradient {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, half = Math.max(x1 - x0, y1 - y0) / 2;
  const gx = Math.cos(angle) * half, gy = Math.sin(angle) * half;
  return { x1: mx - gx, y1: my - gy, x2: mx + gx, y2: my + gy };
}

type Point = [number, number];

interface LetterShape {
  /** Drop candidates: silhouette pixels within 6 px of the letter's bounding box. */
  tips: Point[];
  /** True for an empty pixel that a drop must not reach: a counter or an open mouth. */
  inGap(x: number, y: number): boolean;
}

const shapes = new WeakMap<LetterMask, LetterShape>();

/** Reads the drop candidates and the gaps off a mask, once per mask. */
function letterShape(mask: LetterMask): LetterShape {
  const known = shapes.get(mask);
  if (known) return known;
  const { width: w, height: h } = mask;
  const ink = (x: number, y: number) => mask.ink(x, y);
  // Silhouette pixels touch the outside and face a clear line to the frame edge, so a counter's rim is never one.
  const rim: Point[] = [];
  const dirs: Point[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!ink(x, y)) continue;
      const faces = dirs.some(([dx, dy]) => {
        if (ink(x + dx, y + dy)) return false;
        for (let a = x + dx, b = y + dy; a >= 0 && b >= 0 && a < w && b < h; a += dx, b += dy) if (ink(a, b)) return false;
        return true;
      });
      if (faces) rim.push([x, y]);
    }
  }
  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
  for (const [x, y] of rim) {
    bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y);
  }
  const tips = rim.filter(([x, y]) => x - bx0 < 6 || bx1 - x < 6 || y - by0 < 6 || by1 - y < 6);
  const hull = convexHull(rim);
  const inHull = (x: number, y: number) => hull.every((p, k) => {
    const q = hull[(k + 1) % hull.length];
    return (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]) >= 0;
  });
  const shape = { tips, inGap: (x: number, y: number) => !ink(x, y) && inHull(x, y) };
  shapes.set(mask, shape);
  return shape;
}

/** Andrew's monotone chain. */
function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (list: Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length > 1 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return chain(sorted).concat(chain(sorted.reverse()));
}

/** True when any ink pixel lies within `d` of a point: a coarse pass rejects fast, an exact pass confirms. */
function inkWithin(mask: LetterMask, x: number, y: number, d: number): boolean {
  for (let a = -d; a <= d; a += 4) {
    for (let b = -d; b <= d; b += 4) {
      if (a * a + b * b <= d * d && mask.ink(Math.round(x + a), Math.round(y + b))) return true;
    }
  }
  for (let j = Math.ceil(y - d); j <= Math.floor(y + d); j++) {
    for (let i = Math.ceil(x - d); i <= Math.floor(x + d); i++) {
      if ((i - x) ** 2 + (j - y) ** 2 <= d * d && mask.ink(i, j)) return true;
    }
  }
  return false;
}

/** An irregular round body: a radius wobbled by harmonics 2, 3 and 5, stretched and turned. */
function lumpAt(x: number, y: number, radius: number, rand: () => number): MorphLump {
  const amp = [0.08 + rand() * 0.1, 0.05 + rand() * 0.08, 0.02 + rand() * 0.05];
  const phase = [rand() * 6.3, rand() * 6.3, rand() * 6.3];
  const stretch = 0.7 + rand() * 0.6, spin = rand() * Math.PI;
  const points: Point[] = [];
  let extent = 0;
  for (let k = 0; k < 40; k++) {
    const t = (k / 40) * Math.PI * 2;
    const rad = radius * (1 + amp[0] * Math.sin(2 * t + phase[0]) + amp[1] * Math.sin(3 * t + phase[1]) + amp[2] * Math.sin(5 * t + phase[2]));
    const lx = Math.cos(t) * rad * stretch, ly = Math.sin(t) * rad;
    const px = lx * Math.cos(spin) - ly * Math.sin(spin), py = lx * Math.sin(spin) + ly * Math.cos(spin);
    points.push([x + px, y + py]);
    extent = Math.max(extent, Math.hypot(px, py));
  }
  return { x, y, extent, points };
}

/** A cluster's lumps: a puddle is one body; a pinch-off is a body pulling away from a smaller one. */
function clusterAt(kind: MorphClusterKind, cx: number, cy: number, size: number, turn: number, rand: () => number): MorphLump[] {
  if (kind === 'puddle') return [lumpAt(cx, cy, 17 * size, rand)];
  const gap = 19 * size, dx = Math.cos(turn) * gap, dy = Math.sin(turn) * gap;
  return [lumpAt(cx - dx * 0.4, cy - dy * 0.4, 13 * size, rand), lumpAt(cx + dx * 0.6, cy + dy * 0.6, 8 * size, rand)];
}

/** Builds the Morph art for one entity. */
export function generateMorphArt({ idSeed, nameSeed, letter, readMask }: MorphArtInput): MorphArt {
  // The hue follows the id alone, so two entities that share a name still differ.
  const hue = morphHue(idSeed);
  const rand = random(hash(nameSeed));

  const tilt = Math.round((rand() < 0.5 ? -1 : 1) * (4 + rand() * 5) * 10) / 10;
  const mask = readMask(letter, tilt);
  const { tips, inGap } = letterShape(mask);

  // The goo blur spreads a drop about 4 px past its radius; a few hits are rounding along the hull's own edge.
  const fillsGap = (x: number, y: number, reach: number) => {
    let hits = 0;
    for (let a = -reach; a <= reach; a += 2) {
      for (let b = -reach; b <= reach; b += 2) {
        if (a * a + b * b <= reach * reach && inGap(Math.round(x + a), Math.round(y + b))) hits++;
      }
    }
    return hits > 4;
  };
  const drops: MorphCircle[] = [];
  const dropCount = 3 + Math.floor(rand() * 2);
  for (let tries = 0; drops.length < dropCount && tries < 200 && tips.length; tries++) {
    const [x, y] = tips[Math.floor(rand() * tips.length)];
    const radius = 10 + rand() * 5;
    if (drops.some((d) => Math.hypot(d.x - x, d.y - y) < 40) || fillsGap(x, y, radius + 4)) continue;
    drops.push({ x, y, r: radius });
  }
  const letterGradient = gradientAcross(50, 140, 150, 245, Math.PI / 2 + (rand() - 0.5) * 0.6);

  // Kinds come off a shuffled deck plus one repeat, so a card mixes kinds rather than rolling three puddles.
  const deck: MorphClusterKind[] = rand() < 0.5 ? ['pinch-off', 'puddle'] : ['puddle', 'pinch-off'];
  deck.push(deck[Math.floor(rand() * 2)]);
  const clusterCount = 2 + Math.floor(rand() * 2);
  const clusters: MorphCluster[] = [];
  const taken: MorphLump[] = [];
  for (let slot = 0; clusters.length < clusterCount && slot < deck.length; slot++) {
    for (let tries = 0; tries < 250; tries++) {
      const size = 0.75 + rand() * 0.5, turn = rand() * Math.PI * 2;
      const cx = 30 + rand() * 140, cy = 100 + rand() * 175;
      const lumps = clusterAt(deck[slot], cx, cy, size, turn, rand);
      // A wide letter leaves less room, so the gaps relax once the roomy spots run out.
      const gapInk = tries < 150 ? 24 : 16, gapCluster = tries < 150 ? 22 : 14;
      const { left, right, top, bottom } = MORPH_CLUSTER_AREA;
      const fits = lumps.every(({ x, y, extent: e }) =>
        x - e > left && x + e < right && y - e > top && y + e < bottom
        && drops.every((d) => Math.hypot(d.x - x, d.y - y) > d.r + e + gapInk)
        && taken.every((o) => Math.hypot(o.x - x, o.y - y) > o.extent + e + gapCluster)
        && !inkWithin(mask, x, y, e + gapInk));
      if (!fits) continue;
      taken.push(...lumps);
      const x0 = Math.min(...lumps.map((l) => l.x - l.extent)), x1 = Math.max(...lumps.map((l) => l.x + l.extent));
      const y0 = Math.min(...lumps.map((l) => l.y - l.extent)), y1 = Math.max(...lumps.map((l) => l.y + l.extent));
      clusters.push({ kind: deck[slot], lumps, gradient: gradientAcross(x0, y0, x1, y1, Math.PI / 4 + (rand() - 0.5)) });
      break;
    }
  }

  return {
    hue,
    palette: { dark: morphPalette(hue, true), light: morphPalette(hue, false) },
    letter: { char: letter, tilt, drops, gradient: letterGradient },
    clusters,
  };
}
