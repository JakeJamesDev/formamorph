import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { FPS, type Layout, type SceneProps } from '../layout';
import { ENTER_FRAMES, SPRINGS, springIn, springOpacity } from '../motion';
import { TITLE_CARDS } from '../poses';
import { Pills } from '../parts/CopyBlock';
import { ShotCard, fullFrame } from '../parts/GlassCard';
import { GOO_SETTLE_MS, GooWordmark } from '../parts/GooWordmark';
import type { CopyRead } from '../reading';
import { SHOTS } from '../shots';
import { colors, fonts } from '../theme';

type Placement = {
  /** How far the wordmark block sits above the canvas center. */
  lift: number;
  fontSize: number;
  /** The widest the wordmark may be; it shrinks to fit. */
  markWidth: number;
  tagSize: number;
};

const PLACEMENT: Record<Layout, Placement> = {
  wide: { lift: 20, fontSize: 200, markWidth: 1700, tagSize: 26 },
  tall: { lift: 0, fontSize: 170, markWidth: 960, tagSize: 28 },
};

const TAGLINE = 'AI text RPG';
/** Frame the wordmark's first blob is born. */
const MARK_FRAME = 12;
/** Frame the wordmark's blobs have all magnetized into place. */
const SETTLE_FRAME = MARK_FRAME + Math.ceil((GOO_SETTLE_MS / 1000) * FPS);
/** Frames each part starts to enter. The tagline and the call to action wait for the letters to settle (ruling Q49). */
const RISE = { cards: 0, mark: MARK_FRAME, tag: SETTLE_FRAME, cta: SETTLE_FRAME + 40 };

/** The call to action: its line, and the part of it drawn in the accent color as a link. */
export type CallToAction = { text: string; link: string };

/** The frames the tagline and the call-to-action line enter and are legible, for the reading check. Both hold to the card's last frame. */
export const titleReads = (durationInFrames: number, cta?: CallToAction): CopyRead[] =>
  [
    { text: TAGLINE, start: RISE.tag },
    ...(cta ? [{ text: cta.text, start: RISE.cta }] : []),
  ].map(({ text, start }) => ({ text, start, from: start + ENTER_FRAMES, until: durationInFrames, end: null }));

/** The end card: the wordmark coalesces from goo on the stage between two dimmed cards, then the tagline and an optional call-to-action pill with its link in the accent color (ruling Q37). Everything holds to the last frame. */
export const TitleCard = ({ layout, durationInFrames, cta }: SceneProps & { cta?: CallToAction }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const place = PLACEMENT[layout];
  const tag = springIn(frame, fps, SPRINGS.pill, RISE.tag, ENTER_FRAMES);

  return (
    <AbsoluteFill style={{ fontFamily: fonts.body, color: colors.foreground }}>
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
        <GooWordmark fontSize={place.fontSize} maxWidth={place.markWidth} from={RISE.mark} />
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
