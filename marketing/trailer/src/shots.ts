import { staticFile } from 'remotion';
import captures from '../captures.json';
import type { Size } from './layout';

/** A captured UI screenshot and its layout size in CSS pixels, for the camera math. */
export type Shot = Size & { src: string };

/** A shot from the capture list. The PNG holds `scale` times the layout size in each direction. */
const shot = (id: string): Shot => {
  const entry = captures.shots.find((item) => item.id === id);
  if (!entry) throw new Error(`No shot "${id}" in captures.json`);
  return { src: staticFile(`shots/${id}.png`), ...entry.viewport };
};

/** Captured UI shots in `public/shots/`, written by `npm run capture`. */
export const SHOTS = {
  library: shot('library'),
  game: shot('game'),
};
