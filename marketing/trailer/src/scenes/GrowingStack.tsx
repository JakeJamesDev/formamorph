import { AbsoluteFill } from 'remotion';
import { readStackHold, type StackHoldReading } from '../holds';
import { FPS, type Layout, type SceneProps } from '../layout';
import { ENTER_FRAMES, EXIT_FRAMES } from '../motion';
import { DEFAULT_DELAY, Pills, copyReads, type CopyLines } from '../parts/CopyBlock';
import type { Callout, CameraPath } from '../parts/FrameCamera';
import { ShotCard, cardLandFrames } from '../parts/GlassCard';
import { TypedPanel, turnReads } from '../parts/TypedPanel';
import type { StackPoses } from '../poses';
import { READING_BAR, type CopyRead } from '../reading';
import { panelFrameOf, shotFor, type LayoutShot, type Shot } from '../shots';
import type { DotColor } from '../theme';
import { turnTimeline } from '../typing';

/** One card of a growing stack: its shot and its camera per layout, under a caption pill or the typed panel. */
export type GrowingPane = {
  shot: LayoutShot;
  camera: Record<Layout, CameraPath>;
  callout?: Callout;
} & ({ caption: CopyLines; dot: DotColor } | { typed: { prompt: string; caption: string } });

/** Ruling Q61: a card holds at least 2 s from the frame it lands. */
const MIN_HOLD_SECONDS = 2;

/** The seconds a line of copy needs on the reading bar. */
const readingSeconds = (line: string) => Math.max(READING_BAR.minSeconds, line.length / READING_BAR.maxCharsPerSecond);

/** The seconds a pane holds at least: 2 s, or the time its copy and clip need (ruling Q61). A pane's frames count from its rise. */
const minHoldSeconds = (pane: GrowingPane, shot: Shot) => {
  const clipEnd = shot.clipFrames ? (shot.clipFrom ?? 0) + shot.clipFrames : 0;
  const land = cardLandFrames(FPS);
  const copyEnd =
    'typed' in pane
      ? turnTimeline(pane.typed.prompt, panelFrameOf(shot)).captionFrame + ENTER_FRAMES + readingSeconds(pane.typed.caption) * FPS
      : land + Math.max(...pane.caption.map(readingSeconds)) * FPS;
  return Math.max(MIN_HOLD_SECONDS, (Math.max(clipEnd, copyEnd) - land) / FPS);
};

/** The frame each pane's card starts to rise and the scene's length: each card lands, holds, then the next one rises. `joinOut` is the frames the outgoing join overlaps the scene. */
export const growingTiming = (panes: readonly GrowingPane[], layout: Layout, joinOut = 0) => {
  const land = cardLandFrames(FPS);
  const rises = [0];
  for (const pane of panes) rises.push(rises[rises.length - 1] + land + Math.ceil(minHoldSeconds(pane, shotFor(pane.shot, layout)) * FPS));
  // After the last hold comes the scene's exit, or the join when it is longer.
  const durationInFrames = rises[panes.length] + Math.max(EXIT_FRAMES + 1, joinOut);
  return { rises: rises.slice(0, panes.length), holdEnds: rises.slice(1), durationInFrames };
};

/** A pane's shot in scene frames: a clip's start counts from its card's rise. */
const risenShot = (pane: GrowingPane, layout: Layout, rise: number): Shot => {
  const shot = shotFor(pane.shot, layout);
  return shot.clipFrames ? { ...shot, clipFrom: (shot.clipFrom ?? 0) + rise } : shot;
};

/** The frames each pane's copy enters, is legible and leaves. A caption leaves as the next card rises, and the typed panel dims. */
export const growingReads = (panes: readonly GrowingPane[], layout: Layout): CopyRead[] => {
  const { rises, holdEnds } = growingTiming(panes, layout);
  return panes.flatMap((pane, i) =>
    'typed' in pane
      ? turnReads(risenShot(pane, layout, rises[i]), pane.typed.prompt, pane.typed.caption, holdEnds[i], holdEnds[i] + EXIT_FRAMES)
      : copyReads(pane.caption, holdEnds[i] + EXIT_FRAMES, rises[i] + DEFAULT_DELAY),
  );
};

/** Each pane's hold from the frame it lands until the next card rises, or the scene's exit or join for the last. */
export const growingHolds = (id: string, panes: readonly GrowingPane[], layout: Layout, joinOut: number): StackHoldReading[] => {
  const { rises, holdEnds, durationInFrames } = growingTiming(panes, layout, joinOut);
  return panes.map((pane, i) => readStackHold(id, i + 1, rises[i] + cardLandFrames(FPS), Math.min(holdEnds[i], durationInFrames - joinOut), minHoldSeconds(pane, shotFor(pane.shot, layout)), FPS));
};

type GrowingStackProps = SceneProps & { panes: readonly GrowingPane[]; poses: StackPoses };

/**
 * Ruling Q61: cards land in turn, each offset on the one before. A card past its hold dims to a depth card and
 * stays in frame. Only the newest card carries a pill; the typed panel dims with its card.
 */
export const GrowingStack = ({ layout, durationInFrames, panes, poses }: GrowingStackProps) => {
  const { rises, holdEnds } = growingTiming(panes, layout);
  const { cards, places, panel } = poses[layout];
  return (
    <AbsoluteFill>
      {panes.map((pane, i) => {
        const dimFrom = i < panes.length - 1 ? holdEnds[i] : undefined;
        const shot = risenShot(pane, layout, rises[i]);
        const callout = pane.callout && { ...pane.callout, from: rises[i] + (pane.callout.from ?? 0) };
        return (
          <div key={i}>
            <ShotCard shot={shot} path={pane.camera[layout]} callout={callout} pose={cards[i]} durationInFrames={durationInFrames} delay={rises[i]} dimFrom={dimFrom} bobPhase={i * 1.7} />
            {'typed' in pane && panel && (
              <TypedPanel layout={layout} clip={shot} pose={panel.pose} padding={panel.padding} prompt={pane.typed.prompt} caption={pane.typed.caption} durationInFrames={durationInFrames} dimFrom={dimFrom} />
            )}
          </div>
        );
      })}
      {panes.map((pane, i) =>
        'typed' in pane ? null : (
          <Pills
            key={i}
            lines={pane.caption}
            layout={layout}
            durationInFrames={i < panes.length - 1 ? holdEnds[i] + EXIT_FRAMES : durationInFrames}
            delay={rises[i] + DEFAULT_DELAY}
            place={places[i]}
            dot={pane.dot}
          />
        ),
      )}
    </AbsoluteFill>
  );
};
