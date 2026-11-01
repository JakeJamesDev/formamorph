import { AbsoluteFill } from 'remotion';
import { readStackHold, type StackHoldReading } from '../holds';
import { FPS, type Layout, type SceneProps } from '../layout';
import { EXIT_FRAMES } from '../motion';
import { DEFAULT_DELAY, Pills, copyReads, type CopyLines } from '../parts/CopyBlock';
import type { CameraPath } from '../parts/FrameCamera';
import { ShotCard, cardLandFrames } from '../parts/GlassCard';
import { BUILD_CARDS, BUILD_PLACE } from '../poses';
import { READING_BAR, type CopyRead } from '../reading';
import { shotFor, type LayoutShot } from '../shots';
import type { DotColor } from '../theme';

/** One card of a growing stack: its shot, its camera per layout, its caption and dot. */
export type BuildPane = {
  shot: LayoutShot;
  camera: Record<Layout, CameraPath>;
  caption: CopyLines;
  dot: DotColor;
};

/** Ruling Q61: a card holds at least 2 s from the frame it lands. */
const MIN_HOLD_SECONDS = 2;

/** The seconds a pane holds at least: 2 s, or its caption's reading time when that is longer (ruling Q61). */
const minHoldSeconds = ({ caption }: BuildPane) => Math.max(MIN_HOLD_SECONDS, ...caption.map((line) => line.length / READING_BAR.maxCharsPerSecond));

/** The frame each pane's card starts to rise and the scene's length: each card lands, holds, then the next one rises. */
export const buildTiming = (panes: readonly BuildPane[]) => {
  const land = cardLandFrames(FPS);
  const rises = [0];
  for (const pane of panes) rises.push(rises[rises.length - 1] + land + Math.ceil(minHoldSeconds(pane) * FPS));
  // The frames after the last hold are the scene's exit, which starts one frame before the last EXIT_FRAMES.
  const durationInFrames = rises[panes.length] + EXIT_FRAMES + 1;
  return { rises: rises.slice(0, panes.length), holdEnds: rises.slice(1), durationInFrames };
};

/** The frames each pane's caption enters, is legible and leaves. A caption leaves as the next card rises. */
export const buildReads = (panes: readonly BuildPane[]): CopyRead[] => {
  const { rises, holdEnds } = buildTiming(panes);
  return panes.flatMap((pane, i) => copyReads(pane.caption, holdEnds[i] + EXIT_FRAMES, rises[i] + DEFAULT_DELAY));
};

/** Each pane's hold from the frame it lands until the next card rises, or the scene's exit or join for the last. */
export const buildHolds = (id: string, panes: readonly BuildPane[], joinOut: number): StackHoldReading[] => {
  const { rises, holdEnds, durationInFrames } = buildTiming(panes);
  return panes.map((pane, i) => readStackHold(id, i + 1, rises[i] + cardLandFrames(FPS), Math.min(holdEnds[i], durationInFrames - joinOut), minHoldSeconds(pane), FPS));
};

type BuildStackProps = SceneProps & { panes: readonly BuildPane[] };

/**
 * Ruling Q61: cards land in turn, each offset on the one before. A card past its hold dims to a depth card and
 * stays in frame. Only the newest card carries a caption.
 */
export const BuildStack = ({ layout, durationInFrames, panes }: BuildStackProps) => {
  const { rises, holdEnds } = buildTiming(panes);
  return (
    <AbsoluteFill>
      {panes.map((pane, i) => (
        <ShotCard
          key={i}
          shot={shotFor(pane.shot, layout)}
          path={pane.camera[layout]}
          pose={BUILD_CARDS[layout][i]}
          durationInFrames={durationInFrames}
          delay={rises[i]}
          dimFrom={i < panes.length - 1 ? holdEnds[i] : undefined}
          bobPhase={i * 1.7}
        />
      ))}
      {panes.map((pane, i) => (
        <Pills
          key={i}
          lines={pane.caption}
          layout={layout}
          durationInFrames={i < panes.length - 1 ? holdEnds[i] + EXIT_FRAMES : durationInFrames}
          delay={rises[i] + DEFAULT_DELAY}
          place={BUILD_PLACE[layout][i]}
          dot={pane.dot}
        />
      ))}
    </AbsoluteFill>
  );
};
