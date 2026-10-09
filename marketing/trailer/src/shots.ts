import { staticFile } from 'remotion';
import captures from '../captures.json';
import type { Layout, Size } from './layout';

/** A captured UI screenshot and its layout size in CSS pixels, for the camera math. A clip also has its frame count. */
export type Shot = Size & { src: string; clipFrames?: number };

/** One shot for both layouts, or its own shot per layout (the tall cut recaptures some screens natively). */
export type LayoutShot = Shot | Record<Layout, Shot>;

export const shotFor = (shot: LayoutShot, layout: Layout): Shot => ('src' in shot ? shot : shot[layout]);

const entryOf = (id: string) => {
  const entry = captures.shots.find((item) => item.id === id);
  if (!entry) throw new Error(`No shot "${id}" in captures.json`);
  return entry;
};

/** A shot from the capture list. The PNG holds `scale` times the layout size in each direction. */
const shot = (id: string): Shot => ({ src: staticFile(`shots/${id}.png`), ...entryOf(id).viewport });

/** A clip from the capture list: the frames `npm run capture` filmed, encoded at the trailer's frame rate. */
const clip = (id: string): Shot => {
  const { viewport, frames } = entryOf(id);
  if (!frames) throw new Error(`Shot "${id}" is not a clip`);
  return { src: staticFile(`shots/${id}.mp4`), ...viewport, clipFrames: frames };
};

/** Captured UI shots and clips in `public/shots/`, written by `npm run capture`. */
export const SHOTS = {
  library: shot('library'),
  turnBefore: shot('turn-before'),
  game: shot('game'),
  statsClip: clip('stats-clip'),
  turnBeforeTall: shot('turn-before-tall'),
  gameTall: shot('game-tall'),
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
