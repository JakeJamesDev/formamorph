import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { Layout, SceneProps } from '../layout';
import { ENTER_FRAMES, EXIT_FRAMES, enterProgress, exitProgress } from '../motion';
import type { CopyRead } from '../reading';
import { FrameCamera, type CameraPath } from '../parts/FrameCamera';
import { shotFor, type LayoutShot } from '../shots';
import { colors, fonts, roleSize, shade } from '../theme';

/** A captured shot behind the text: `before` until the narration starts, then `after`, under one camera path. */
export type TypedBackdrop = { before: LayoutShot; after: LayoutShot; camera: Record<Layout, CameraPath> };

type TypedNarrationProps = SceneProps & {
  /** The player line that types in. An empty string leaves it out, and the narration streams in alone. */
  prompt: string;
  /** The narration that streams in word by word after it. */
  narration: string;
  backdrop?: TypedBackdrop;
};

const TYPE_START_FRAME = 24;
const FRAMES_PER_CHAR = 2;
const PAUSE_FRAMES = 24;
/** Without a player line, the narration starts while the panel enters. */
const NARRATION_LEAD_FRAMES = 4;
const FRAMES_PER_WORD = 5;
const WORD_FADE_FRAMES = 10;
const CARET_BLINK_FRAMES = 20;
const MIN_HOLD_FRAMES = 30;

/** Frames at which each part of the scene starts and ends. */
export const typedTimeline = (prompt: string, narration: string) => {
  const words = narration.split(/\s+/).filter(Boolean);
  const typeEnd = TYPE_START_FRAME + prompt.length * FRAMES_PER_CHAR;
  const narrationStart = prompt === '' ? NARRATION_LEAD_FRAMES : typeEnd + PAUSE_FRAMES;
  const narrationEnd = narrationStart + words.length * FRAMES_PER_WORD + WORD_FADE_FRAMES;
  return { words, typeEnd, narrationStart, narrationEnd };
};

/**
 * The frames the player line and the narration enter, are legible and leave, for the reading check. Each is legible
 * from its last character landing. The player line, and a narration with no player line, enter with the panel.
 */
export const typedReads = (prompt: string, narration: string, durationInFrames: number): CopyRead[] => {
  const { typeEnd, narrationStart, narrationEnd } = typedTimeline(prompt, narration);
  const exit = { until: durationInFrames - EXIT_FRAMES, end: durationInFrames };
  const narrationRead = { text: narration, start: prompt === '' ? 0 : narrationStart, from: Math.max(ENTER_FRAMES, narrationEnd), ...exit };
  return prompt === '' ? [narrationRead] : [{ text: prompt, start: 0, from: Math.max(ENTER_FRAMES, typeEnd), ...exit }, narrationRead];
};

const PANEL: Record<Layout, { width: number; bottom: number; padding: number }> = {
  wide: { width: 1240, bottom: 110, padding: 64 },
  tall: { width: 888, bottom: 260, padding: 56 },
};

/** A player line types in, then the narration streams in word by word, as a stylized overlay on the dark stage or a shot. */
export const TypedNarration = ({ layout, durationInFrames, prompt, narration, backdrop }: TypedNarrationProps) => {
  const frame = useCurrentFrame();
  const hasPrompt = prompt !== '';
  const { words, typeEnd, narrationStart, narrationEnd } = typedTimeline(prompt, narration);
  if (narrationEnd + MIN_HOLD_FRAMES + EXIT_FRAMES > durationInFrames) {
    throw new Error(`TypedNarration needs ${narrationEnd + MIN_HOLD_FRAMES + EXIT_FRAMES} frames; the scene has ${durationInFrames}.`);
  }

  const exit = exitProgress(frame, durationInFrames);
  const panelIn = enterProgress(frame, 0);
  const typedChars = Math.max(0, Math.min(prompt.length, Math.floor((frame - TYPE_START_FRAME) / FRAMES_PER_CHAR)));
  const caretOn = frame < narrationStart && (frame < typeEnd || Math.floor(frame / CARET_BLINK_FRAMES) % 2 === 0);
  const afterOpacity = interpolate(frame, [narrationStart - 6, narrationStart + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const panel = PANEL[layout];
  const cameraProps = { layout, durationInFrames };

  return (
    <AbsoluteFill style={{ backgroundColor: colors.stage }}>
      {backdrop && (
        <>
          <FrameCamera {...cameraProps} shot={shotFor(backdrop.before, layout)} path={backdrop.camera[layout]} />
          <AbsoluteFill style={{ opacity: afterOpacity }}>
            <FrameCamera {...cameraProps} shot={shotFor(backdrop.after, layout)} path={backdrop.camera[layout]} />
          </AbsoluteFill>
          <AbsoluteFill style={{ background: shade(0.5) }} />
        </>
      )}
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: backdrop ? 'flex-end' : 'center',
          paddingBottom: backdrop ? panel.bottom : 0,
          fontFamily: fonts.body,
          opacity: exit * panelIn,
          transform: `translateY(${(1 - panelIn) * 32 + (1 - exit) * -24}px)`,
        }}
      >
        <div
          style={{
            width: panel.width,
            boxSizing: 'border-box',
            padding: panel.padding,
            borderRadius: 32,
            border: `2px solid ${colors.border}`,
            background: colors.panel,
            backdropFilter: 'blur(18px)',
            color: colors.foreground,
          }}
        >
          {hasPrompt && (
            <p
              style={{
                margin: 0,
                fontSize: roleSize('title', layout),
                fontWeight: 500,
                lineHeight: 1.2,
              }}
            >
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
          )}
          <p
            style={{
              margin: hasPrompt ? `${roleSize('body', layout) * 0.6}px 0 0` : 0,
              fontSize: roleSize('body', layout),
              fontWeight: 300,
              lineHeight: 1.35,
              color: colors.foreground,
            }}
          >
            {words.map((word, i) => {
              const start = narrationStart + i * FRAMES_PER_WORD;
              const shown = interpolate(frame, [start, start + WORD_FADE_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              return (
                <span key={i} style={{ display: 'inline-block', marginRight: '0.28em', opacity: shown, transform: `translateY(${(1 - shown) * 12}px)` }}>
                  {word}
                </span>
              );
            })}
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
