import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Layout, SceneProps } from '../layout';
import { ENTER_FRAMES, EXIT_FRAMES, SPRINGS, springIn, springOpacity } from '../motion';
import type { CameraPath } from '../parts/FrameCamera';
import { GlassCard, ShotCard } from '../parts/GlassCard';
import { TURN_CARDS } from '../poses';
import type { CopyRead } from '../reading';
import { shotFor, type LayoutShot } from '../shots';
import { colors, fonts, roleSize } from '../theme';
import { FRAMES_PER_CHAR, TYPE_START_FRAME, turnTimeline } from '../typing';

type TypedTurnProps = SceneProps & {
  /** The turn's clip: the game before the turn, then the real narration revealing. It starts to play on `revealFrame`. */
  clip: LayoutShot;
  camera: Record<Layout, CameraPath>;
  /** The player line that types in on the panel. */
  prompt: string;
  /** A plain line under it that enters as the reveal starts. */
  caption: string;
};

const CARET_BLINK_FRAMES = 20;

/** The frames the player line and the caption enter, are legible and leave, for the reading check. The player line is legible from its last character. */
export const turnReads = (prompt: string, caption: string, durationInFrames: number): CopyRead[] => {
  const { typeEnd, revealFrame } = turnTimeline(prompt);
  const exit = { until: durationInFrames - EXIT_FRAMES, end: durationInFrames };
  return [
    { text: prompt, start: 0, from: Math.max(ENTER_FRAMES, typeEnd), ...exit },
    { text: caption, start: revealFrame, from: revealFrame + ENTER_FRAMES, ...exit },
  ];
};

/** Ruling Q31: the turn's real narration reveal plays in the card, and the player line types in on a glass panel below it, never over it. */
export const TypedTurn = ({ layout, durationInFrames, clip, camera, prompt, caption }: TypedTurnProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { typeEnd, revealFrame } = turnTimeline(prompt);
  const cards = TURN_CARDS[layout];
  const typedChars = Math.max(0, Math.min(prompt.length, Math.floor((frame - TYPE_START_FRAME) / FRAMES_PER_CHAR)));
  const caretOn = frame < revealFrame && (frame < typeEnd || Math.floor(frame / CARET_BLINK_FRAMES) % 2 === 0);
  const captionIn = springIn(frame, fps, SPRINGS.pill, revealFrame, ENTER_FRAMES);
  const shot = shotFor(clip, layout);
  if (shot.clipFrom !== revealFrame) throw new Error(`The turn clip must start on frame ${revealFrame}, the reveal; it starts on ${shot.clipFrom}.`);

  return (
    <AbsoluteFill style={{ fontFamily: fonts.body }}>
      <ShotCard shot={shot} path={camera[layout]} pose={cards.clip} durationInFrames={durationInFrames} />
      <GlassCard pose={cards.panel} durationInFrames={durationInFrames} variant="panel" delay={6}>
        <div style={{ padding: cards.padding, color: colors.foreground }}>
          <p style={{ margin: 0, fontSize: roleSize('title', layout), fontWeight: 500, lineHeight: 1.2 }}>
            {prompt.slice(0, typedChars)}
            <span
              style={{
                display: 'inline-block',
                width: '0.07em',
                height: '1em',
                marginLeft: '0.06em',
                verticalAlign: '-0.12em',
                background: colors.accent,
                opacity: caretOn ? 1 : 0,
              }}
            />
            {/* The untyped rest holds its space, so the line never reflows while it types. */}
            <span style={{ opacity: 0 }}>{prompt.slice(typedChars)}</span>
          </p>
          <p
            style={{
              margin: `${roleSize('body', layout) * 0.5}px 0 0`,
              fontSize: roleSize('body', layout),
              fontWeight: 300,
              lineHeight: 1.3,
              color: colors.muted,
              opacity: springOpacity(captionIn),
              transform: `translateY(${(1 - captionIn) * 24}px)`,
            }}
          >
            {caption}
          </p>
        </div>
      </GlassCard>
    </AbsoluteFill>
  );
};
