/**
 * One line of on-screen copy in scene frames, each range half-open: it enters over `start`–`from`, is legible on
 * its own over `from`–`until`, and leaves over `until`–`end`. `end` is null for a line that holds to the scene's end.
 */
export type CopyRead = { text: string; start: number; from: number; until: number; end: number | null };

/** Ruling Q17: every line holds at least 1.5 s and reads at no more than 12 characters per second. Ruling Q25: it takes at least 0.5 s to enter and to leave. */
export const READING_BAR = { minSeconds: 1.5, maxCharsPerSecond: 12, minMotionSeconds: 0.5 };

/**
 * One line's timing in a cut, after the joins into and out of its scene take their frames. `charsPerSecond` is
 * null when the line is never legible; `exitSeconds` is null when the line holds to the end.
 */
export type LineReading = {
  shot: string;
  text: string;
  enterSeconds: number;
  seconds: number;
  exitSeconds: number | null;
  charsPerSecond: number | null;
  ok: boolean;
};

/** Measures a scene's lines against the bar. `joinIn` and `joinOut` are the frames its two joins overlap it. */
export const readLines = (shot: string, reads: CopyRead[], durationInFrames: number, joinIn: number, joinOut: number, fps: number): LineReading[] =>
  reads.map(({ text, start, from, until, end }) => {
    const frames = Math.max(0, Math.min(until, durationInFrames - joinOut) - Math.max(from, joinIn));
    const seconds = frames / fps;
    const enterSeconds = (from - start) / fps;
    const exitSeconds = end === null ? null : (end - until) / fps;
    const charsPerSecond = seconds > 0 ? text.length / seconds : null;
    const calm = enterSeconds >= READING_BAR.minMotionSeconds && (exitSeconds === null || exitSeconds >= READING_BAR.minMotionSeconds);
    const ok = calm && charsPerSecond !== null && seconds >= READING_BAR.minSeconds && charsPerSecond <= READING_BAR.maxCharsPerSecond;
    return { shot, text, enterSeconds, seconds, exitSeconds, charsPerSecond, ok };
  });
