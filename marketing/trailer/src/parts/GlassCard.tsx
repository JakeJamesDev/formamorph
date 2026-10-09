import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Size } from '../layout';
import { ENTER_FRAMES, SPRINGS, bob, exitProgress, springIn } from '../motion';
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

/** How far a card drifts while it fades out, in pixels. */
const EXIT_DRIFT = { x: -60, y: -40 };
const RADIUS = 28;

type GlassCardProps = {
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
  children: ReactNode;
};

/** Ruling Q27: a tilted glass card that rises on an overshooting spring, floats on a slow bob, and fades as it drifts away on the scene's last frames. */
export const GlassCard = ({ pose, durationInFrames, variant = 'shot', delay = 0, bobPhase = 0, holdsToEnd = false, children }: GlassCardProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const look = LOOK[variant];
  const enter = look.settle ? springIn(frame, fps, SPRINGS.card, delay, look.settle) : spring({ frame: frame - delay, fps, config: SPRINGS.card });
  const out = holdsToEnd ? 1 : exitProgress(frame, durationInFrames);
  const tilt = interpolate(frame, [0, durationInFrames - 1], pose.tilt, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const x = pose.x + (1 - enter) * look.slide + (1 - out) * EXIT_DRIFT.x;
  const y = pose.y + (1 - enter) * look.rise + bob(frame, bobPhase) * look.bob + (1 - out) * EXIT_DRIFT.y;

  return (
    <AbsoluteFill style={{ perspective: 2200, justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          position: 'absolute',
          width: pose.width,
          height: pose.height,
          boxSizing: 'border-box',
          borderRadius: RADIUS,
          overflow: 'hidden',
          ...look.style,
          opacity: Math.min(1, enter * 1.6) * out * look.opacity,
          transform: `translate(${x}px, ${y}px) rotateY(${tilt}deg) rotateX(${pose.lean + (1 - enter) * 10}deg)`,
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
