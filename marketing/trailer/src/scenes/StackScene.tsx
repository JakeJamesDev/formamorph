import { AbsoluteFill } from 'remotion';
import type { SceneProps } from '../layout';
import { DEFAULT_DELAY, Pills, copyReads, type CopyLines } from '../parts/CopyBlock';
import type { CameraPath } from '../parts/FrameCamera';
import { ShotCard } from '../parts/GlassCard';
import { STACK_CARDS, STACK_PLACE } from '../poses';
import type { CopyRead } from '../reading';
import { shotFor, type LayoutShot } from '../shots';
import type { DotColor } from '../theme';

/** One card of a stacked scene: its own shot, camera, caption and dot. */
export type StackPane = {
  shot: LayoutShot;
  camera: CameraPath;
  caption: CopyLines;
  dot: DotColor;
};

type StackSceneProps = SceneProps & { panes: readonly [StackPane, StackPane] };

/** Frame each pane's caption starts to enter; its card rises `DEFAULT_DELAY` frames earlier. The second pane follows the first. */
const paneDelay = (index: number) => DEFAULT_DELAY + index * 20;

/** The frames each pane's caption enters, is legible and leaves, for the reading check. */
export const stackReads = (panes: readonly StackPane[], durationInFrames: number): CopyRead[] =>
  panes.flatMap((pane, i) => copyReads(pane.caption, durationInFrames, paneDelay(i)));

/** Two shots on their own glass cards, one above the other (tall) or side by side (wide), a pill caption on each. */
export const StackScene = ({ layout, durationInFrames, panes }: StackSceneProps) => (
  <AbsoluteFill>
    {panes.map((pane, i) => (
      <ShotCard
        key={i}
        shot={shotFor(pane.shot, layout)}
        path={pane.camera}
        pose={STACK_CARDS[layout][i]}
        durationInFrames={durationInFrames}
        delay={paneDelay(i) - DEFAULT_DELAY}
        bobPhase={i * 2}
      />
    ))}
    {panes.map((pane, i) => (
      <Pills key={i} lines={pane.caption} layout={layout} durationInFrames={durationInFrames} delay={paneDelay(i)} place={STACK_PLACE[layout][i]} dot={pane.dot} />
    ))}
  </AbsoluteFill>
);
