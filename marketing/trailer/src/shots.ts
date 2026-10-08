import { staticFile } from 'remotion';
import type { Size } from './layout';

/** A captured UI screenshot and its pixel size, for the camera math. */
export type Shot = Size & { src: string };

/** Captured UI shots in `public/shots/`. */
export const SHOTS = {
  library: { src: staticFile('shots/library.webp'), width: 1600, height: 900 },
  game: { src: staticFile('shots/game.webp'), width: 1600, height: 900 },
} satisfies Record<string, Shot>;
