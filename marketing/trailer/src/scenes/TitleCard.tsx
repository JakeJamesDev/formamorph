import type { CSSProperties } from 'react';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Layout, SceneProps } from '../layout';
import { SHOTS } from '../shots';
import { colors, fonts, shade } from '../theme';

// "Forma" holds one weight; "morph" steps heavier per letter, as on the build-assets title card.
const MORPH_WEIGHTS = [500, 575, 650, 725, 800];

type Placement = {
  /** Where the game shot fades in over the library shot. */
  seam: string;
  overlay: string;
  mark: CSSProperties;
  fontSize: number;
  tagSize: number;
  /** The underline beneath the wordmark; the tall layout has none. */
  rule: { left: number; bottom: number; width: number } | null;
};

const PLACEMENT: Record<Layout, Placement> = {
  wide: {
    seam: 'linear-gradient(100deg, transparent 44%, #000 56%)',
    overlay: `linear-gradient(90deg, ${shade(0.96)} 0, ${shade(0.82)} 22%, ${shade(0.25)} 48%, ${shade(0.55)} 100%), linear-gradient(0deg, ${shade(0.95)} 0, ${shade(0)} 45%)`,
    mark: { left: 110, bottom: 96, textAlign: 'left' },
    fontSize: 132,
    tagSize: 22,
    rule: { left: 116, bottom: 74, width: 620 },
  },
  tall: {
    seam: 'linear-gradient(180deg, transparent 40%, #000 60%)',
    overlay: `linear-gradient(0deg, ${shade(0.97)} 0, ${shade(0.85)} 32%, ${shade(0.3)} 62%, ${shade(0.6)} 100%)`,
    mark: { left: 0, right: 0, bottom: 520, textAlign: 'center' },
    fontSize: 150,
    tagSize: 26,
    rule: null,
  },
};

const cover: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };

/** The opening card: two app shots stitched behind the wordmark on the dark stage. */
export const TitleCard = ({ layout, durationInFrames }: SceneProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const place = PLACEMENT[layout];

  const drift = interpolate(frame, [0, durationInFrames], [1.08, 1], { extrapolateRight: 'clamp' });
  const rise = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const mark = rise(12);
  const tag = rise(40);
  const rule = rise(52);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.stage, fontFamily: fonts.body, color: colors.foreground }}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b" />
            <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11" />
          </filter>
        </defs>
      </svg>

      <AbsoluteFill style={{ transform: `scale(${drift})`, filter: 'saturate(.85) brightness(.9)' }}>
        <Img src={SHOTS.library.src} style={cover} />
        <Img src={SHOTS.game.src} style={{ ...cover, maskImage: place.seam, WebkitMaskImage: place.seam }} />
      </AbsoluteFill>

      <AbsoluteFill style={{ background: place.overlay }} />

      <div style={{ position: 'absolute', ...place.mark }}>
        <h1
          style={{
            margin: 0,
            fontFamily: fonts.wordmark,
            fontSize: place.fontSize,
            letterSpacing: '-.06em',
            lineHeight: 0.9,
            whiteSpace: 'nowrap',
            filter: 'url(#goo)',
            opacity: mark,
            transform: `translateY(${(1 - mark) * 40}px)`,
          }}
        >
          <span style={{ fontWeight: 500 }}>Forma</span>
          <span style={{ backgroundImage: colors.wordmarkGradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            {'morph'.split('').map((letter, i) => (
              <span key={letter} style={{ fontWeight: MORPH_WEIGHTS[i] }}>
                {letter}
              </span>
            ))}
          </span>
        </h1>
        <p
          style={{
            margin: '20px 0 0 6px',
            fontSize: place.tagSize,
            fontWeight: 300,
            letterSpacing: '.3em',
            textTransform: 'uppercase',
            color: colors.muted,
            opacity: tag,
          }}
        >
          AI text roleplay
        </p>
      </div>

      {place.rule && (
        <div
          style={{
            position: 'absolute',
            left: place.rule.left,
            bottom: place.rule.bottom,
            width: place.rule.width * rule,
            height: 2,
            background: `linear-gradient(90deg, ${colors.foreground}, transparent)`,
            opacity: 0.5,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
