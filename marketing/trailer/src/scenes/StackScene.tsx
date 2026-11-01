import { AbsoluteFill } from 'remotion';
import type { Layout, SceneProps } from '../layout';
import type { TextTrack } from '../onScreen';
import { DEFAULT_DELAY, Pills, copyReads, pillTracks, type CopyLines } from '../parts/CopyBlock';
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

/** Frame pane `index`'s card starts to rise. */
export const paneRise = (index: number) => paneDelay(index) - DEFAULT_DELAY;

/** The frames each pane's caption enters, is legible and leaves, for the reading check. */
export const stackReads = (panes: readonly StackPane[], durationInFrames: number): CopyRead[] =>
  panes.flatMap((pane, i) => copyReads(pane.caption, durationInFrames, paneDelay(i)));

/** Each pane's pills on every frame, for the on-screen check. */
export const stackTexts = async (panes: readonly StackPane[], layout: Layout, durationInFrames: number): Promise<TextTrack[]> =>
  (await Promise.all(panes.map((pane, i) => pillTracks({ lines: pane.caption, layout, place: STACK_PLACE[layout][i], dot: pane.dot, delay: paneDelay(i), durationInFrames })))).flat();

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
        delay={paneRise(i)}
        bobPhase={i * 2}
      />
    ))}
    {panes.map((pane, i) => (
      <Pills key={i} lines={pane.caption} layout={layout} durationInFrames={durationInFrames} delay={paneDelay(i)} place={STACK_PLACE[layout][i]} dot={pane.dot} />
    ))}
  </AbsoluteFill>
);
