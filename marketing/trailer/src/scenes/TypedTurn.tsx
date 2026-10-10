import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Layout, SceneProps } from '../layout';
import { ENTER_FRAMES, EXIT_FRAMES, SPRINGS, springIn, springOpacity } from '../motion';
import type { CameraPath } from '../parts/FrameCamera';
import { GlassCard, ShotCard } from '../parts/GlassCard';
import { TURN_CARDS } from '../poses';
import type { CopyRead } from '../reading';
import { panelFrameOf, shotFor, type LayoutShot } from '../shots';
import { colors, fonts, roleSize } from '../theme';
import { FRAMES_PER_CHAR, turnTimeline } from '../typing';

type TypedTurnProps = SceneProps & {
  /** The turn's clip: the game before the turn, the send, then the real narration revealing. */
  clip: LayoutShot;
  camera: Record<Layout, CameraPath>;
  /** The player line that types in on the panel. */
  prompt: string;
  /** A plain line under it that enters once the player line has typed in. */
  caption: string;
};

const CARET_BLINK_FRAMES = 20;

/** The frames the player line and the caption enter, are legible and leave in `layout`, for the reading check. The player line is legible from its last character. */
export const turnReads = (clip: LayoutShot, layout: Layout, prompt: string, caption: string, durationInFrames: number): CopyRead[] => {
  const panelFrame = panelFrameOf(shotFor(clip, layout));
  const { typeEnd, captionFrame } = turnTimeline(prompt, panelFrame);
  const exit = { until: durationInFrames - EXIT_FRAMES, end: durationInFrames };
  return [
    { text: prompt, start: panelFrame, from: Math.max(panelFrame + ENTER_FRAMES, typeEnd), ...exit },
    { text: caption, start: captionFrame, from: captionFrame + ENTER_FRAMES, ...exit },
  ];
};

/**
 * Ruling Q31: the turn's real narration reveal plays in the card, and the player line types in on a glass panel
 * below it, never over it. The panel enters as the clip shows its first narration word (ruling Q54).
 */
export const TypedTurn = ({ layout, durationInFrames, clip, camera, prompt, caption }: TypedTurnProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shot = shotFor(clip, layout);
  const panelFrame = panelFrameOf(shot);
  const { typeStart, typeEnd, captionFrame } = turnTimeline(prompt, panelFrame);
  const cards = TURN_CARDS[layout];
  const typedChars = Math.max(0, Math.min(prompt.length, Math.floor((frame - typeStart) / FRAMES_PER_CHAR)));
  const caretOn = frame < captionFrame && (frame < typeEnd || Math.floor(frame / CARET_BLINK_FRAMES) % 2 === 0);
  const captionIn = springIn(frame, fps, SPRINGS.pill, captionFrame, ENTER_FRAMES);

  return (
    <AbsoluteFill style={{ fontFamily: fonts.body }}>
      <ShotCard shot={shot} path={camera[layout]} pose={cards.clip} durationInFrames={durationInFrames} />
      <GlassCard pose={cards.panel} durationInFrames={durationInFrames} variant="panel" delay={panelFrame}>
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
