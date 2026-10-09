import { Easing, interpolate } from 'remotion';

/** Ruling Q25: frames a line of copy takes to enter, and to leave. */
export const ENTER_FRAMES = 30;
export const EXIT_FRAMES = 30;

const gentle = Easing.inOut(Easing.sin);

/** 0 before `delay`, rising to 1 over the enter frames. */
export const enterProgress = (frame: number, delay: number) =>
  interpolate(frame, [delay, delay + ENTER_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: gentle });

/** 1 while a scene holds, falling to 0 on its last frame. */
export const exitProgress = (frame: number, durationInFrames: number) =>
  interpolate(frame, [durationInFrames - 1 - EXIT_FRAMES, durationInFrames - 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: gentle,
  });
