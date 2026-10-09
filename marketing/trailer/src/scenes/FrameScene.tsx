import { AbsoluteFill } from 'remotion';
import type { Layout, SceneProps } from '../layout';
import { Pills, type CopyLines } from '../parts/CopyBlock';
import type { Callout, CameraPath } from '../parts/FrameCamera';
import { ShotCard, fullFrame } from '../parts/GlassCard';
import { CAPTION_PLACE, FRAME_CARDS, type CardPair } from '../poses';
import { shotFor, type LayoutShot } from '../shots';
import type { DotColor } from '../theme';

type FrameSceneProps = SceneProps & {
  shot: LayoutShot;
  camera: Record<Layout, CameraPath>;
  /** The shot on the dimmed card behind: the next shot or a related one. */
  depth: LayoutShot;
  /** A ring on one region, with the rest dimmed. */
  callout?: Callout;
  caption?: CopyLines;
  dot?: DotColor;
  /** This shot's own card placement, where the default does not suit its subject. */
  cards?: Partial<Record<Layout, CardPair>>;
};

/** Frames the depth card trails the subject card. */
const DEPTH_DELAY = 10;

/** The cards a frame scene places in a layout. */
export const frameCards = (layout: Layout, cards?: FrameSceneProps['cards']) => cards?.[layout] ?? FRAME_CARDS[layout];

/** A captured UI shot on a floating glass card over a dimmed depth card, with an optional callout and caption pills. */
export const FrameScene = ({ layout, durationInFrames, shot, camera, depth, callout, caption, dot = 'mint', cards }: FrameSceneProps) => {
  const pair = frameCards(layout, cards);
  return (
    <AbsoluteFill>
      <ShotCard shot={shotFor(depth, layout)} path={fullFrame} pose={pair.depth} durationInFrames={durationInFrames} delay={DEPTH_DELAY} variant="depth" bobPhase={1.4} />
      <ShotCard shot={shotFor(shot, layout)} path={camera[layout]} pose={pair.front} durationInFrames={durationInFrames} callout={callout} />
      {caption && <Pills lines={caption} layout={layout} durationInFrames={durationInFrames} place={CAPTION_PLACE[layout]} dot={dot} />}
    </AbsoluteFill>
  );
};
