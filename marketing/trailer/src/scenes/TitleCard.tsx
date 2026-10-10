import { AbsoluteFill, measureSpring, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FPS, type Layout, type SceneProps } from '../layout';
import { ENTER_FRAMES, SPRINGS, springIn, springOpacity } from '../motion';
import { TITLE_CARDS } from '../poses';
import { Pills } from '../parts/CopyBlock';
import { ShotCard, fullFrame } from '../parts/GlassCard';
import { POP_BEATS, POP_BEAT_FRAMES, Wordmark, WordmarkFilter, popScales } from '../parts/Wordmark';
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
/** Frame the wordmark starts to rise. */
const MARK_FRAME = 12;
/** Frame the wordmark's spring lands within 0.5%, where the pop starts. */
const POP_FRAME = MARK_FRAME + measureSpring({ fps: FPS, config: SPRINGS.mark, threshold: 0.005 });
const POP_END = POP_FRAME + POP_BEATS * POP_BEAT_FRAMES;
/** Frames each part starts to enter. The tagline and the call to action wait for the pop, so nothing rises under it (ruling Q59). */
const RISE = { cards: 0, mark: MARK_FRAME, pop: POP_FRAME, tag: POP_END + 6, cta: POP_END + 46 };

/** The call to action: its line, and the part of it drawn in the accent color as a link. */
export type CallToAction = { text: string; link: string };

/** The frames the tagline and the call-to-action line enter and are legible, for the reading check. Both hold to the card's last frame. */
export const titleReads = (durationInFrames: number, cta?: CallToAction): CopyRead[] =>
  [
    { text: TAGLINE, start: RISE.tag },
    ...(cta ? [{ text: cta.text, start: RISE.cta }] : []),
  ].map(({ text, start }) => ({ text, start, from: start + ENTER_FRAMES, until: durationInFrames, end: null }));

/** The end card: the wordmark springs in on the stage between two dimmed cards and pops letter by letter, then the tagline and an optional call-to-action pill with its link in the accent color (ruling Q37). Everything holds to the last frame. */
export const TitleCard = ({ layout, durationInFrames, cta }: SceneProps & { cta?: CallToAction }) => {
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
        <Wordmark fontSize={place.fontSize} progress={mark} pop={popScales(frame, RISE.pop)} />
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
          <Pills
            lines={[cta.text]}
            accent={cta.link}
            layout={layout}
            durationInFrames={durationInFrames}
            delay={RISE.cta}
            place={{ position: 'relative', marginTop: 44 }}
            holdsToEnd
          />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
