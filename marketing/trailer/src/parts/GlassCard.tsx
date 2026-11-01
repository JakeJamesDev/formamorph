import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, measureSpring, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CANVAS, type Layout, type Rect, type Size } from '../layout';
import { BOB_PIXELS, ENTER_FRAMES, SPRINGS, bob, exitProgress, springIn } from '../motion';
import type { Shot } from '../shots';
import { colors, glass } from '../theme';
import { FrameCamera, type Callout, type CameraPath } from './FrameCamera';

/** Where a card sits and how it leans. `x` and `y` move its center off the canvas center; `tilt` turns it about the vertical axis from the scene's first frame to its last. */
export type CardPose = Size & { x: number; y: number; tilt: readonly [number, number]; lean: number };

/** The card's size alone, for the camera inside it. */
export const cardSize = ({ width, height }: CardPose): Size => ({ width, height });

/** `shot` is the subject; `depth` is the dimmed card behind it, which slides in from the side; `panel` is frosted glass for drawn text. */
export type CardVariant = 'shot' | 'depth' | 'panel';

/** `settle` lands the spring on that frame, so a panel is still when its copy turns legible. */
type VariantLook = { rise: number; slide: number; bob: number; opacity: number; settle?: number; style: CSSProperties };

const LOOK: Record<CardVariant, VariantLook> = {
  shot: { rise: 520, slide: 0, bob: 1, opacity: 1, style: { border: glass.border, background: colors.stage, boxShadow: glass.shadow } },
  depth: { rise: 0, slide: 300, bob: 0.6, opacity: 0.45, style: { background: colors.stage, boxShadow: glass.depthShadow, filter: 'brightness(0.7)' } },
  panel: {
    rise: 520,
    slide: 0,
    bob: 1,
    opacity: 1,
    settle: ENTER_FRAMES,
    style: { border: glass.border, background: colors.panel, backdropFilter: 'blur(18px)', boxShadow: glass.shadow },
  },
};

/** Frames a shot card takes from its rise to land: its spring settles within 0.5% (ruling Q53). */
export const cardLandFrames = (fps: number) => measureSpring({ fps, config: SPRINGS.card, threshold: 0.005 });

/** How far a card of a variant floats above and below its rest, in pixels. */
export const cardBob = (variant: CardVariant) => BOB_PIXELS * LOOK[variant].bob;

/** How far a card drifts while it fades out, in pixels. */
const EXIT_DRIFT = { x: -60, y: -40 };
const RADIUS = 28;

/** How a card moves over its scene. */
export type CardMotion = {
  /** A panel card leaves out `height` and fits its text. */
  pose: Omit<CardPose, 'height'> & { height?: number };
  durationInFrames: number;
  variant?: CardVariant;
  /** Frame the card starts to rise. */
  delay?: number;
  /** Keeps two cards' bobs out of step. */
  bobPhase?: number;
  /** The card stays to the scene's last frame instead of leaving, as on the end card. */
  holdsToEnd?: boolean;
};

/** A card's offset off the canvas center, its two turns in degrees and its opacity on a frame. */
export const cardMotionAt = (frame: number, fps: number, { pose, durationInFrames, variant = 'shot', delay = 0, bobPhase = 0, holdsToEnd = false }: CardMotion) => {
  const look = LOOK[variant];
  const enter = look.settle ? springIn(frame, fps, SPRINGS.card, delay, look.settle) : spring({ frame: frame - delay, fps, config: SPRINGS.card });
  const out = holdsToEnd ? 1 : exitProgress(frame, durationInFrames);
  return {
    x: pose.x + (1 - enter) * look.slide + (1 - out) * EXIT_DRIFT.x,
    y: pose.y + (1 - enter) * look.rise + bob(frame, bobPhase) * look.bob + (1 - out) * EXIT_DRIFT.y,
    turnY: interpolate(frame, [0, durationInFrames - 1], pose.tilt, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    turnX: pose.lean + (1 - enter) * 10,
    opacity: Math.min(1, enter * 1.6) * out * look.opacity,
  };
};

const PERSPECTIVE = 2200;

/** The box on the canvas that holds a card of `size` on a frame, with its turns and perspective. */
export const cardBoxAt = (layout: Layout, { width, height }: Size, { x, y, turnY, turnX }: ReturnType<typeof cardMotionAt>): Rect => {
  const [cosX, sinX] = [Math.cos((turnX * Math.PI) / 180), Math.sin((turnX * Math.PI) / 180)];
  const [cosY, sinY] = [Math.cos((turnY * Math.PI) / 180), Math.sin((turnY * Math.PI) / 180)];
  const corners = [-1, 1].flatMap((sideX) =>
    [-1, 1].map((sideY) => {
      const [pointX, pointY] = [(sideX * width) / 2, (sideY * height) / 2];
      const lean = pointY * sinX;
      const near = PERSPECTIVE / (PERSPECTIVE - (-pointX * sinY + lean * cosY));
      return { x: (pointX * cosY + lean * sinY + x) * near, y: (pointY * cosX + y) * near };
    }),
  );
  const [left, top] = [Math.min(...corners.map((c) => c.x)), Math.min(...corners.map((c) => c.y))];
  const canvas = CANVAS[layout];
  return {
    x: canvas.width / 2 + left,
    y: canvas.height / 2 + top,
    width: Math.max(...corners.map((c) => c.x)) - left,
    height: Math.max(...corners.map((c) => c.y)) - top,
  };
};

type GlassCardProps = CardMotion & {
  /** Frame the card starts to dim to a depth card, as in a growing stack. */
  dimFrom?: number;
  children: ReactNode;
};

/** Frames a card takes to dim, and how bright it ends. It stays opaque, so the cards under it never show through. */
const DIM_FRAMES = 30;
const DIM_BRIGHTNESS = 0.4;

/** Ruling Q27: a tilted glass card that rises on an overshooting spring, floats on a slow bob, and fades as it drifts away on the scene's last frames. */
export const GlassCard = ({ dimFrom, children, ...motion }: GlassCardProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { pose, variant = 'shot' } = motion;
  const look = LOOK[variant];
  const { x, y, turnY, turnX, opacity } = cardMotionAt(frame, fps, motion);
  const dim = dimFrom === undefined ? 0 : interpolate(frame, [dimFrom, dimFrom + DIM_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ perspective: PERSPECTIVE, justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          position: 'absolute',
          width: pose.width,
          height: pose.height,
          boxSizing: 'border-box',
          borderRadius: RADIUS,
          overflow: 'hidden',
          ...look.style,
          ...(dim > 0 ? { filter: `brightness(${1 - dim * (1 - DIM_BRIGHTNESS)})` } : undefined),
          opacity,
          transform: `translate(${x}px, ${y}px) rotateY(${turnY}deg) rotateX(${turnX}deg)`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

type ShotCardProps = Omit<GlassCardProps, 'children' | 'pose' | 'variant'> & { pose: CardPose; variant?: Exclude<CardVariant, 'panel'>; shot: Shot; path: CameraPath; callout?: Callout };

/** A captured shot or clip on a glass card, under its camera. */
export const ShotCard = ({ shot, path, callout, ...card }: ShotCardProps) => (
  <GlassCard {...card}>
    <FrameCamera durationInFrames={card.durationInFrames} shot={shot} path={path} callout={callout} size={cardSize(card.pose)} />
  </GlassCard>
);

/** A shot that fills its card and holds there. */
export const fullFrame: CameraPath = { from: { focusX: 0.5, focusY: 0.5, zoom: 1 }, to: { focusX: 0.5, focusY: 0.5, zoom: 1 } };
