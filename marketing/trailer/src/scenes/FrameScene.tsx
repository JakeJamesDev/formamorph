import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { Layout, SceneProps } from '../layout';
import { CopyBlock, type CopyLines } from '../parts/CopyBlock';
import { FrameCamera, type Callout, type CameraPath } from '../parts/FrameCamera';
import { PLATE_SHADE, plateFilter } from '../parts/Plate';
import { shotFor, type LayoutShot } from '../shots';
import { colors, shade } from '../theme';

type FrameSceneProps = SceneProps & {
  shot: LayoutShot;
  camera: Record<Layout, CameraPath>;
  /** A ring on one region, with the rest dimmed. */
  callout?: Callout;
  caption?: CopyLines;
  /** Starts as the blurred plate of this same shot and comes into focus, so a cut from the plate has no jump. */
  fromPlate?: boolean;
};

const FOCUS_FRAMES = 36;

/** A captured UI shot under a pan, zoom or hold, with an optional callout and caption. */
export const FrameScene = ({ layout, durationInFrames, shot, camera, callout, caption, fromPlate }: FrameSceneProps) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: colors.stage }}>
      <AbsoluteFill style={fromPlate ? { filter: plateFilter(interpolate(frame, [0, FOCUS_FRAMES], [0, 1], { extrapolateRight: 'clamp' })) } : undefined}>
        <FrameCamera layout={layout} durationInFrames={durationInFrames} shot={shotFor(shot, layout)} path={camera[layout]} callout={callout} />
      </AbsoluteFill>
      {fromPlate && (
        <AbsoluteFill style={{ background: shade(PLATE_SHADE), opacity: interpolate(frame, [0, FOCUS_FRAMES], [1, 0], { extrapolateRight: 'clamp' }) }} />
      )}
      {caption && <CopyBlock lines={caption} layout={layout} durationInFrames={durationInFrames} variant="caption" />}
    </AbsoluteFill>
  );
};
