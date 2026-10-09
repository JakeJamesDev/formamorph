/** Frame the player line starts to type in. */
export const TYPE_START_FRAME = 24;
export const FRAMES_PER_CHAR = 2;
/** Frames the typed line rests before the turn plays. */
const PAUSE_FRAMES = 24;

/** Frames at which a player line finishes typing and the turn's narration starts to reveal. */
export const turnTimeline = (prompt: string) => {
  const typeEnd = TYPE_START_FRAME + prompt.length * FRAMES_PER_CHAR;
  return { typeEnd, revealFrame: typeEnd + PAUSE_FRAMES };
};
