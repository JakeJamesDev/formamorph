import type { CSSProperties } from 'react';
import { colors, fonts } from '../theme';

// "Forma" holds one weight; "morph" steps heavier per letter, as on the build-assets title card.
const MORPH_WEIGHTS = [500, 575, 650, 725, 800];
const FORMA = 'Forma';

/** The SVG filter the wordmark's letters merge through. Mount once per scene that shows a wordmark. */
export const WordmarkFilter = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <defs>
      <filter id="goo">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b" />
        <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11" />
      </filter>
    </defs>
  </svg>
);

/** The pop's beats: F, o, r, m, a one at a time, then "morph" as one unit (ruling Q59). */
export const POP_BEATS = FORMA.length + 1;
/** Frames one beat takes: quick enough to read as a pop, not a bounce. */
export const POP_BEAT_FRAMES = 12;
/** How far a glyph grows at its beat's peak. "morph" grows a little more than one letter. */
const POP_GROWTH = { letter: 0.18, morph: 0.22 };

/** The scale of each pop beat's glyph on `frame`, for a pop that starts on `from`. Each grows and shrinks back inside its own beat, so every glyph settles at 1. */
export const popScales = (frame: number, from: number): number[] =>
  Array.from({ length: POP_BEATS }, (_, beat) => {
    const t = (frame - from - beat * POP_BEAT_FRAMES) / POP_BEAT_FRAMES;
    if (t <= 0 || t >= 1) return 1;
    // A fast rise and a slower fall, with no dip under 1.
    const bump = Math.sin(Math.PI * Math.pow(t, 0.7));
    return 1 + bump * (beat < FORMA.length ? POP_GROWTH.letter : POP_GROWTH.morph);
  });

/** A glyph that scales about its own center, so the word around it never shifts. 55% is the letters' visual middle, below the line box's. */
const popped = (scale: number): CSSProperties => ({ display: 'inline-block', transform: `scale(${scale})`, transformOrigin: '50% 55%' });

/**
 * "Formamorph" in the title card's type: a steady first half and a gradient second half that grows heavier.
 * `pop` scales each pop beat's glyph (see `popScales`). Needs `WordmarkFilter` in the same scene.
 */
export const Wordmark = ({ fontSize, progress, pop }: { fontSize: number; progress: number; pop?: readonly number[] }) => (
  <h1
    style={{
      margin: 0,
      fontFamily: fonts.wordmark,
      fontSize,
      letterSpacing: '-.06em',
      lineHeight: 0.9,
      whiteSpace: 'nowrap',
      color: colors.foreground,
      filter: 'url(#goo)',
      opacity: progress,
      transform: `translateY(${(1 - progress) * 40}px)`,
    }}
  >
    {FORMA.split('').map((letter, i) => (
      <span key={i} style={{ fontWeight: 500, ...popped(pop?.[i] ?? 1) }}>
        {letter}
      </span>
    ))}
    <span
      style={{
        backgroundImage: colors.wordmarkGradient,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        ...popped(pop?.[FORMA.length] ?? 1),
      }}
    >
      {'morph'.split('').map((letter, i) => (
        <span key={i} style={{ fontWeight: MORPH_WEIGHTS[i] }}>
          {letter}
        </span>
      ))}
    </span>
  </h1>
);
