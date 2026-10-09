import type { CSSProperties } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Layout } from '../layout';
import { ENTER_FRAMES, EXIT_FRAMES, SPRINGS, exitProgress, springIn, springOpacity, wordProgress } from '../motion';
import type { CopyRead } from '../reading';
import { colors, fonts, glass, roleSize, type DotColor, type TypeRole } from '../theme';

/** One or two lines of copy. The first is the point; the second supports it. */
export type CopyLines = readonly [string] | readonly [string, string];

const LINE_STAGGER_FRAMES = 10;
/** Frame a copy block's first line starts to enter, unless the scene sets its own. */
export const DEFAULT_DELAY = 10;

/** Frame line `index` of a block starts to enter. */
const lineDelay = (delay: number, index: number) => delay + index * LINE_STAGGER_FRAMES;

/** The frames each line of a copy block enters, is legible and leaves, for the reading check. */
export const copyReads = (lines: CopyLines, durationInFrames: number, delay = DEFAULT_DELAY): CopyRead[] =>
  lines.map((text, i) => {
    const start = lineDelay(delay, i);
    return { text, start, from: start + ENTER_FRAMES, until: durationInFrames - EXIT_FRAMES, end: durationInFrames };
  });

type BlockProps = {
  lines: CopyLines;
  layout: Layout;
  durationInFrames: number;
  /** Frame the first line starts to enter. */
  delay?: number;
};

/** How one line of a block looks: the first is the point, the second supports it. */
type LineStyle = { role: TypeRole; weight: number; color: string };

const HEADLINE_LINES: readonly [LineStyle, LineStyle] = [
  { role: 'display', weight: 500, color: colors.foreground },
  { role: 'body', weight: 300, color: colors.muted },
];

const PILL_LINES: readonly [LineStyle, LineStyle] = [
  { role: 'helper', weight: 500, color: colors.foreground },
  { role: 'meta', weight: 400, color: colors.muted },
];

/** The wordmark gradient, clipped to a word's letters. */
const gradientText: CSSProperties = { backgroundImage: colors.wordmarkGradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };

/** Ruling Q27: headline words rise one by one on springs with a slight tilt; the last word of the first line wears the wordmark gradient. */
export const Headline = ({ lines, layout, durationInFrames, delay = DEFAULT_DELAY }: BlockProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exitProgress(frame, durationInFrames);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: layout === 'tall' ? '0 72px' : '0 160px',
        fontFamily: fonts.body,
        opacity: out,
        transform: `scale(${1 + (1 - out) * 0.12})`,
      }}
    >
      {lines.map((line, lineIndex) => {
        const words = line.split(' ');
        const style = HEADLINE_LINES[lineIndex];
        const size = roleSize(style.role, layout);
        return (
          <p
            key={lineIndex}
            style={{
              margin: lineIndex === 0 ? 0 : `${size * 0.6}px 0 0`,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              columnGap: size * 0.28,
              fontSize: size,
              fontWeight: style.weight,
              letterSpacing: style.role === 'display' ? '-0.02em' : 0,
              lineHeight: 1.15,
              color: style.color,
            }}
          >
            {words.map((word, i) => {
              const p = wordProgress(frame, fps, lineDelay(delay, lineIndex), i, words.length);
              return (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    opacity: springOpacity(p),
                    transform: `translateY(${(1 - p) * size * 0.7}px) rotate(${(1 - p) * -4}deg)`,
                    ...(lineIndex === 0 && i === words.length - 1 ? gradientText : undefined),
                  }}
                >
                  {word}
                </span>
              );
            })}
          </p>
        );
      })}
    </AbsoluteFill>
  );
};

type PillsProps = BlockProps & {
  /** Where the pill column sits on the canvas. */
  place: CSSProperties;
  dot: DotColor;
  /** The pills stay to the scene's last frame instead of leaving, as on the end card. */
  holdsToEnd?: boolean;
};

/** Ruling Q27: captions are glass pills with a colored dot. A second line is its own smaller pill under the first. */
export const Pills = ({ lines, layout, durationInFrames, delay = DEFAULT_DELAY, place, dot, holdsToEnd = false }: PillsProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = holdsToEnd ? 1 : exitProgress(frame, durationInFrames);

  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        fontFamily: fonts.body,
        opacity: out,
        // Leaving pills rise clear of the next scene's pills, which come up from below.
        transform: `translateY(${(1 - out) * -90}px)`,
        ...place,
      }}
    >
      {lines.map((line, i) => {
        const p = springIn(frame, fps, SPRINGS.pill, lineDelay(delay, i), ENTER_FRAMES);
        const style = PILL_LINES[i];
        const size = roleSize(style.role, layout);
        return (
          <p
            key={i}
            style={{
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: size * 0.34,
              fontSize: size,
              fontWeight: style.weight,
              lineHeight: 1.2,
              textWrap: 'balance',
              color: style.color,
              background: glass.pill,
              border: glass.border,
              backdropFilter: 'blur(20px)',
              padding: `${size * 0.48}px ${size * 0.8}px`,
              borderRadius: 999,
              boxShadow: glass.pillShadow,
              opacity: springOpacity(p),
              transform: `translateY(${(1 - p) * 60}px) scale(${0.9 + p * 0.1})`,
            }}
          >
            {i === 0 && <span style={{ flex: 'none', width: size * 0.26, height: size * 0.26, borderRadius: '50%', background: colors.dots[dot] }} />}
            {line}
          </p>
        );
      })}
    </div>
  );
};
