import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { Layout } from '../layout';
import { ENTER_FRAMES, SPRINGS, springIn, springOpacity } from '../motion';
import type { CopyRead } from '../reading';
import { panelFrameOf, type Shot } from '../shots';
import { colors, fonts, roleSize } from '../theme';
import { FRAMES_PER_CHAR, turnTimeline } from '../typing';
import { GlassCard, type CardPose } from './GlassCard';

/** The frames the player line and the caption enter, are legible and leave, for a turn card's clip. The player line is legible from its last character. */
export const turnReads = (clip: Shot, prompt: string, caption: string, until: number, end: number): CopyRead[] => {
  const panelFrame = panelFrameOf(clip);
  const { typeEnd, captionFrame } = turnTimeline(prompt, panelFrame);
  return [
    { text: prompt, start: panelFrame, from: Math.max(panelFrame + ENTER_FRAMES, typeEnd), until, end },
    { text: caption, start: captionFrame, from: captionFrame + ENTER_FRAMES, until, end },
  ];
};

type TypedPanelProps = {
  layout: Layout;
  /** The turn's clip: the panel enters as it shows its first narration word (ruling Q54). */
  clip: Shot;
  pose: CardPose;
  padding: number;
  /** The player line that types in. */
  prompt: string;
  /** A plain line under it that enters once the player line has typed in. */
  caption: string;
  durationInFrames: number;
  /** Frame the panel starts to dim with its card. */
  dimFrom?: number;
};

const CARET_BLINK_FRAMES = 20;

/** Ruling Q31: the player line types in on a glass panel below the turn's clip card, never over it. */
export const TypedPanel = ({ layout, clip, pose, padding, prompt, caption, durationInFrames, dimFrom }: TypedPanelProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const panelFrame = panelFrameOf(clip);
  const { typeStart, typeEnd, captionFrame } = turnTimeline(prompt, panelFrame);
  const typedChars = Math.max(0, Math.min(prompt.length, Math.floor((frame - typeStart) / FRAMES_PER_CHAR)));
  const caretOn = frame < captionFrame && (frame < typeEnd || Math.floor(frame / CARET_BLINK_FRAMES) % 2 === 0);
  const captionIn = springIn(frame, fps, SPRINGS.pill, captionFrame, ENTER_FRAMES);

  return (
    <GlassCard pose={pose} durationInFrames={durationInFrames} variant="panel" delay={panelFrame} dimFrom={dimFrom}>
      <div style={{ padding, color: colors.foreground, fontFamily: fonts.body }}>
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
  );
};
