import { colors, fonts } from '../theme';

// "Forma" holds one weight; "morph" steps heavier per letter, as on the build-assets title card.
const MORPH_WEIGHTS = [500, 575, 650, 725, 800];

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

/** "Formamorph" in the title card's type: a steady first half and a gradient second half that grows heavier. Needs `WordmarkFilter` in the same scene. */
export const Wordmark = ({ fontSize, progress }: { fontSize: number; progress: number }) => (
  <h1
    style={{
      margin: 0,
      fontFamily: fonts.wordmark,
      fontSize,
      letterSpacing: '-.06em',
      lineHeight: 0.9,
      whiteSpace: 'nowrap',
      filter: 'url(#goo)',
      opacity: progress,
      transform: `translateY(${(1 - progress) * 40}px)`,
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
);
