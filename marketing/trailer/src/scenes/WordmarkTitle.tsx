import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Layout, SceneProps } from '../layout';
import { SPRINGS, exitProgress } from '../motion';
import { Wordmark, WordmarkFilter } from '../parts/Wordmark';

const WORDMARK_SIZE: Record<Layout, number> = { wide: 220, tall: 190 };
/** The wordmark is a logo, not copy (rulings Q21, Q26), so it leaves faster than a line of text. */
const LEAVE_FRAMES = 18;

/** The wordmark alone on the stage. It springs in, holds and leaves, so the scene ends on the bare stage. */
export const WordmarkTitle = ({ layout, durationInFrames }: SceneProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 4, fps, config: SPRINGS.mark });
  const progress = enter * exitProgress(frame, durationInFrames, LEAVE_FRAMES);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <WordmarkFilter />
      <Wordmark fontSize={WORDMARK_SIZE[layout]} progress={progress} />
    </AbsoluteFill>
  );
};
