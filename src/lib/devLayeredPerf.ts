// DEV only: the `layeredPerf` rig, eight full-size Layers drawn in code so no large art file is committed. The
// mobile probe (`e2e/perf/layered-perf.spec.ts`) measures play and the editor preview on it.

import type { MediaEntry, World } from '@/types';
import { withMembership } from './entityPlaces';

export const PERF_RIG_ID = 'dev-perf-rig';
/** Typical AI art size. */
export const PERF_WIDTH = 1024;
export const PERF_HEIGHT = 1536;

type Paint = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const face = (ctx: CanvasRenderingContext2D, w: number, h: number, fill: string) => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.36, w * 0.24, 0, Math.PI * 2);
  ctx.fill();
};

// One painter per Layer: an opaque base, then translucent shapes over most of the canvas, so every Layer has
// real pixels to composite. The Face Layer has two Variants.
const PAINTERS: Record<string, Paint> = {
  base: (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#26364f');
    g.addColorStop(1, '#7a8fa6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },
  body: (ctx, w, h) => {
    ctx.fillStyle = '#4f6d7a';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.78, w * 0.34, h * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  shade: (ctx, w, h) => {
    ctx.fillStyle = '#8a8aa8';
    ctx.fillRect(0, h * 0.4, w, h * 0.6);
  },
  faceA: (ctx, w, h) => face(ctx, w, h, '#f1c9a5'),
  faceB: (ctx, w, h) => face(ctx, w, h, '#d9a283'),
  glow: (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h * 0.3, 10, w / 2, h * 0.3, w * 0.6);
    g.addColorStop(0, 'rgba(255,220,160,0.9)');
    g.addColorStop(1, 'rgba(255,220,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },
  hair: (ctx, w, h) => {
    ctx.fillStyle = '#c9c9c9';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.3, w * 0.3, Math.PI, 0);
    ctx.fill();
  },
  veil: (ctx, w, h) => {
    ctx.fillStyle = 'rgba(180,200,255,0.5)';
    ctx.fillRect(0, 0, w, h);
  },
  hood: (ctx, w, h) => {
    ctx.fillStyle = '#2e4a3a';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.34, w * 0.33, Math.PI, 0);
    ctx.fill();
  },
};

const paintPng = (paint: Paint): string => {
  const canvas = document.createElement('canvas');
  canvas.width = PERF_WIDTH;
  canvas.height = PERF_HEIGHT;
  const ctx = canvas.getContext('2d');
  // jsdom has no canvas; its fixture-loads test only needs the world's shape.
  if (!ctx) return '';
  paint(ctx, PERF_WIDTH, PERF_HEIGHT);
  return canvas.toDataURL('image/png');
};

/** The rig's Media List entries: one image per Variant and the eight-Layer Layered Image. */
export function perfRigEntries(): Record<string, MediaEntry> {
  const image = (key: string): MediaEntry => ({
    id: `dev-perf-${key}`, name: `dev-perf-${key}`, kind: 'image', type: 'image/png', data: paintPng(PAINTERS[key]),
  });
  const keys = Object.keys(PAINTERS);
  const images = Object.fromEntries(keys.map((key) => [`dev-perf-${key}`, image(key)]));
  const one = (key: string) => [{ mediaId: `dev-perf-${key}` }];
  const rig: MediaEntry = {
    id: PERF_RIG_ID, name: 'Perf Rig', kind: 'layered', layers: [
      { id: 'dev-perf-layer-base', name: 'Base', variants: one('base') },
      { id: 'dev-perf-layer-body', name: 'Body', variants: one('body') },
      { id: 'dev-perf-layer-shade', name: 'Shade', blend: 'multiply', variants: one('shade') },
      { id: 'dev-perf-layer-face', name: 'Face', variants: [...one('faceA'), ...one('faceB')] },
      { id: 'dev-perf-layer-glow', name: 'Glow', blend: 'screen', variants: one('glow') },
      { id: 'dev-perf-layer-hair', name: 'Hair', tint: '#cc6688', variants: one('hair') },
      { id: 'dev-perf-layer-veil', name: 'Veil', opacity: 0.8, variants: one('veil') },
      { id: 'dev-perf-layer-hood', name: 'Hood', variants: one('hood') },
    ],
  };
  return { ...images, [PERF_RIG_ID]: rig };
}

/** `base` with the rig, one scout who links it, and the first location's backdrop on it too. */
export function devLayeredPerfWorld(base: World, placeId?: string): World {
  const scout = withMembership({ id: 'dev-perf-scout', name: 'Perf Scout', images: [{ mediaId: PERF_RIG_ID }] } as unknown as World['entities'][number], placeId ? [placeId] : []);
  return {
    ...base,
    worldOverview: { ...base.worldOverview, mediaList: { ...base.worldOverview.mediaList, ...perfRigEntries() } },
    locations: base.locations.map((l) => (l.id === placeId ? { ...l, images: [{ mediaId: PERF_RIG_ID }] } : l)),
    entities: [scout, ...base.entities],
  };
}
