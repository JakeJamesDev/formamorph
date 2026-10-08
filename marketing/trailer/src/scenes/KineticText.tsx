import { AbsoluteFill, Img } from 'remotion';
import type { SceneProps } from '../layout';
import { CopyBlock, type CopyLines } from '../parts/CopyBlock';
import { shotFor, type LayoutShot } from '../shots';
import { colors, shade } from '../theme';

type KineticTextProps = SceneProps & {
  lines: CopyLines;
  /** A shot shown blurred and still behind the copy, so the plate matches across shots. Without one the stage is plain. */
  plate?: LayoutShot;
};

/** One or two lines of copy that enter, hold and leave over the dark stage or a blurred plate. */
export const KineticText = ({ layout, durationInFrames, lines, plate }: KineticTextProps) => (
  <AbsoluteFill style={{ backgroundColor: colors.stage }}>
    {plate && (
      <Img
        src={shotFor(plate, layout).src}
        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) saturate(.85) brightness(.55)' }}
      />
    )}
    <AbsoluteFill style={{ background: shade(plate ? 0.35 : 0) }} />
    <CopyBlock lines={lines} layout={layout} durationInFrames={durationInFrames} variant="headline" />
  </AbsoluteFill>
);
