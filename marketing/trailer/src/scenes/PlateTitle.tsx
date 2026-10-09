import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Layout, SceneProps } from '../layout';
import type { CameraStop } from '../parts/FrameCamera';
import { Plate } from '../parts/Plate';
import { Wordmark, WordmarkFilter } from '../parts/Wordmark';
import type { LayoutShot } from '../shots';
import { colors, fonts } from '../theme';

/** `plateAt` is where the plate's camera holds. */
type PlateTitleProps = SceneProps & { plate: LayoutShot; plateAt?: Record<Layout, CameraStop> };

const WORDMARK_SIZE: Record<Layout, number> = { wide: 220, tall: 190 };
/** The wordmark is a logo, not copy (rulings Q21, Q26), so it lands and leaves faster than a line of text. */
const LEAVE_FRAMES = 18;

/** The wordmark alone over a plate. It lands, holds and leaves, so the scene ends on the bare plate. */
export const PlateTitle = ({ layout, durationInFrames, plate, plateAt }: PlateTitleProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const leave = interpolate(frame, [durationInFrames - LEAVE_FRAMES, durationInFrames - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const progress = enter * leave;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.stage, fontFamily: fonts.body, color: colors.foreground }}>
      <WordmarkFilter />
      <Plate shot={plate} layout={layout} durationInFrames={durationInFrames} at={plateAt} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Wordmark fontSize={WORDMARK_SIZE[layout]} progress={progress} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
