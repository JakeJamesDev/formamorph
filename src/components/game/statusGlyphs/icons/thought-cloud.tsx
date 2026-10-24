import { motion, type Variants } from 'motion/react';
import { getVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../animate-ui/icon';
import { useShouldReduceMotion } from '../animate-ui/motion';

type ThoughtCloudProps = IconProps<keyof typeof animations>;

const CYCLE_S = 2;
/** The gap between two parts lighting. */
const STEP_S = 0.15;
/** How long a part takes to pop up, and again to settle. */
const POP_S = 0.15;
/** How long the last lit part holds before all fade. */
const HOLD_S = 0.3;
const FADE_S = 0.35;
const REST_OPACITY = 0.35;
const PARTS = 6;

/** Part `index` lights in turn and stays lit; then every part fades back together. `peak` is its pop. */
function lightInTurn(index: number, peak: Record<string, number>, rest: Record<string, number>): Variants {
  const pop = POP_S / CYCLE_S;
  const start = (index * STEP_S) / CYCLE_S;
  const fadeStart = ((PARTS - 1) * STEP_S + 2 * POP_S + HOLD_S) / CYCLE_S;
  const fadeEnd = fadeStart + FADE_S / CYCLE_S;
  const times = [0, start, start + pop, start + 2 * pop, fadeStart, fadeEnd, 1];
  const shape = Object.fromEntries(
    Object.entries(peak).map(([key, value]) => [key, [rest[key], rest[key], value, rest[key], rest[key], rest[key], rest[key]]]),
  );
  return {
    // Under reduced motion the static frame is fully lit.
    initial: (reduce: boolean) => ({ ...rest, opacity: reduce ? 1 : REST_OPACITY }),
    animate: {
      ...shape,
      opacity: [REST_OPACITY, REST_OPACITY, 1, 1, 1, REST_OPACITY, REST_OPACITY],
      transition: { duration: CYCLE_S, times, ease: 'easeInOut' },
    },
  };
}

const LIFT = { y: -1 };
const STILL = { y: 0 };

// Lights from the small tail dot up to the cloud's inner dots.
const animations = {
  default: {
    tailSmall: lightInTurn(0, LIFT, STILL),
    tailLarge: lightInTurn(1, LIFT, STILL),
    cloud: lightInTurn(2, { scale: 1.04 }, { scale: 1 }),
    dot1: lightInTurn(3, LIFT, STILL),
    dot2: lightInTurn(4, LIFT, STILL),
    dot3: lightInTurn(5, LIFT, STILL),
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: ThoughtCloudProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);
  const reduce = useShouldReduceMotion();
  const part = (name: keyof typeof animations.default) => ({ variants: variants[name], initial: 'initial', animate: controls, custom: reduce });

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      overflow="visible"
      {...props}
    >
      <motion.path d="M7 16a4 4 0 0 1-1.5-7.7 5 5 0 0 1 9-3.3 4.5 4.5 0 0 1 6.5 4.5 3.5 3.5 0 0 1-2 6.5 3.2 3.2 0 0 1-6 0 3.2 3.2 0 0 1-6 0z" {...part('cloud')} />
      <motion.path d="M9.5 11h.01" {...part('dot1')} />
      <motion.path d="M13 11h.01" {...part('dot2')} />
      <motion.path d="M16.5 11h.01" {...part('dot3')} />
      <motion.circle cx={4.6} cy={19.6} r={1.4} fill="currentColor" stroke="none" {...part('tailLarge')} />
      <motion.circle cx={1.8} cy={22.6} r={0.9} fill="currentColor" stroke="none" {...part('tailSmall')} />
    </motion.svg>
  );
}

/** The Thinking header's glyph: a thought cloud that fills from its tail up. */
export function ThoughtCloud(props: ThoughtCloudProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}
