import { AbsoluteFill } from 'remotion';
import type { Layout, SceneProps } from '../layout';
import { CopyBlock, type CopyLines } from '../parts/CopyBlock';
import { FrameCamera, type Callout, type CameraPath } from '../parts/FrameCamera';
import { shotFor, type LayoutShot } from '../shots';
import { colors } from '../theme';

type FrameSceneProps = SceneProps & {
  shot: LayoutShot;
  camera: Record<Layout, CameraPath>;
  /** A ring on one region, with the rest dimmed. */
  callout?: Callout;
  caption?: CopyLines;
};

/** A captured UI shot under a pan, zoom or hold, with an optional callout and caption. */
export const FrameScene = ({ layout, durationInFrames, shot, camera, callout, caption }: FrameSceneProps) => (
  <AbsoluteFill style={{ backgroundColor: colors.stage }}>
    <FrameCamera layout={layout} durationInFrames={durationInFrames} shot={shotFor(shot, layout)} path={camera[layout]} callout={callout} />
    {caption && <CopyBlock lines={caption} layout={layout} durationInFrames={durationInFrames} variant="caption" />}
  </AbsoluteFill>
);
