import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FPS, type Layout, type SceneProps } from '../layout';
import { EXIT_FRAMES, exitProgress } from '../motion';
import { GOO_CRISP_MS, GooWordmark } from '../parts/GooWordmark';

type Placement = { fontSize: number; maxWidth: number };

const PLACEMENT: Record<Layout, Placement> = {
  wide: { fontSize: 220, maxWidth: 1700 },
  tall: { fontSize: 190, maxWidth: 960 },
};

/** Frame the first blob is born. */
const MARK_FRAME = 6;
/** Frame only the crisp letters are left. */
export const CRISP_FRAME = MARK_FRAME + Math.ceil((GOO_CRISP_MS / 1000) * FPS);
/** Bare stage frames after the wordmark has left, so the loop's last frame matches its first. */
const BARE_TAIL = 8;

/**
 * The opening card: the wordmark coalesces from goo on the bare stage, the blobs dissolve into the crisp letters,
 * then it holds and leaves, so the scene starts and ends on the bare stage (rulings Q28, Q55).
 */
export const WordmarkTitle = ({ layout, durationInFrames }: SceneProps) => {
  const frame = useCurrentFrame();
  const place = PLACEMENT[layout];
  const leaveEnd = durationInFrames - BARE_TAIL;
  if (leaveEnd - EXIT_FRAMES < CRISP_FRAME) throw new Error(`The opening card needs ${CRISP_FRAME + EXIT_FRAMES + BARE_TAIL} frames; it has ${durationInFrames}.`);
  const out = exitProgress(frame, leaveEnd);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ opacity: out, transform: `translateY(${(1 - out) * -30}px) scale(${1 + (1 - out) * 0.04})` }}>
        <GooWordmark fontSize={place.fontSize} maxWidth={place.maxWidth} from={MARK_FRAME} />
      </div>
    </AbsoluteFill>
  );
};
