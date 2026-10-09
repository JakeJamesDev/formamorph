/** One line of on-screen copy and the scene frames it is legible on its own: entered, and not yet leaving. */
export type CopyRead = { text: string; from: number; until: number };

/** Ruling Q17: every line holds at least 1.5 s and reads at no more than 12 characters per second. */
export const READING_BAR = { minSeconds: 1.5, maxCharsPerSecond: 12 };

/** One line's reading time in a cut, after the joins into and out of its scene take their frames. `charsPerSecond` is null when the line is never legible. */
export type LineReading = { shot: string; text: string; seconds: number; charsPerSecond: number | null; ok: boolean };

/** Measures a scene's lines against the bar. `joinIn` and `joinOut` are the frames its two joins overlap it. */
export const readLines = (shot: string, reads: CopyRead[], durationInFrames: number, joinIn: number, joinOut: number, fps: number): LineReading[] =>
  reads.map(({ text, from, until }) => {
    const frames = Math.max(0, Math.min(until, durationInFrames - joinOut) - Math.max(from, joinIn));
    const seconds = frames / fps;
    const charsPerSecond = seconds > 0 ? text.length / seconds : null;
    const ok = charsPerSecond !== null && seconds >= READING_BAR.minSeconds && charsPerSecond <= READING_BAR.maxCharsPerSecond;
    return { shot, text, seconds, charsPerSecond, ok };
  });
