import { Easing, interpolate, spring, type SpringConfig } from 'remotion';

/** Ruling Q25: frames a line of copy takes to enter, and to leave. */
export const ENTER_FRAMES = 30;
export const EXIT_FRAMES = 30;

const gentle = Easing.inOut(Easing.sin);

/** 1 while a scene holds, falling to 0 over `frames` that end on its last frame. */
export const exitProgress = (frame: number, durationInFrames: number, frames = EXIT_FRAMES) =>
  interpolate(frame, [durationInFrames - 1 - frames, durationInFrames - 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: gentle,
  });

/** Ruling Q27: the springs of the Floating cards language. Each overshoots, then settles. */
export const SPRINGS = {
  card: { damping: 14, stiffness: 90, mass: 1.1 },
  word: { damping: 11, stiffness: 110, mass: 0.9 },
  pill: { damping: 13, stiffness: 120 },
  mark: { damping: 14, stiffness: 80 },
} satisfies Record<string, Partial<SpringConfig>>;

/** A spring that starts at `delay` and settles at `delay + frames`, so the copy timing stays exact. */
export const springIn = (frame: number, fps: number, config: Partial<SpringConfig>, delay: number, frames: number) =>
  spring({ frame: frame - delay, fps, config, durationInFrames: frames });

/** Opacity for a part rising on spring progress `p`: it turns solid before the spring lands. */
export const springOpacity = (p: number) => Math.min(1, p * 1.4);

/** Frames one word's spring takes; the words of a line stagger so the last one lands on the line's enter frames. */
const WORD_FRAMES = 22;

/** Word `index` of `count`: its spring lands by `delay + ENTER_FRAMES`, so a headline enters in the same frames as any line. */
export const wordProgress = (frame: number, fps: number, delay: number, index: number, count: number) => {
  const frames = count > 1 ? WORD_FRAMES : ENTER_FRAMES;
  const stagger = count > 1 ? (ENTER_FRAMES - WORD_FRAMES) / (count - 1) : 0;
  return springIn(frame, fps, SPRINGS.word, delay + index * stagger, frames);
};

/** The slow float of a card while it holds, in pixels. `phase` keeps two cards out of step. */
export const bob = (frame: number, phase = 0) => Math.sin(frame / 38 + phase) * 7;
