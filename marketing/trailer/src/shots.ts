import { staticFile } from 'remotion';
import captures from '../captures.json';
import type { Layout, Size } from './layout';
import { turnTimeline } from './typing';

/** The part of a shot that carries its point, in 0–1 fractions of the shot (ruling Q38). */
export type Subject = { x: number; y: number; width: number; height: number };

/**
 * A captured UI screenshot and its layout size in CSS pixels, for the camera math, with its capture id and subject
 * region. A clip also has its frame count and the scene frame it starts to play.
 */
export type Shot = Size & { id: string; src: string; subject?: Subject; clipFrames?: number; clipFrom?: number };

/** One shot for both layouts, or its own shot per layout (the tall cut recaptures some screens natively). */
export type LayoutShot = Shot | Record<Layout, Shot>;

export const shotFor = (shot: LayoutShot, layout: Layout): Shot => ('src' in shot ? shot : shot[layout]);

const entryOf = (id: string) => {
  const entry = captures.shots.find((item) => item.id === id);
  if (!entry) throw new Error(`No shot "${id}" in captures.json`);
  return entry;
};

/** A shot from the capture list. The PNG holds `scale` times the layout size in each direction. */
const shot = (id: string): Shot => {
  const { viewport, subject } = entryOf(id);
  return { id, src: staticFile(`shots/${id}.png`), subject, ...viewport };
};

/** A clip from the capture list: the frames `npm run capture` filmed, encoded at the trailer's frame rate. It holds its first frame until scene frame `from`. */
const clip = (id: string, from: number): Shot => {
  const { viewport, frames, subject } = entryOf(id);
  if (!frames) throw new Error(`Shot "${id}" is not a clip`);
  return { id, src: staticFile(`shots/${id}.mp4`), subject, ...viewport, clipFrames: frames, clipFrom: from };
};

/** The player line both turn shots type in. */
export const TURN_PROMPT = 'Type any action.';

/** The scene frame the turn clips start to play: the reveal, once the player line has typed in. */
const REVEAL_FRAME = turnTimeline(TURN_PROMPT).revealFrame;

/** Captured UI shots and clips in `public/shots/`, written by `npm run capture`. */
export const SHOTS = {
  library: shot('library'),
  game: shot('game'),
  /** Plays as the player line finishes typing on the panel below it. */
  narrationClip: clip('narration-clip', REVEAL_FRAME),
  narrationClipTall: clip('narration-clip-tall', REVEAL_FRAME),
  /** Plays once the callout lands. */
  statsClip: clip('stats-clip', 60),
  gameTall: shot('game-tall'),
  entity: shot('entity'),
  chat: shot('chat'),
  canvas: shot('canvas'),
  travel: shot('travel'),
  profile: shot('profile'),
  blueprints: shot('blueprints'),
  help: shot('help'),
  community: shot('community'),
  contest: shot('contest'),
  engine: shot('engine'),
  avatarClip: clip('avatar-clip', 0),
};
