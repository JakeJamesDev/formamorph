import { staticFile } from 'remotion';
import captures from '../captures.json';
import type { Layout, Size } from './layout';

/** A captured UI screenshot and its layout size in CSS pixels, for the camera math. */
export type Shot = Size & { src: string };

/** One shot for both layouts, or its own shot per layout (the tall cut recaptures some screens natively). */
export type LayoutShot = Shot | Record<Layout, Shot>;

export const shotFor = (shot: LayoutShot, layout: Layout): Shot => ('src' in shot ? shot : shot[layout]);

/** A shot from the capture list. The PNG holds `scale` times the layout size in each direction. */
const shot = (id: string): Shot => {
  const entry = captures.shots.find((item) => item.id === id);
  if (!entry) throw new Error(`No shot "${id}" in captures.json`);
  return { src: staticFile(`shots/${id}.png`), ...entry.viewport };
};

/** Captured UI shots in `public/shots/`, written by `npm run capture`. */
export const SHOTS = {
  library: shot('library'),
  turnBefore: shot('turn-before'),
  game: shot('game'),
  entity: shot('entity'),
  chat: shot('chat'),
  canvas: shot('canvas'),
  profile: shot('profile'),
  blueprints: shot('blueprints'),
  help: shot('help'),
  community: shot('community'),
  contest: shot('contest'),
  endpoint: shot('endpoint'),
  avatar: shot('avatar'),
};
