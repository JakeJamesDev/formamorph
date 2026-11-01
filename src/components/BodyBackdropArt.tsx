import { RemoteImg } from '@/lib/useRemoteImage';
import type { Backdrop } from '@/types';

const OUTLINE_PROPS = {
  'aria-hidden': true,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
  // The outline stretches with the aspect, so a box stays on its body part (Q16).
  preserveAspectRatio: 'none',
  className: 'pointer-events-none absolute inset-0 h-full w-full text-muted-foreground/50',
} as const;

const HUMANOID_BODY = 'M45 34.25V38c-11 2-20 5-24 13l-9 45c-1 5 1 12 3 14s6 1 7-3l9-44 3 1-2 44-3 69c0 4 2 9 6 9s7-4 8-9l6-59h2l6 59c1 5 4 9 8 9s6-5 6-9l-3-69-2-44 3-1 9 44c1 4 5 5 7 3s4-9 3-14l-9-45c-3-8-12-11-24-13V34.25A17 17 0 1 0 45 34.25Z';
const QUADRUPED_BODY = 'M50 44C70 38 100 38 120 40C128 41 133 38 136 34C138 30 140 27 143 24C143 18 143 10 146 3C150 7 155 12 158 17C160 12 163 7 167 4C168 10 169 15 168 20C170 23 172 26 175 27C179 28 184 29 188 31C190.5 32 190.5 35 188 36C185 38 181 39 177 39C171 40 165 43 160 47C154 51 149 56 146 62C143 68 141 74 140 80L139 112Q139 117 143 118L144 120H130L131 112L130 78C112 82 94 80 80 74C76 80 73 86 71 92L66 102L68 112Q68 117 72 118L73 120H58L59 112L56 102C52 94 48 84 47 72C46 62 47 52 50 44Z';
const QUADRUPED_TAIL = 'M50 44C38 42 26 46 16 58C10 66 8 74 12 80C20 76 32 72 42 62C46 58 47 54 48 50';

/** The figure behind a Body's Slot Boxes, in theme colors. It fills its positioned parent. */
export function BodyBackdropArt({ backdrop }: { backdrop: Backdrop }) {
  if (backdrop.kind === 'humanoid') {
    return (
      <svg viewBox="0 0 100 200" {...OUTLINE_PROPS}>
        <path d={HUMANOID_BODY} vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  if (backdrop.kind === 'quadruped') {
    return (
      <svg viewBox="0 0 200 125" {...OUTLINE_PROPS}>
        <path d={QUADRUPED_BODY} vectorEffect="non-scaling-stroke" />
        <path d={QUADRUPED_TAIL} vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  if (backdrop.kind === 'image') {
    // Fit inside the stage: an image past the aspect clamp gets bars, never a stretch (Q71).
    return (
      <RemoteImg
        src={backdrop.image.data}
        alt=""
        draggable={false}
        style={{ opacity: backdrop.opacity ?? 1 }}
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
      />
    );
  }
  return null;
}
