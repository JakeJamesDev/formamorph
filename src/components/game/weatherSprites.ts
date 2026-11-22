/** A canvas painted once and copied each frame: soft gradients cost far less to copy than to fill again. */
export type Sprite = OffscreenCanvas;

/** A `w` × `h` sprite painted once by `paint`, or null where no offscreen canvas exists, as in tests. */
export function makeSprite(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): Sprite | null {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const canvas = new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // The offscreen context draws with the same calls the paint functions use.
  paint(ctx as unknown as CanvasRenderingContext2D);
  return canvas;
}

/** Radius in sprite pixels of a glow sprite; it is scaled to any size when drawn. */
export const GLOW_R = 128;

/** A soft disc of light at full strength, `color` as `r, g, b`, held at full until `core` of its radius. */
export function glowSprite(color: string, core = 0): Sprite | null {
  return makeSprite(GLOW_R * 2, GLOW_R * 2, (ctx) => {
    const g = ctx.createRadialGradient(GLOW_R, GLOW_R, 0, GLOW_R, GLOW_R, GLOW_R);
    g.addColorStop(0, `rgba(${color}, 1)`);
    g.addColorStop(Math.max(0.01, core), `rgba(${color}, 0.8)`);
    g.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GLOW_R * 2, GLOW_R * 2);
  });
}

/** Draws a glow sprite centered on `x`, `y` at radius `r` and strength `a`. */
export function drawGlow(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, r: number, a: number) {
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/** Length in sprite pixels of a wedge sprite; it is scaled to its reach when drawn. */
export const WEDGE_LEN = 512;
/** The half-angle a wedge sprite is painted at; a narrower wedge squeezes it. */
export const WEDGE_HALF = 0.12;

/**
 * A wedge of light pointing right from its left middle, as nested layers `[spread, gain]` of its half-angle,
 * fading along its length through `stops` `[offset, gain]`, `color` as `r, g, b`.
 */
export function wedgeSprite(color: string, layers: readonly (readonly [number, number])[], stops: readonly (readonly [number, number])[]): Sprite | null {
  const widest = Math.max(...layers.map(([spread]) => spread));
  const half = Math.tan(WEDGE_HALF * widest) * WEDGE_LEN;
  return makeSprite(WEDGE_LEN, half * 2, (ctx) => {
    for (const [spread, gain] of layers) {
      const g = ctx.createLinearGradient(0, 0, WEDGE_LEN, 0);
      for (const [at, k] of stops) g.addColorStop(at, `rgba(${color}, ${gain * k})`);
      ctx.fillStyle = g;
      const edge = Math.tan(WEDGE_HALF * spread) * WEDGE_LEN;
      ctx.beginPath();
      ctx.moveTo(0, half);
      ctx.lineTo(WEDGE_LEN, half - edge);
      ctx.lineTo(WEDGE_LEN, half + edge);
      ctx.closePath();
      ctx.fill();
    }
  });
}

/** Draws a wedge sprite from `x`, `y` along `angle`, `reach` long, with half-angle `half` and strength `a`. */
export function drawWedge(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, angle: number, reach: number, half: number, a: number) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(reach / WEDGE_LEN, half / WEDGE_HALF * (reach / WEDGE_LEN));
  ctx.drawImage(sprite, 0, -sprite.height / 2);
  ctx.restore();
}
