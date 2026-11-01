import { useCurrentFrame, useVideoConfig } from 'remotion';
import { FPS, type Layout } from '../layout';
import { ENTER_FRAMES, SPRINGS, springIn, springOpacity } from '../motion';
import type { TextTrack } from '../onScreen';
import type { CopyRead } from '../reading';
import { panelFrameOf, type Shot } from '../shots';
import { colors, fonts, roleSize } from '../theme';
import { FRAMES_PER_CHAR, turnTimeline } from '../typing';
import { GlassCard, cardBoxAt, cardMotionAt, type CardPose } from './GlassCard';
import { measureText } from './measureText';

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

/** The chars of the player line typed by a frame. */
const typedCharsAt = (frame: number, prompt: string, typeStart: number) => Math.max(0, Math.min(prompt.length, Math.floor((frame - typeStart) / FRAMES_PER_CHAR)));

type PanelCopyProps = Pick<TypedPanelProps, 'layout' | 'padding' | 'prompt' | 'caption'> & { typedChars: number; caretOn: boolean; captionIn: number };

/** The panel's text at one moment. */
const PanelCopy = ({ layout, padding, prompt, caption, typedChars, caretOn, captionIn }: PanelCopyProps) => (
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
);

/** What the card's one-pixel border takes from its text's width and height. */
const BORDER_SPAN = 2;

/** The panel's box on every frame that shows its text, and what the panel cuts off of it, for the on-screen check. */
export const panelTrack = async ({ layout, clip, pose, padding, prompt, caption, durationInFrames }: TypedPanelProps): Promise<TextTrack> => {
  const [text] = await measureText(
    layout,
    <div data-text style={{ width: pose.width - BORDER_SPAN }}>
      <PanelCopy layout={layout} padding={padding} prompt={prompt} caption={caption} typedChars={prompt.length} caretOn captionIn={1} />
    </div>,
  );
  const panelFrame = panelFrameOf(clip);
  const { typeStart } = turnTimeline(prompt, panelFrame);
  const motion = { pose, durationInFrames, variant: 'panel', delay: panelFrame } as const;
  return {
    text: prompt,
    // The panel may trim its bottom padding, never the text.
    clipped: Math.max(0, Math.ceil(text.height - padding - (pose.height - BORDER_SPAN))),
    boxesAt: (frame) => {
      const at = cardMotionAt(frame, FPS, motion);
      return typedCharsAt(frame, prompt, typeStart) > 0 && at.opacity > 0 ? [cardBoxAt(layout, pose, at)] : [];
    },
  };
};

/** Ruling Q31: the player line types in on a glass panel below the turn's clip card, never over it. */
export const TypedPanel = ({ layout, clip, pose, padding, prompt, caption, durationInFrames, dimFrom }: TypedPanelProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const panelFrame = panelFrameOf(clip);
  const { typeStart, typeEnd, captionFrame } = turnTimeline(prompt, panelFrame);
  const typedChars = typedCharsAt(frame, prompt, typeStart);
  const caretOn = frame < captionFrame && (frame < typeEnd || Math.floor(frame / CARET_BLINK_FRAMES) % 2 === 0);
  const captionIn = springIn(frame, fps, SPRINGS.pill, captionFrame, ENTER_FRAMES);

  return (
    <GlassCard pose={pose} durationInFrames={durationInFrames} variant="panel" delay={panelFrame} dimFrom={dimFrom}>
      <PanelCopy layout={layout} padding={padding} prompt={prompt} caption={caption} typedChars={typedChars} caretOn={caretOn} captionIn={captionIn} />
    </GlassCard>
  );
};
