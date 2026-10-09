import { AbsoluteFill, Img } from 'remotion';
import type { Layout } from '../layout';
import { shotFor, type LayoutShot } from '../shots';
import { shade } from '../theme';
import { FrameCamera, type CameraStop } from './FrameCamera';

/** The filter and shade that turn a shot into a plate. A scene that focuses in from a plate starts from these. */
export const PLATE_BLUR = 28;
export const PLATE_SATURATE = 0.85;
export const PLATE_BRIGHTNESS = 0.55;
export const PLATE_SHADE = 0.35;

/** The plate's filter, relaxed `t` of the way (0–1) to no filter. */
export const plateFilter = (t = 0) =>
  `blur(${PLATE_BLUR * (1 - t)}px) saturate(${PLATE_SATURATE + (1 - PLATE_SATURATE) * t}) brightness(${PLATE_BRIGHTNESS + (1 - PLATE_BRIGHTNESS) * t})`;

type PlateProps = {
  shot: LayoutShot;
  layout: Layout;
  durationInFrames: number;
  /** Where the camera holds, so a cut to a frame scene that opens there has no jump. Without it the shot covers the canvas. */
  at?: Record<Layout, CameraStop>;
};

/** A shot shown blurred, dimmed and still, so every scene on one plate matches pixel for pixel. */
export const Plate = ({ shot, layout, durationInFrames, at }: PlateProps) => (
  <>
    {at ? (
      <AbsoluteFill style={{ filter: plateFilter() }}>
        <FrameCamera layout={layout} durationInFrames={durationInFrames} shot={shotFor(shot, layout)} path={{ from: at[layout], to: at[layout] }} />
      </AbsoluteFill>
    ) : (
      <Img src={shotFor(shot, layout).src} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: plateFilter() }} />
    )}
    <AbsoluteFill style={{ background: shade(PLATE_SHADE) }} />
  </>
);
