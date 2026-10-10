/** Ruling Q48: a dense card holds at least 5 s after it lands. */
export const DENSE_HOLD_SECONDS = 5;

/** One dense card's hold in a cut: the seconds from the frame it lands until it starts to leave or a join covers it. */
export type DenseReading = { shot: string; landFrame: number; seconds: number; minSeconds: number; ok: boolean };

/**
 * Measures a dense card's hold. `landFrame` is the scene frame its spring settles, `exitFrame` the frame its exit
 * starts, and `joinOut` the frames the outgoing join overlaps the scene.
 */
export const readDenseHold = (shot: string, landFrame: number, exitFrame: number, durationInFrames: number, joinOut: number, fps: number): DenseReading => {
  const seconds = Math.max(0, Math.min(exitFrame, durationInFrames - joinOut) - landFrame) / fps;
  return { shot, landFrame, seconds, minSeconds: DENSE_HOLD_SECONDS, ok: seconds >= DENSE_HOLD_SECONDS };
};
