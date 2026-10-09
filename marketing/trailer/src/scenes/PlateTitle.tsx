import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Layout, SceneProps } from '../layout';
import { enterProgress, exitProgress } from '../motion';
import { Plate } from '../parts/Plate';
import { Wordmark, WordmarkFilter } from '../parts/Wordmark';
import type { LayoutShot } from '../shots';
import { colors, fonts } from '../theme';

type PlateTitleProps = SceneProps & { plate: LayoutShot };

const WORDMARK_SIZE: Record<Layout, number> = { wide: 220, tall: 190 };

/** The wordmark alone over a plate. It lands, holds and leaves, so the scene ends on the bare plate. */
export const PlateTitle = ({ layout, durationInFrames, plate }: PlateTitleProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = enterProgress(frame, fps, 4) * exitProgress(frame, durationInFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.stage, fontFamily: fonts.body, color: colors.foreground }}>
      <WordmarkFilter />
      <Plate shot={plate} layout={layout} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Wordmark fontSize={WORDMARK_SIZE[layout]} progress={progress} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
