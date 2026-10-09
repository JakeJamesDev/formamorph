import { AbsoluteFill } from 'remotion';
import { CANVAS, type Layout, type SceneProps, type Size } from '../layout';
import { CopyBlock, DEFAULT_DELAY, copyReads, type CopyLines } from '../parts/CopyBlock';
import type { CopyRead } from '../reading';
import { FrameCamera, type CameraPath } from '../parts/FrameCamera';
import { shotFor, type LayoutShot } from '../shots';
import { colors } from '../theme';

/** One half of a stacked scene: its own shot, camera and line of copy. */
export type StackPane = {
  shot: LayoutShot;
  camera: CameraPath;
  caption: CopyLines;
};

type StackSceneProps = SceneProps & { panes: readonly [StackPane, StackPane] };

const GAP = 6;

/** Frame each pane's caption starts to enter: the second follows the first. */
const paneDelay = (index: number) => DEFAULT_DELAY + index * 20;

/** The frames each pane's caption enters, is legible and leaves, for the reading check. */
export const stackReads = (panes: readonly StackPane[], durationInFrames: number): CopyRead[] =>
  panes.flatMap((pane, i) => copyReads(pane.caption, durationInFrames, paneDelay(i)));

/** The area of each pane: the tall canvas splits top and bottom, the wide canvas left and right. */
export const paneSize = (layout: Layout): Size => {
  const { width, height } = CANVAS[layout];
  return layout === 'tall' ? { width, height: (height - GAP) / 2 } : { width: (width - GAP) / 2, height };
};

/** Two shots with their own cameras, one above the other (tall) or side by side (wide), a caption on each. */
export const StackScene = ({ layout, durationInFrames, panes }: StackSceneProps) => {
  const size = paneSize(layout);
  return (
    <AbsoluteFill style={{ backgroundColor: colors.border, flexDirection: layout === 'tall' ? 'column' : 'row', gap: GAP }}>
      {panes.map((pane, i) => (
        <div key={i} style={{ position: 'relative', ...size, overflow: 'hidden', backgroundColor: colors.stage }}>
          <FrameCamera layout={layout} durationInFrames={durationInFrames} shot={shotFor(pane.shot, layout)} path={pane.camera} size={size} />
          <CopyBlock lines={pane.caption} layout={layout} durationInFrames={durationInFrames} variant="pane" delay={paneDelay(i)} />
        </div>
      ))}
    </AbsoluteFill>
  );
};
