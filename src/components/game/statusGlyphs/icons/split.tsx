import { useState } from 'react';
import { motion, type Variants } from 'motion/react';
import { getVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../animate-ui/icon';

type SplitProps = IconProps<keyof typeof animations>;

/** The walker's route up the stem and out each branch. */
const BRANCHES = {
  left: 'M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3',
  right: 'M12 22V13.7L15 9L21 3',
} as const;

// Lucide `split`. A dot walks up the stem and out one branch.
const animations = {
  default: {
    walker: {
      initial: { offsetDistance: '0%', opacity: 0 },
      animate: {
        offsetDistance: ['0%', '100%', '100%'],
        opacity: [0, 1, 1, 0],
        transition: {
          duration: 1.3,
          offsetDistance: { duration: 1.3, times: [0, 0.8, 1], ease: 'easeInOut' },
          opacity: { duration: 1.3, times: [0, 0.12, 0.8, 1], ease: ['easeInOut', 'easeInOut', 'linear'] },
        },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: SplitProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);
  // Each finished walk flips the branch, so consecutive loops alternate.
  const [branch, setBranch] = useState<keyof typeof BRANCHES>('left');

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
      {...props}
    >
      <path d="M16 3h5v5" />
      <path d="M8 3H3v5" />
      <path d={BRANCHES.left} />
      <path d="m15 9 6-6" />
      <motion.circle
        data-branch={branch}
        cx={0}
        cy={0}
        r={1.7}
        fill="currentColor"
        stroke="none"
        style={{ offsetPath: `path('${BRANCHES[branch]}')`, offsetRotate: '0deg' }}
        variants={variants.walker}
        initial="initial"
        animate={controls}
        onAnimationComplete={(definition) => {
          if (definition === 'animate') setBranch((b) => (b === 'left' ? 'right' : 'left'));
        }}
      />
    </motion.svg>
  );
}

/** Choices' glyph: a path that forks, taken left, then right. */
export function Split(props: SplitProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}
