import { staticFile } from 'remotion';
import captures from '../captures.json';
import type { Layout, Size } from './layout';

/** The part of a shot that carries its point, in 0–1 fractions of the shot (ruling Q38). */
export type Subject = { x: number; y: number; width: number; height: number };

/**
 * A captured UI screenshot and its layout size in CSS pixels, for the camera math, with its capture id and subject
 * region. A clip also has its frame count and the scene frame it starts to play; a reveal clip, the clip frame that
 * shows its first narration word, which the capture measures.
 */
export type Shot = Size & { id: string; src: string; subject?: Subject; clipFrames?: number; clipFrom?: number; firstWord?: number };

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
  const entry = entryOf(id);
  const { viewport, frames, subject } = entry;
  if (!frames) throw new Error(`Shot "${id}" is not a clip`);
  const firstWord = 'firstWord' in entry && typeof entry.firstWord === 'number' ? entry.firstWord : undefined;
  return { id, src: staticFile(`shots/${id}.mp4`), subject, ...viewport, clipFrames: frames, clipFrom: from, firstWord };
};

/** The player line both turn shots type in. */
export const TURN_PROMPT = 'Type any action.';

/** The scene frame the turn clips start to play, as their card comes up. */
const TURN_CLIP_FROM = 30;

/** The scene frame a turn's panel enters: the clip frame that shows the first narration word (ruling Q54). */
export const panelFrameOf = (clip: Shot) => {
  if (clip.clipFrom === undefined || clip.firstWord === undefined) throw new Error(`Shot "${clip.id}" has no first narration word; run npm run capture -- --only ${clip.id}`);
  return clip.clipFrom + clip.firstWord;
};

/** Captured UI shots and clips in `public/shots/`, written by `npm run capture`. */
export const SHOTS = {
  library: shot('library'),
  game: shot('game'),
  /** The panel below it enters as its first narration word shows. */
  narrationClip: clip('narration-clip', TURN_CLIP_FROM),
  narrationClipTall: clip('narration-clip-tall', TURN_CLIP_FROM),
  /** Plays once the callout lands. */
  statsClip: clip('stats-clip', 60),
  gameTall: shot('game-tall'),
  entity: shot('entity'),
  chat: shot('chat'),
  canvas: shot('canvas'),
  travel: shot('travel'),
  profile: shot('profile'),
  blueprints: shot('blueprints'),
  /** Plays once the card lands: she thinks, then turns to her idle look as the answer streams in. */
  helpClip: clip('help-clip', 40),
  community: shot('community'),
  contest: shot('contest'),
  engine: shot('engine'),
  avatarClip: clip('avatar-clip', 0),
};
