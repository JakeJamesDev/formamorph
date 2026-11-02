import type { CSSProperties } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { CANVAS, FPS, type Layout, type Rect } from '../layout';
import { ENTER_FRAMES, EXIT_FRAMES, SPRINGS, exitProgress, springIn, springOpacity, wordProgress } from '../motion';
import { scaledAbout, scaledBox, turnedBox, type TextTrack } from '../onScreen';
import type { CopyRead } from '../reading';
import { colors, fonts, glass, roleSize, type DotColor, type TypeRole } from '../theme';
import { measureText } from './measureText';

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

/** How far a leaving headline grows per layout, how far its words rise as a share of their size, and how far they turn. The tall headline fills the width, so it grows less. */
const HEADLINE_EXIT_GROWTH: Record<Layout, number> = { wide: 0.12, tall: 0.06 };
const WORD_RISE = 0.7;
const WORD_TURN = -4;

/** The headline at one moment: `out` is its exit, `progress(line, word)` a word's enter spring. */
const HeadlineBlock = ({ lines, layout, out, progress }: Pick<BlockProps, 'lines' | 'layout'> & { out: number; progress: (line: number, word: number, words: number) => number }) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: layout === 'tall' ? '0 72px' : '0 160px',
        fontFamily: fonts.body,
        opacity: out,
        transform: `scale(${1 + (1 - out) * HEADLINE_EXIT_GROWTH[layout]})`,
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
              const p = progress(lineIndex, i, words.length);
              return (
                <span
                  key={i}
                  data-text
                  style={{
                    display: 'inline-block',
                    opacity: springOpacity(p),
                    transform: `translateY(${(1 - p) * size * WORD_RISE}px) rotate(${(1 - p) * WORD_TURN}deg)`,
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

/** Ruling Q27: headline words rise one by one on springs with a slight tilt; the last word of the first line wears the wordmark gradient. */
export const Headline = ({ lines, layout, durationInFrames, delay = DEFAULT_DELAY }: BlockProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <HeadlineBlock
      lines={lines}
      layout={layout}
      out={exitProgress(frame, durationInFrames)}
      progress={(line, word, words) => wordProgress(frame, fps, lineDelay(delay, line), word, words)}
    />
  );
};

/** Each headline line's word boxes on every frame, for the on-screen check. */
export const headlineTracks = async ({ lines, layout, durationInFrames, delay = DEFAULT_DELAY }: BlockProps): Promise<TextTrack[]> => {
  const rest = await measureText(layout, <HeadlineBlock lines={lines} layout={layout} out={1} progress={() => 1} />);
  const canvas = CANVAS[layout];
  let next = 0;
  return lines.map((line, lineIndex) => {
    const words = line.split(' ');
    const boxes = rest.slice(next, (next += words.length));
    const size = roleSize(HEADLINE_LINES[lineIndex].role, layout);
    return {
      text: line,
      boxesAt: (frame) => {
        const out = exitProgress(frame, durationInFrames);
        return boxes.flatMap((box, i) => {
          const p = wordProgress(frame, FPS, lineDelay(delay, lineIndex), i, words.length);
          if (out * springOpacity(p) <= 0) return [];
          const turned = turnedBox({ ...box, y: box.y + (1 - p) * size * WORD_RISE }, (1 - p) * WORD_TURN);
          return [scaledAbout(turned, 1 + (1 - out) * HEADLINE_EXIT_GROWTH[layout], canvas.width / 2, canvas.height / 2)];
        });
      },
    };
  });
};

/** A pill column's look: its lines, where it sits, its dot (none without one) and the part of the first line drawn in the accent color. */
export type PillSpec = { lines: CopyLines; layout: Layout; place: CSSProperties; dot?: DotColor; accent?: string };

type PillsProps = Omit<BlockProps, 'layout'> & PillSpec & {
  /** The pills stay to the scene's last frame instead of leaving, as on the end card. */
  holdsToEnd?: boolean;
};

/** A line with its `accent` part, when it has one, in the accent color. */
const withAccent = (line: string, accent?: string) => {
  const at = accent ? line.indexOf(accent) : -1;
  if (!accent || at < 0) return line;
  return (
    <>
      {line.slice(0, at)}
      <span style={{ color: colors.accent }}>{accent}</span>
      {line.slice(at + accent.length)}
    </>
  );
};

/** How far pills rise as they enter, and as they leave. */
const PILL_RISE = 60;
const PILL_EXIT_LIFT = 90;
/** The share of its size a pill grows by as it enters. */
const PILL_GROWTH = 0.1;

/** The pill column at one moment: `out` is the column's exit, `progress(i)` line i's enter spring. */
export const PillColumn = ({ lines, layout, place, dot, accent, out, progress }: PillSpec & { out: number; progress: (index: number) => number }) => (
  <div
    style={{
      position: 'absolute',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      fontFamily: fonts.body,
      opacity: out,
      // Leaving pills rise clear of the next scene's pills, which come up from below.
      transform: `translateY(${(1 - out) * -PILL_EXIT_LIFT}px)`,
      ...place,
    }}
  >
    {lines.map((line, i) => {
      const p = progress(i);
      const style = PILL_LINES[i];
      const size = roleSize(style.role, layout);
      return (
        <p
          key={i}
          data-text
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
            transform: `translateY(${(1 - p) * PILL_RISE}px) scale(${1 - PILL_GROWTH + p * PILL_GROWTH})`,
          }}
        >
          {i === 0 && dot && <span style={{ flex: 'none', width: size * 0.26, height: size * 0.26, borderRadius: '50%', background: colors.dots[dot] }} />}
          {i === 0 ? withAccent(line, accent) : line}
        </p>
      );
    })}
  </div>
);

/** Ruling Q27: captions are glass pills with a colored dot. A second line is its own smaller pill under the first. */
export const Pills = ({ durationInFrames, delay = DEFAULT_DELAY, holdsToEnd = false, ...spec }: PillsProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = holdsToEnd ? 1 : exitProgress(frame, durationInFrames);
  return <PillColumn {...spec} out={out} progress={(i) => springIn(frame, fps, SPRINGS.pill, lineDelay(delay, i), ENTER_FRAMES)} />;
};

/** Where a pill column's pills sit on the canvas once they settle. */
export const measurePills = (spec: PillSpec): Promise<Rect[]> => measureText(spec.layout, <PillColumn {...spec} out={1} progress={() => 1} />);

/** A settled pill's box on a frame: `out` is its column's exit, `p` its enter spring. None while it cannot be seen. */
export const pillBoxesAt = (rest: Rect, out: number, p: number): Rect[] => {
  if (out * springOpacity(p) <= 0) return [];
  const box = scaledBox(rest, 1 - PILL_GROWTH + p * PILL_GROWTH);
  return [{ ...box, y: box.y + (1 - p) * PILL_RISE - (1 - out) * PILL_EXIT_LIFT }];
};

/** Each pill's box on every frame, for the on-screen check. */
export const pillTracks = async ({ durationInFrames, delay = DEFAULT_DELAY, ...spec }: Omit<PillsProps, 'holdsToEnd'>): Promise<TextTrack[]> => {
  const rest = await measurePills(spec);
  return spec.lines.map((text, i) => ({
    text,
    boxesAt: (frame) => pillBoxesAt(rest[i], exitProgress(frame, durationInFrames), springIn(frame, FPS, SPRINGS.pill, lineDelay(delay, i), ENTER_FRAMES)),
  }));
};
