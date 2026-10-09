import { AbsoluteFill } from 'remotion';
import type { Layout, SceneProps } from '../layout';
import { CopyBlock, type CopyLines } from '../parts/CopyBlock';
import type { CameraStop } from '../parts/FrameCamera';
import { Plate } from '../parts/Plate';
import type { LayoutShot } from '../shots';
import { colors, shade } from '../theme';

type KineticTextProps = SceneProps & {
  lines: CopyLines;
  /** A shot shown blurred and still behind the copy, so the plate matches across shots. Without one the stage is plain. */
  plate?: LayoutShot;
  /** Where the plate's camera holds. */
  plateAt?: Record<Layout, CameraStop>;
  /** Frame the first line starts to enter. */
  delay?: number;
};

/** One or two lines of copy that enter, hold and leave over the dark stage or a blurred plate. */
export const KineticText = ({ layout, durationInFrames, lines, plate, plateAt, delay }: KineticTextProps) => (
  <AbsoluteFill style={{ backgroundColor: colors.stage }}>
    {plate ? <Plate shot={plate} layout={layout} durationInFrames={durationInFrames} at={plateAt} /> : <AbsoluteFill style={{ background: shade(0) }} />}
    <CopyBlock lines={lines} layout={layout} durationInFrames={durationInFrames} variant="headline" delay={delay} />
  </AbsoluteFill>
);
