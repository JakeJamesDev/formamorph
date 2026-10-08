import type { CSSProperties } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Layout } from '../layout';
import { enterProgress, exitProgress } from '../motion';
import { colors, fonts, roleSize, shade, type TypeRole } from '../theme';

/** One or two lines of copy. The first is the point; the second supports it. */
export type CopyLines = readonly [string] | readonly [string, string];

/** `headline` fills a scene; `caption` sits low over a shot; `pane` sits low in half a stacked scene. */
export type CopyVariant = 'headline' | 'caption' | 'pane';

type LineStyle = { role: TypeRole; weight: number; color: string };

const LINES: Record<CopyVariant, [LineStyle, LineStyle]> = {
  headline: [
    { role: 'display', weight: 500, color: colors.foreground },
    { role: 'body', weight: 300, color: colors.muted },
  ],
  caption: [
    { role: 'body', weight: 500, color: colors.foreground },
    { role: 'helper', weight: 400, color: colors.muted },
  ],
  pane: [
    { role: 'body', weight: 500, color: colors.foreground },
    { role: 'helper', weight: 400, color: colors.muted },
  ],
};

const PLACEMENT: Record<CopyVariant, Record<Layout, CSSProperties>> = {
  headline: {
    wide: { left: 160, right: 160, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left' },
    tall: { left: 96, right: 96, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', textAlign: 'center' },
  },
  caption: {
    wide: { left: 120, right: 520, bottom: 96, justifyContent: 'flex-end', alignItems: 'flex-start', textAlign: 'left' },
    tall: { left: 72, right: 72, bottom: 200, justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center' },
  },
  pane: {
    wide: { left: 56, right: 56, bottom: 72, justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center' },
    tall: { left: 56, right: 56, bottom: 56, justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center' },
  },
};

const SCRIM: Record<Layout, string> = {
  wide: `linear-gradient(0deg, ${shade(0.9)} 0, ${shade(0.55)} 20%, transparent 42%)`,
  tall: `linear-gradient(0deg, ${shade(0.92)} 0, ${shade(0.6)} 22%, transparent 46%)`,
};

const LINE_STAGGER_FRAMES = 10;

type CopyBlockProps = {
  lines: CopyLines;
  layout: Layout;
  durationInFrames: number;
  variant: CopyVariant;
  /** Frame the first line starts to enter. */
  delay?: number;
};

/** Copy that enters line by line, holds, and leaves on the scene's last frames. */
export const CopyBlock = ({ lines, layout, durationInFrames, variant, delay = 10 }: CopyBlockProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exitProgress(frame, durationInFrames);

  return (
    <>
      {variant !== 'headline' && (
        <AbsoluteFill style={{ background: SCRIM[layout], opacity: enterProgress(frame, fps, delay) * out }} />
      )}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          gap: roleSize('body', layout) * 0.3,
          fontFamily: fonts.body,
          opacity: out,
          transform: `translateY(${(1 - out) * -24}px)`,
          ...PLACEMENT[variant][layout],
        }}
      >
        {lines.map((line, i) => {
          const style = LINES[variant][i];
          const p = enterProgress(frame, fps, delay + i * LINE_STAGGER_FRAMES);
          return (
            <p
              key={i}
              style={{
                margin: 0,
                fontSize: roleSize(style.role, layout),
                fontWeight: style.weight,
                color: style.color,
                lineHeight: 1.15,
                letterSpacing: style.role === 'display' ? '-0.015em' : 0,
                textWrap: 'balance',
                opacity: p,
                transform: `translateY(${(1 - p) * 36}px)`,
              }}
            >
              {line}
            </p>
          );
        })}
      </div>
    </>
  );
};
