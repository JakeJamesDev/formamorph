import { AbsoluteFill, Img } from 'remotion';
import type { Layout } from '../layout';
import { shotFor, type LayoutShot } from '../shots';
import { shade } from '../theme';

/** The filter and shade that turn a shot into a plate. A scene that focuses in from a plate starts from these. */
export const PLATE_BLUR = 28;
export const PLATE_SATURATE = 0.85;
export const PLATE_BRIGHTNESS = 0.55;
export const PLATE_SHADE = 0.35;

/** The plate's filter, relaxed `t` of the way (0–1) to no filter. */
export const plateFilter = (t = 0) =>
  `blur(${PLATE_BLUR * (1 - t)}px) saturate(${PLATE_SATURATE + (1 - PLATE_SATURATE) * t}) brightness(${PLATE_BRIGHTNESS + (1 - PLATE_BRIGHTNESS) * t})`;

/** A shot shown blurred, dimmed and still, so every scene on one plate matches pixel for pixel. */
export const Plate = ({ shot, layout }: { shot: LayoutShot; layout: Layout }) => (
  <>
    <Img src={shotFor(shot, layout).src} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: plateFilter() }} />
    <AbsoluteFill style={{ background: shade(PLATE_SHADE) }} />
  </>
);
