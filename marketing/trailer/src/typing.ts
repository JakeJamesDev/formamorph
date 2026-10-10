/** Frames after the panel starts to rise that the player line starts to type in. */
const TYPE_LEAD_FRAMES = 18;
export const FRAMES_PER_CHAR = 2;
/** Frames the typed line rests before the caption enters. */
const PAUSE_FRAMES = 24;

/** The frames a turn's player line types in and its caption enters, for a panel that enters on `panelFrame`. */
export const turnTimeline = (prompt: string, panelFrame: number) => {
  const typeStart = panelFrame + TYPE_LEAD_FRAMES;
  const typeEnd = typeStart + prompt.length * FRAMES_PER_CHAR;
  return { typeStart, typeEnd, captionFrame: typeEnd + PAUSE_FRAMES };
};
