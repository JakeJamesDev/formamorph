import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Layout, SceneProps } from '../layout';
import { ENTER_FRAMES, SPRINGS, springIn, springOpacity } from '../motion';
import { TITLE_CARDS } from '../poses';
import { Pills } from '../parts/CopyBlock';
import { ShotCard, fullFrame } from '../parts/GlassCard';
import { Wordmark, WordmarkFilter } from '../parts/Wordmark';
import type { CopyRead } from '../reading';
import { SHOTS } from '../shots';
import { colors, fonts } from '../theme';

type Placement = {
  /** How far the wordmark block sits above the canvas center. */
  lift: number;
  fontSize: number;
  tagSize: number;
};

const PLACEMENT: Record<Layout, Placement> = {
  wide: { lift: 20, fontSize: 200, tagSize: 26 },
  tall: { lift: 0, fontSize: 170, tagSize: 28 },
};

const TAGLINE = 'AI text RPG';
/** Frames each part starts to rise. */
const RISE = { cards: 0, mark: 12, tag: 40, cta: 80 };

/** The frames the tagline and the call-to-action line enter and are legible, for the reading check. Both hold to the card's last frame. */
export const titleReads = (durationInFrames: number, cta?: string): CopyRead[] =>
  [
    { text: TAGLINE, start: RISE.tag },
    ...(cta ? [{ text: cta, start: RISE.cta }] : []),
  ].map(({ text, start }) => ({ text, start, from: start + ENTER_FRAMES, until: durationInFrames, end: null }));

/** The end card: the wordmark springs in on the stage between two dimmed cards, then the tagline and an optional call-to-action pill. Everything holds to the last frame. */
export const TitleCard = ({ layout, durationInFrames, cta }: SceneProps & { cta?: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const place = PLACEMENT[layout];
  const mark = spring({ frame: frame - RISE.mark, fps, config: SPRINGS.mark });
  const tag = springIn(frame, fps, SPRINGS.pill, RISE.tag, ENTER_FRAMES);

  return (
    <AbsoluteFill style={{ fontFamily: fonts.body, color: colors.foreground }}>
      <WordmarkFilter />
      {[SHOTS.library, SHOTS.game].map((shot, i) => (
        <ShotCard
          key={shot.src}
          shot={shot}
          path={fullFrame}
          pose={TITLE_CARDS[layout][i]}
          durationInFrames={durationInFrames}
          delay={RISE.cards + i * 10}
          variant="depth"
          holdsToEnd
          bobPhase={i * 2}
        />
      ))}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translateY(${-place.lift}px)` }}>
        <Wordmark fontSize={place.fontSize} progress={mark} />
        <p
          style={{
            margin: '28px 0 0',
            fontSize: place.tagSize,
            fontWeight: 300,
            letterSpacing: '.3em',
            textTransform: 'uppercase',
            color: colors.muted,
            opacity: springOpacity(tag),
            transform: `translateY(${(1 - tag) * 30}px)`,
          }}
        >
          {TAGLINE}
        </p>
        {cta && (
          <Pills lines={[cta]} layout={layout} durationInFrames={durationInFrames} delay={RISE.cta} place={{ position: 'relative', marginTop: 44 }} dot="purple" holdsToEnd />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
