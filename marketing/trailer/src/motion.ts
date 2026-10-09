import { interpolate, spring } from 'remotion';

/** Frames a scene's own content takes to leave, ending on the scene's last frame. */
export const EXIT_FRAMES = 18;

/** 1 while a scene holds, falling to 0 on its last frame. */
export const exitProgress = (frame: number, durationInFrames: number) =>
  interpolate(frame, [durationInFrames - EXIT_FRAMES, durationInFrames - 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** A settled spring from 0 to 1 that starts at `delay`. */
export const enterProgress = (frame: number, fps: number, delay: number) =>
  spring({ frame: frame - delay, fps, config: { damping: 200 } });

/** How far in an entering line is before it counts as legible. */
const LEGIBLE_PROGRESS = 0.95;

/** Frames from the start of an enter until the line is legible. */
export const enterFrames = (fps: number) => {
  let frame = 0;
  while (enterProgress(frame, fps, 0) < LEGIBLE_PROGRESS) frame++;
  return frame;
};
