import { AbsoluteFill } from 'remotion';
import type { SceneProps } from '../layout';
import { CopyBlock, type CopyLines } from '../parts/CopyBlock';
import { Plate } from '../parts/Plate';
import type { LayoutShot } from '../shots';
import { colors, shade } from '../theme';

type KineticTextProps = SceneProps & {
  lines: CopyLines;
  /** A shot shown blurred and still behind the copy, so the plate matches across shots. Without one the stage is plain. */
  plate?: LayoutShot;
};

/** One or two lines of copy that enter, hold and leave over the dark stage or a blurred plate. */
export const KineticText = ({ layout, durationInFrames, lines, plate }: KineticTextProps) => (
  <AbsoluteFill style={{ backgroundColor: colors.stage }}>
    {plate ? <Plate shot={plate} layout={layout} /> : <AbsoluteFill style={{ background: shade(0) }} />}
    <CopyBlock lines={lines} layout={layout} durationInFrames={durationInFrames} variant="headline" />
  </AbsoluteFill>
);
